/** Turns a raw G8DealBundle into a bounded DealEvidenceBundle safe to send to
 * the LLM. Ported from backend/app/services/evidence/normalize.py. */
import type { G8DealBundle } from "../graph8/schemas";

const MAX_MEETINGS = 12;
const MAX_LIST_ITEMS = 15;

export interface DealEvidenceBundle {
  deal_context: {
    deal_name: string;
    company_name: string;
    industry: string;
    segment: string;
    amount: number;
    currency: string;
    outcome: string;
    sales_cycle_days: number | null;
  };
  stakeholders: Array<{ name: string; title: string | null; role: string; engaged_at: string | null }>;
  timeline: Array<{ stage_name: string; entered_at: string; exited_at: string | null; days_in_stage: number | null }>;
  meeting_findings: Array<{ source_external_id: string | null; occurred_at: string | null; summary: string }>;
  objections: string[];
  requirements: string[];
  competitors: string[];
  commercial_findings: string[];
  activity_patterns: string[];
  close_context: { close_reason_raw: string | null; closed_at: string | null };
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildEvidenceBundle(bundle: G8DealBundle): DealEvidenceBundle {
  const deal = bundle.deal;

  let salesCycleDays: number | null = null;
  if (deal.openedAt && deal.closedAt) {
    salesCycleDays = daysBetween(deal.closedAt, deal.openedAt);
  }

  const timeline = bundle.stageHistory.map((stage) => ({
    stage_name: stage.stageName,
    entered_at: stage.enteredAt.toISOString(),
    exited_at: stage.exitedAt ? stage.exitedAt.toISOString() : null,
    days_in_stage: stage.exitedAt ? daysBetween(stage.exitedAt, stage.enteredAt) : null,
  }));

  const stakeholders = bundle.contacts.map((c) => ({
    name: c.name,
    title: c.title,
    role: c.role,
    engaged_at: c.engagedAt ? c.engagedAt.toISOString() : null,
  }));

  const meetingFindings = bundle.meetings.slice(0, MAX_MEETINGS).map((m) => ({
    source_external_id: m.externalId,
    occurred_at: m.occurredAt ? m.occurredAt.toISOString() : null,
    summary: m.summary,
  }));
  for (const n of bundle.notes.slice(0, MAX_MEETINGS)) {
    meetingFindings.push({
      source_external_id: n.externalId,
      occurred_at: n.createdAt ? n.createdAt.toISOString() : null,
      summary: `[internal note] ${n.body}`,
    });
  }

  return {
    deal_context: {
      deal_name: deal.name,
      company_name: deal.companyName,
      industry: deal.industry,
      segment: deal.segment,
      amount: deal.amount,
      currency: deal.currency,
      outcome: deal.outcome,
      sales_cycle_days: salesCycleDays,
    },
    stakeholders: stakeholders.slice(0, MAX_LIST_ITEMS),
    timeline,
    meeting_findings: meetingFindings,
    objections: bundle.objections.slice(0, MAX_LIST_ITEMS),
    requirements: bundle.requirements.slice(0, MAX_LIST_ITEMS),
    competitors: bundle.competitors.slice(0, MAX_LIST_ITEMS),
    commercial_findings: bundle.pricingNotes.slice(0, MAX_LIST_ITEMS),
    activity_patterns: [],
    close_context: {
      close_reason_raw: deal.closeReasonRaw,
      closed_at: deal.closedAt ? deal.closedAt.toISOString() : null,
    },
  };
}
