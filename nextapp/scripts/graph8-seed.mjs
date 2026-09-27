// Loads the 22 Revenue Learning sample deals INTO a Graph8 workspace through
// Graph8's public API: companies, contacts, a pipeline, deals with their
// buying committee, the deal story as deal notes, and won/lost outcomes.
// The app then reads them back from Graph8 with "Sync deals from Graph8".
//
// These are sample deals written into Graph8, not customer history. Run it
// only against a workspace meant for testing or demos.
//
// Usage (from the nextapp folder):
//   GRAPH8_API_KEY=your_key node scripts/graph8-seed.mjs
// Optional: GRAPH8_OWNER_ID=<your Graph8 user id> if the script can't find it.
//
// It prints every step and saves graph8-seed-report.json (no secrets in it).

import { readFileSync, writeFileSync } from "node:fs";

const KEY = (process.env.GRAPH8_API_KEY || "").replace(/\s+/g, "").replace(/^bearer/i, "");
const BASE = process.env.GRAPH8_BASE_URL || "https://be.graph8.com/api/v1";
if (!KEY) {
  console.error("Set GRAPH8_API_KEY first.");
  process.exit(1);
}

const report = { base: BASE, started_at: new Date().toISOString(), steps: [] };
function save() {
  writeFileSync("graph8-seed-report.json", JSON.stringify(report, null, 2));
}

async function call(method, path, body, { quiet = false } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text.slice(0, 500); }
    const step = { method, path, status: res.status };
    if (!res.ok) step.error = typeof json === "string" ? json : json?.message || json?.detail || json;
    report.steps.push(step);
    if (!quiet && !res.ok) console.log(`   ${method} ${path} -> ${res.status} ${JSON.stringify(step.error).slice(0, 200)}`);
    return { ok: res.ok, status: res.status, body: json };
  }
  return { ok: false, status: 429, body: "rate limited" };
}

const dataOf = (r) => (r?.body && typeof r.body === "object" && "data" in r.body ? r.body.data : r?.body);
const idOf = (obj) => obj?.id ?? obj?.deal_id ?? obj?.company_id ?? obj?.contact_id ?? obj?.person_id ?? obj?.user_id;
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const asList = (d) => (Array.isArray(d) ? d : d?.items || d?.data || d?.pipelines || d?.reasons || d?.users || d?.members || []);

// ---------------------------------------------------------------- spec
console.log("1) Reading Graph8's API list...");
let spec = null;
for (const p of ["/openapi.json", "/../openapi.json", "/../../openapi.json"]) {
  const r = await call("GET", p, undefined, { quiet: true });
  if (r.ok && r.body?.paths) { spec = r.body; break; }
}
const specPaths = spec ? Object.keys(spec.paths).map((p) => p.replace(/^\/api\/v1/, "")) : [];
const find = (re, method) =>
  specPaths.filter((p) => re.test(p) && (spec.paths[p]?.[method] || spec.paths["/api/v1" + p]?.[method]));
report.spec_found = !!spec;
console.log(`   ${spec ? specPaths.length + " endpoints found" : "API list not available, using known endpoints"}`);

// ---------------------------------------------------------------- owner
console.log("2) Finding your Graph8 user id (deal owner)...");
let ownerId = process.env.GRAPH8_OWNER_ID || null;
if (!ownerId) {
  const candidates = [
    ...find(/(^|\/)me$/, "get"),
    "/me", "/users/me", "/auth/me", "/account/me", "/user", "/users/current",
    ...find(/^\/(users|members|team|workspace\/members|workspace\/users|organization\/members)$/, "get"),
    "/users", "/members",
  ];
  for (const path of [...new Set(candidates)]) {
    const r = await call("GET", path, undefined, { quiet: true });
    if (!r.ok) continue;
    const d = dataOf(r);
    const obj = Array.isArray(d) || d?.items || d?.users || d?.members ? asList(d)[0] : d?.user || d;
    const id = obj?.user_id ?? obj?.id;
    if (id) { ownerId = String(id); console.log(`   found via GET ${path}`); break; }
  }
}
if (!ownerId) {
  // Fall back to the creator of any existing task or note.
  const t = await call("GET", "/tasks?limit=5", undefined, { quiet: true });
  const task = asList(dataOf(t))[0];
  ownerId = task?.created_by || task?.assignee_id || null;
}
report.owner_id_found = !!ownerId;
console.log(ownerId ? `   owner id: ${ownerId}` : "   not found - will try creating deals without it");

