/** LiveGraph8Provider: talks to the real Graph8 REST API. Ported from
 * backend/app/services/graph8/live_provider.py — see that file's docstring
 * for what's confirmed vs. unconfirmed about the real API shape. */
import { settings } from "../../config";
import type { Graph8Provider } from "./base";
import type { G8Contact, G8Deal, G8DealBundle, G8Meeting, G8Note, G8StageEvent } from "./schemas";

class Graph8RateLimitError extends Error {}

function parseDt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inferSegment(employeeCount: unknown): string {
  if (employeeCount == null || employeeCount === "") return "mid_market";
  // Accepts 5000, "5000", "5,000" or a range like "1001-5000" (uses the lower bound).
  const match = String(employeeCount).replace(/,/g, "").match(/\d+/);
  if (!match) return "mid_market";
  const n = parseInt(match[0], 10);
  if (n >= 1000) return "enterprise";
  if (n <= 50) return "smb";
  return "mid_market";
}

/** Strips what often gets pasted along with a key: whitespace, line breaks,
 * quotes and a leading "Bearer". */
export function cleanApiKey(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/^["']+|["']+$/g, "").replace(/^bearer/i, "");
}

export class LiveGraph8Provider implements Graph8Provider {
  mode = "live";
  private apiKey: string;
  // Outcome Graph8 reported for each deal in the won/lost/open list calls;
  // single-deal payloads may not carry it.
  private knownOutcomes = new Map<string, string>();
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = cleanApiKey(apiKey);
    this.baseUrl = baseUrl || settings.graph8BaseUrl;
  }

  private async get(path: string, params?: Record<string, string | number>): Promise<any> {
    const url = new URL(this.baseUrl + path);
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (res.status === 429) {
        const wait = Math.min(30000, 1000 * 2 ** attempt);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`Graph8 API ${res.status}: ${await res.text()}`);
      return res.json();
    }
    throw new Graph8RateLimitError("Graph8 API rate limit exceeded after retries");
  }

  rememberOutcome(graph8DealId: string, outcome: string) {
    this.knownOutcomes.set(String(graph8DealId), outcome);
  }

  private async companyIndustryAndSegment(companyId: string | number | null | undefined): Promise<[string, string, string]> {
    if (!companyId) return ["Unknown", "mid_market", ""];
    try {
      const payload = (await this.get(`/companies/${companyId}`)).data || {};
      const industry = payload.industry || payload.company_industry || payload.industries?.[0] || "Unknown";
      const employees = payload.employee_count ?? payload.employees ?? payload.company_employee_count ?? payload.employee_range ?? payload.size;
      return [String(industry), inferSegment(employees), String(payload.name || "")];
    } catch {
      return ["Unknown", "mid_market", ""];
    }
  }

  private async parseDeal(payload: any, outcomeHint?: string): Promise<G8Deal> {
    const [industry, segment, companyName] = await this.companyIndustryAndSegment(payload.company_id);

    const closedLostReason = payload.closed_lost_reason;
    const closeDate = parseDt(payload.close_date);
    const stageLabel = String(payload.stage_name || payload.stage || "");
    let outcome: string;
    if (outcomeHint) outcome = outcomeHint;
    else if (/won|lost|open/i.test(String(payload.outcome ?? ""))) outcome = String(payload.outcome).toLowerCase().match(/won|lost|open/)![0];
    else if (payload.is_closed_won === true || /closed[ _-]?won/i.test(stageLabel)) outcome = "won";
    else if (payload.is_closed_lost === true || /closed[ _-]?lost/i.test(stageLabel)) outcome = "lost";
    else if (closedLostReason) outcome = "lost";
    else if (closeDate) outcome = "won";
    else outcome = "open";

    return {
      externalId: String(payload.id),
      name: payload.name || "",
      companyName: payload.company_name || companyName || "",
      industry,
      segment,
      amount: Number(payload.amount || 0),
      currency: payload.currency || "USD",
      pipelineId: payload.pipeline_id || null,
      stageId: payload.stage_id || null,
      stageName: payload.stage_name || null,
      ownerName: payload.owner_name || null,
      outcome,
      closeReasonRaw: closedLostReason || null,
      openedAt: parseDt(payload.created_at),
      closedAt: closeDate,
    };
  }

  async getDealBundle(graph8DealId: string): Promise<G8DealBundle> {
    const dealPayload = (await this.get(`/deals/${graph8DealId}`)).data;
    const deal = await this.parseDeal(dealPayload, this.knownOutcomes.get(String(graph8DealId)));

    const contactsData = (await this.get(`/deals/${graph8DealId}/contacts`)).data || {};
    const contacts: G8Contact[] = (contactsData.contacts || []).map((c: any) => ({
      externalId: String(c.person_id || c.id),
      name: c.name || "",
      title: c.title || null,
      role: c.role || "unknown",
      engagedAt: parseDt(c.created_at),
    }));

    let historyItems = (await this.get(`/deals/${graph8DealId}/history`)).data || {};
    if (!Array.isArray(historyItems)) historyItems = historyItems.items || [];
    const stageHistory: G8StageEvent[] = [];
    for (const h of historyItems || []) {
      if (typeof h !== "object" || h === null) continue;
      const stageName = h.stage_name || h.to_stage || h.stage;
      const enteredAt = parseDt(h.entered_at || h.created_at || h.changed_at);
      if (!stageName || !enteredAt) continue;
      stageHistory.push({
        stageId: String(h.stage_id || stageName),
        stageName,
        enteredAt,
        exitedAt: parseDt(h.exited_at),
      });
    }

    let activitiesItems = (await this.get(`/deals/${graph8DealId}/activities`)).data || {};
    if (!Array.isArray(activitiesItems)) activitiesItems = activitiesItems.items || [];
    const meetings: G8Meeting[] = [];
    for (const a of activitiesItems || []) {
      if (typeof a !== "object" || a === null) continue;
      const summary = a.summary || a.description || a.type || "";
      if (!summary) continue;
      meetings.push({
        externalId: String(a.id || ""),
        occurredAt: parseDt(a.occurred_at || a.created_at),
        summary,
      });
    }

    const notesData = (await this.get(`/deals/${graph8DealId}/notes`)).data || {};
    const noteItems = Array.isArray(notesData) ? notesData : notesData.notes || notesData;
    const notes: G8Note[] = (Array.isArray(noteItems) ? noteItems : [])
      .filter((n: any) => typeof n === "object" && n !== null)
      .map((n: any) => ({
        externalId: String(n.id || ""),
        createdAt: parseDt(n.created_at),
        body: n.content || n.body || "",
      }));

    return { deal, contacts, stageHistory, meetings, notes, objections: [], requirements: [], competitors: [], pricingNotes: [] };
  }

  private async listDealsByOutcome(outcome: string): Promise<G8Deal[]> {
    const deals: G8Deal[] = [];
    let cursor: string | undefined;
    for (;;) {
      const params: Record<string, string | number> = { outcome, limit: 100 };
      if (cursor) params.cursor = cursor;
      const payload = await this.get("/deals", params);
      const page: any[] = payload.data || [];
      for (const d of page) this.knownOutcomes.set(String(d.id), outcome);
      deals.push(...(await Promise.all(page.map((d) => this.parseDeal(d, outcome)))));
      const pagination = payload.pagination || {};
      if (!pagination.has_next) break;
      cursor = pagination.next_cursor;
    }
    return deals;
  }

  async listClosedDeals(): Promise<G8Deal[]> {
    return [...(await this.listDealsByOutcome("won")), ...(await this.listDealsByOutcome("lost"))];
  }

  async listActiveDeals(): Promise<G8Deal[]> {
    return this.listDealsByOutcome("open");
  }

  async createTask(args: {
    graph8DealId: string;
    title: string;
    description: string;
    assigneeHint?: string | null;
  }): Promise<string> {
    const body: Record<string, unknown> = {
      title: args.title,
      description: args.description,
      records: [{ type: "deal", id: args.graph8DealId }],
    };
    if (args.assigneeHint) body.assignee_id = args.assigneeHint;
    const res = await fetch(`${this.baseUrl}/tasks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Graph8 create_task failed: ${res.status}`);
    return String((await res.json()).data.id);
  }

  async createNote(args: { graph8DealId: string; body: string }): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/deals/${args.graph8DealId}/notes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: args.body }),
      });
      if (!res.ok) return null;
      return String((await res.json()).data?.id || "");
    } catch {
      return null;
    }
  }
}
