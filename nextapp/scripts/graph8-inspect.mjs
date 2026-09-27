// Prints what Graph8's API needs to create deals, notes, contacts and companies,
// plus the workspace's pipelines and close reasons. Read-only: creates nothing.
//
// Usage (from the nextapp folder):
//   GRAPH8_API_KEY=your_key node scripts/graph8-inspect.mjs
// Then send the file graph8-api-shape.json (it contains no secrets).

import { writeFileSync } from "node:fs";

const KEY = process.env.GRAPH8_API_KEY;
const BASE = process.env.GRAPH8_BASE_URL || "https://be.graph8.com/api/v1";
if (!KEY) {
  console.error("Set GRAPH8_API_KEY first.");
  process.exit(1);
}

async function get(path) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${KEY}` } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 2000); }
  return { status: res.status, body };
}

function resolve(spec, node, depth = 0) {
  if (!node || depth > 4) return node;
  if (node.$ref) {
    const target = node.$ref.replace("#/", "").split("/").reduce((o, k) => o?.[k], spec);
    return resolve(spec, target, depth + 1);
  }
  if (Array.isArray(node)) return node.map((n) => resolve(spec, n, depth + 1));
  if (typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (["description", "example", "examples", "title"].includes(k)) continue;
      out[k] = resolve(spec, v, depth + 1);
    }
    return out;
  }
  return node;
}

const RELEVANT = /^\/(deals|companies|contacts|people|persons|notes|tasks|webhooks)(\/|$)/;

const report = { base: BASE, generated_at: new Date().toISOString() };

let spec = null;
for (const p of ["/openapi.json", "/../openapi.json", "/../../openapi.json"]) {
  const r = await get(p);
  if (r.status === 200 && typeof r.body === "object" && r.body.paths) { spec = r.body; report.spec_path = p; break; }
}

if (spec) {
  report.endpoints = {};
  for (const [path, ops] of Object.entries(spec.paths)) {
    const clean = path.replace(/^\/api\/v1/, "");
    if (!RELEVANT.test(clean)) continue;
    for (const [method, op] of Object.entries(ops)) {
      if (!["get", "post", "patch", "put"].includes(method)) continue;
      const entry = {};
      const reqSchema = op.requestBody?.content?.["application/json"]?.schema;
      if (reqSchema) entry.request_body = resolve(spec, reqSchema);
      if (method === "get" && op.parameters) entry.query = op.parameters.filter((p) => p.in === "query").map((p) => p.name);
      report.endpoints[`${method.toUpperCase()} ${clean}`] = entry;
    }
  }
} else {
  report.spec_error = "Could not download openapi.json";
}

report.pipelines = await get("/deals/pipelines");
report.close_reasons = await get("/deals/close-reasons");
report.sample_deals = await get("/deals?limit=3");
report.sample_companies = await get("/companies?limit=2");

writeFileSync("graph8-api-shape.json", JSON.stringify(report, null, 2));
console.log("Saved graph8-api-shape.json");
console.log("Spec found:", !!spec, "| endpoints captured:", report.endpoints ? Object.keys(report.endpoints).length : 0);
console.log("Pipelines status:", report.pipelines.status, "| Deals status:", report.sample_deals.status);