// ---------------------------------------------------------------- pipeline
console.log("3) Setting up the sales pipeline...");
const STAGES = ["Discovery", "Technical Evaluation", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];
async function getPipelines() {
  return asList(dataOf(await call("GET", "/deals/pipelines", undefined, { quiet: true })));
}
let pipelines = await getPipelines();
if (pipelines.length === 0) {
  const createPaths = [...new Set([...find(/pipelines$/, "post"), "/deals/pipelines", "/pipelines"])];
  const bodies = [
    { name: "Sales Pipeline", stages: STAGES.map((name, i) => ({ name, position: i, order: i })) },
    { name: "Sales Pipeline", stages: STAGES },
    { name: "Sales Pipeline" },
  ];
  outer: for (const path of createPaths) {
    for (const body of bodies) {
      const r = await call("POST", path, body, { quiet: true });
      if (r.ok) { console.log(`   created pipeline via POST ${path}`); break outer; }
    }
  }
  pipelines = await getPipelines();
}
const pipeline = pipelines.find((p) => p.is_default) || pipelines[0] || null;
const stages = pipeline ? asList(pipeline.stages || pipeline.deal_stages || []) : [];
const stageName = (s) => String(s?.name || s?.label || s?.title || "");
const stageByName = (re) => stages.find((s) => re.test(stageName(s)));
const wonStage = stages.find((s) => s.is_won || s.is_closed_won || s.type === "won" || s.outcome === "won") || stageByName(/won/i);
const lostStage = stages.find((s) => s.is_lost || s.is_closed_lost || s.type === "lost" || s.outcome === "lost") || stageByName(/lost/i);
const openStages = stages.filter((s) => s !== wonStage && s !== lostStage);
report.pipeline = { found: !!pipeline, stages: stages.map(stageName), won_stage: stageName(wonStage), lost_stage: stageName(lostStage) };
console.log(pipeline ? `   pipeline "${pipeline.name}" with stages: ${stages.map(stageName).join(", ")}` : "   no pipeline available - deals will use Graph8's default");

// ---------------------------------------------------------------- close reasons
const reasonsR = await call("GET", "/deals/close-reasons", undefined, { quiet: true });
const reasons = asList(dataOf(reasonsR));
function closeReasonFor(deal) {
  const kind = deal.outcome;
  const text = (deal.close_reason_raw || "").toLowerCase();
  const pool = reasons.filter((r) => r.kind === kind);
  const pick = (re) => pool.find((r) => re.test(r.label));
  if (kind === "lost") {
    return (/security|iam|compliance|sso|scim/.test(text) && pick(/capability/i)) ||
      (/price|budget|cost|discount/.test(text) && pick(/price|budget/i)) ||
      (/competitor|chose|went with/.test(text) && pick(/competitor/i)) ||
      (/silent|ghost|stall|no decision/.test(text) && pick(/stalled|silent/i)) ||
      (/timing|freeze|next year/.test(text) && pick(/timing/i)) || pool[0];
  }
  return pick(/champion/i) || pool[0];
}

// ---------------------------------------------------------------- deals
const raw = JSON.parse(readFileSync(new URL("../lib/seed/demoDealsData.json", import.meta.url)));
const all = [...raw.closed, ...raw.active];
const EMPLOYEES = { enterprise: "5000", mid_market: "500", smb: "50" };

