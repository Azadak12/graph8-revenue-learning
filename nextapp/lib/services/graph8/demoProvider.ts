/** DemoGraph8Provider: serves the seeded DEMO DATA set. Ported from
 * backend/app/services/graph8/demo_provider.py. */
import { v4 as uuid } from "uuid";
import { getLogger } from "../../logging";
import { ACTIVE_DEALS, CLOSED_DEALS, type RawDemoDeal } from "../../seed/demoDeals";
import type { Graph8Provider } from "./base";
import type { G8Contact, G8Deal, G8DealBundle, G8Meeting, G8Note, G8StageEvent } from "./schemas";

const logger = getLogger("demoGraph8Provider");

function dt(daysAgo: number | null | undefined): Date | null {
  if (daysAgo === null || daysAgo === undefined) return null;
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

function toG8Deal(raw: RawDemoDeal): G8Deal {
  const stageHistory = raw.stage_history || [];
  const lastStage = stageHistory.length > 0 ? stageHistory[stageHistory.length - 1] : null;
  return {
    externalId: raw.external_id,
    name: raw.name,
    companyName: raw.company_name,
    industry: raw.industry,
    segment: raw.segment,
    amount: Number(raw.amount),
    currency: raw.currency,
    pipelineId: "demo-pipeline",
    stageId: lastStage ? lastStage[0] : null,
    stageName: lastStage ? lastStage[0] : null,
    ownerName: raw.owner_name || null,
    outcome: raw.outcome,
    closeReasonRaw: raw.close_reason_raw || null,
    openedAt: dt(raw.opened_days_ago),
    closedAt: dt(raw.closed_days_ago),
  };
}

function toBundle(raw: RawDemoDeal): G8DealBundle {
  const deal = toG8Deal(raw);
  const contacts: G8Contact[] = (raw.contacts || []).map(([name, title, role, engagedDaysAgo], i) => ({
    externalId: `${raw.external_id}-contact-${i}`,
    name,
    title,
    role,
    engagedAt: dt(engagedDaysAgo),
  }));
  const stageHistory: G8StageEvent[] = (raw.stage_history || []).map(([stageName, enteredDaysAgo, exitedDaysAgo]) => ({
    stageId: stageName,
    stageName,
    enteredAt: dt(enteredDaysAgo)!,
    exitedAt: dt(exitedDaysAgo),
  }));
  const meetings: G8Meeting[] = (raw.meetings || []).map(([daysAgo, summary], i) => ({
    externalId: `${raw.external_id}-meeting-${i}`,
    occurredAt: dt(daysAgo),
    summary,
  }));
  const notes: G8Note[] = (raw.notes || []).map(([daysAgo, body], i) => ({
    externalId: `${raw.external_id}-note-${i}`,
    createdAt: dt(daysAgo),
    body,
  }));
  return {
    deal,
    contacts,
    stageHistory,
    meetings,
    notes,
    objections: raw.objections || [],
    requirements: raw.requirements || [],
    competitors: raw.competitors || [],
    pricingNotes: raw.pricing_notes || [],
  };
}

export class DemoGraph8Provider implements Graph8Provider {
  mode = "demo";
  private byExternalId = new Map<string, RawDemoDeal>();

  constructor() {
    for (const d of [...CLOSED_DEALS, ...ACTIVE_DEALS]) this.byExternalId.set(d.external_id, d);
  }

  async getDealBundle(graph8DealId: string): Promise<G8DealBundle> {
    const raw = this.byExternalId.get(graph8DealId);
    if (!raw) throw new Error(`Unknown demo deal id: ${graph8DealId}`);
    return toBundle(raw);
  }

  async listClosedDeals(): Promise<G8Deal[]> {
    return CLOSED_DEALS.map(toG8Deal);
  }

  async listActiveDeals(): Promise<G8Deal[]> {
    return ACTIVE_DEALS.map(toG8Deal);
  }

  async createTask(args: {
    graph8DealId: string;
    title: string;
    description: string;
    assigneeHint?: string | null;
  }): Promise<string> {
    const objectId = `demo-task-${uuid().slice(0, 10)}`;
    logger.info("demo_graph8_task_created", { objectId, dealId: args.graph8DealId, title: args.title });
    return objectId;
  }

  async createNote(args: { graph8DealId: string; body: string }): Promise<string | null> {
    const objectId = `demo-note-${uuid().slice(0, 10)}`;
    logger.info("demo_graph8_note_created", { objectId, dealId: args.graph8DealId });
    return objectId;
  }
}

export function groundTruthFor(externalId: string, dealName?: string | null): RawDemoDeal["ground_truth"] | undefined {
  const deals = [...CLOSED_DEALS, ...ACTIVE_DEALS];
  // Sample deals loaded into a Graph8 workspace by scripts/graph8-seed.mjs come
  // back with Graph8's ids, so also match them by their unique deal name.
  const raw = deals.find((d) => d.external_id === externalId) || (dealName ? deals.find((d) => d.name === dealName) : undefined);
  return raw?.ground_truth;
}
