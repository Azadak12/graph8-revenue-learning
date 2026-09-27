/** Provider-agnostic Graph8 data shapes. Ported from
 * backend/app/services/graph8/schemas.py. */

export interface G8Contact {
  externalId: string;
  name: string;
  title: string | null;
  role: string;
  engagedAt: Date | null;
}

export interface G8StageEvent {
  stageId: string;
  stageName: string;
  enteredAt: Date;
  exitedAt: Date | null;
}

export interface G8Meeting {
  externalId: string;
  occurredAt: Date | null;
  summary: string;
  transcriptExcerpt?: string | null;
}

export interface G8Note {
  externalId: string;
  createdAt: Date | null;
  body: string;
}

export interface G8Deal {
  externalId: string;
  name: string;
  companyName: string;
  industry: string;
  segment: string;
  amount: number;
  currency: string;
  pipelineId: string | null;
  stageId: string | null;
  stageName: string | null;
  ownerName: string | null;
  outcome: string;
  closeReasonRaw: string | null;
  openedAt: Date | null;
  closedAt: Date | null;
}

export interface G8DealBundle {
  deal: G8Deal;
  contacts: G8Contact[];
  stageHistory: G8StageEvent[];
  meetings: G8Meeting[];
  notes: G8Note[];
  objections: string[];
  requirements: string[];
  competitors: string[];
  pricingNotes: string[];
  followUpDelayDays?: number | null;
}