// Discover a dedicated "close deal" endpoint, if Graph8 has one.
const closePaths = find(/^\/deals\/\{[^}]+\}\/(close|mark[-_]?(won|lost)|won|lost|outcome|status|close[-_]?(won|lost))$/, "post")
  .concat(find(/^\/deals\/\{[^}]+\}\/(close|outcome|status)$/, "put"), find(/^\/deals\/\{[^}]+\}\/(close|outcome|status)$/, "patch"));
report.close_endpoints = closePaths;

function dealStory(d) {
  const lines = [];
  for (const [days, text] of d.meetings || []) lines.push(`[Meeting, ${daysAgo(days)}] ${text}`);
  for (const [days, text] of d.notes || []) lines.push(`[Internal note, ${daysAgo(days)}] ${text}`);
  if (d.objections?.length) lines.push(`Objections: ${d.objections.join("; ")}`);
  if (d.requirements?.length) lines.push(`Requirements: ${d.requirements.join("; ")}`);
  if (d.competitors?.length) lines.push(`Competitors: ${d.competitors.join(", ")}`);
  if (d.pricing_notes?.length) lines.push(`Pricing: ${d.pricing_notes.join("; ")}`);
  if (d.close_reason_raw) lines.push(`Close reason (from rep): ${d.close_reason_raw}`);
  return lines;
}

async function markClosed(dealId, d) {
  const reason = closeReasonFor(d);
  const closeDate = daysAgo(d.closed_days_ago ?? 1);
  const stage = d.outcome === "won" ? wonStage : lostStage;
  const common = {
    outcome: d.outcome, status: d.outcome, is_closed_won: d.outcome === "won", close_date: closeDate,
    close_reason_id: reason?.id, reason_id: reason?.id, close_reason: reason?.label || d.close_reason_raw,
    closed_lost_reason: d.outcome === "lost" ? d.close_reason_raw || reason?.label : undefined,
    closed_won_reason: d.outcome === "won" ? reason?.label : undefined,
    stage_id: stage?.id,
  };
  const attempts = [];
  for (const p of closePaths) {
    const method = spec.paths[p]?.post || spec.paths["/api/v1" + p]?.post ? "POST" : spec.paths[p]?.put || spec.paths["/api/v1" + p]?.put ? "PUT" : "PATCH";
    attempts.push([method, p.replace(/\{[^}]+\}/, dealId), common]);
  }
  if (stage?.id) {
    attempts.push(["PATCH", `/deals/${dealId}`, { stage_id: stage.id, close_date: closeDate }]);
    attempts.push(["POST", "/deals/bulk", { deal_ids: [dealId], change: { stage_id: stage.id, close_date: `${closeDate}T00:00:00Z` } }]);
  }
  attempts.push(["PATCH", `/deals/${dealId}`, { close_date: closeDate }]);
  for (const [m, p, b] of attempts) {
    const r = await call(m, p, b, { quiet: true });
    if (!r.ok) continue;
    const check = dataOf(await call("GET", `/deals/${dealId}`, undefined, { quiet: true })) || {};
    const outcome = check.outcome || (check.is_closed_won ? "won" : check.is_closed_lost || check.closed_lost_reason ? "lost" : null);
    if (outcome === d.outcome) return `${m} ${p.replace(dealId, "{id}")}`;
  }
  return null;
}

console.log(`4) Creating ${all.length} deals with companies, contacts and notes...`);
const results = [];
for (const d of all) {
  const row = { name: d.name, outcome: d.outcome };
  results.push(row);
  const domain = `${slug(d.company_name)}.com`;

  // Company
  let companyId = null;
  let r = await call("POST", "/companies", { domain, name: d.company_name, industry: d.industry, employee_count: EMPLOYEES[d.segment] || "500" }, { quiet: true });
  companyId = idOf(dataOf(r));
  if (!companyId) {
    r = await call("GET", `/companies?domain=${encodeURIComponent(domain)}&limit=1`, undefined, { quiet: true });
    companyId = idOf(asList(dataOf(r))[0]);
  }
  row.company = !!companyId;

  // Contacts
  const contactIds = [];
  for (const [name, title, role] of d.contacts || []) {
    const [first, ...rest] = name.split(" ");
    const email = `${slug(first)}.${slug(rest.join(" ") || "contact")}@${domain}`;
    let c = await call("POST", "/contacts", {
      first_name: first, last_name: rest.join(" ") || "-", work_email: email, job_title: title,
      company_id: companyId ? Number(companyId) : undefined, company_domain: domain,
    }, { quiet: true });
    let cid = idOf(dataOf(c));
    if (!cid) {
      c = await call("GET", `/contacts?email=${encodeURIComponent(email)}&limit=1`, undefined, { quiet: true });
      cid = idOf(asList(dataOf(c))[0]);
    }
    if (cid) contactIds.push({ id: Number(cid), role });
  }
  row.contacts = contactIds.length;

  // Deal
  const firstStage = openStages.find((s) => stageName(s) === (d.stage_history?.at(-1)?.[0] || "")) || openStages[0];
  const dealBody = {
    name: d.name, company_id: companyId ? Number(companyId) : undefined, amount: d.amount, currency: d.currency,
    pipeline_id: pipeline?.id, stage_id: firstStage?.id, owner_id: ownerId || undefined,
    contact_ids: contactIds.map((c) => c.id), allow_duplicate: false,
  };
  r = await call("POST", "/deals", dealBody);
  let dealId = idOf(dataOf(r));
  if (!dealId && r.status === 409) {
    const s = await call("GET", `/deals?search=${encodeURIComponent(d.name)}&limit=1`, undefined, { quiet: true });
    dealId = idOf(asList(dataOf(s))[0]);
    row.existing = !!dealId;
  }
  if (!dealId) { row.error = r.body?.message || r.body?.detail || r.status; console.log(`   x ${d.name}`); save(); continue; }
  row.deal_id = String(dealId);

  // Buying-committee roles
  for (const c of contactIds) await call("PUT", `/deals/${dealId}/contacts/${c.id}`, { role: c.role }, { quiet: true });

  // Deal story as notes (skip if this deal already has notes from an earlier run)
  const existingNotes = asList(dataOf(await call("GET", `/deals/${dealId}/notes`, undefined, { quiet: true })));
  if (!row.existing || existingNotes.length === 0) {
    for (const line of dealStory(d)) await call("POST", `/deals/${dealId}/notes`, { content: line }, { quiet: true });
  }

  // Outcome
  if (d.outcome === "won" || d.outcome === "lost") {
    row.closed_via = await markClosed(dealId, d);
  }
  console.log(`   ${row.deal_id ? "ok" : "x"} ${d.name} (${d.outcome}${d.outcome !== "open" ? row.closed_via ? ", closed" : ", NOT closed" : ""})`);
  save();
}

// ---------------------------------------------------------------- verify
console.log("5) Checking what Graph8 now reports...");
const counts = {};
for (const o of ["won", "lost", "open"]) {
  const r = await call("GET", `/deals?outcome=${o}&limit=1`, undefined, { quiet: true });
  counts[o] = r.body?.pagination?.total ?? asList(dataOf(r)).length;
}
const total = await call("GET", "/deals?limit=1", undefined, { quiet: true });
counts.total = total.body?.pagination?.total;
report.results = results;
report.graph8_counts = counts;
save();

const created = results.filter((r) => r.deal_id).length;
const closedOk = results.filter((r) => r.closed_via).length;
const closedWanted = results.filter((r) => r.outcome !== "open").length;
console.log(`\nDeals in Graph8: ${counts.total} total | won ${counts.won} | lost ${counts.lost} | open ${counts.open}`);
console.log(`Created/found ${created}/${all.length} deals, marked ${closedOk}/${closedWanted} as won/lost.`);
console.log("Saved graph8-seed-report.json");
if (created > 0) console.log("Next: open the app's Settings and click \"Sync deals from Graph8\".");
