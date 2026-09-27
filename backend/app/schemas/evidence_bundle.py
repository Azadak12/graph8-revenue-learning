"""DealEvidenceBundle: the normalized, size-bounded payload sent to the LLM.

Never send raw Graph8 API responses to the model. Everything here is already
truncated/summarized by the evidence normalization step (services/evidence).
"""

from pydantic import BaseModel


class StakeholderSummary(BaseModel):
    name: str
    title: str | None = None
    role: str
    engaged_at: str | None = None


class TimelineEntry(BaseModel):
    stage_name: str
    entered_at: str
    exited_at: str | None = None
    days_in_stage: int | None = None


class MeetingFinding(BaseModel):
    source_external_id: str | None = None
    occurred_at: str | None = None
    summary: str


class DealContext(BaseModel):
    company_name: str
    industry: str
    segment: str
    amount: float
    currency: str
    outcome: str
    sales_cycle_days: int | None = None


class CloseContext(BaseModel):
    close_reason_raw: str | None = None
    closed_at: str | None = None


class DealEvidenceBundle(BaseModel):
    deal_context: DealContext
    stakeholders: list[StakeholderSummary] = []
    timeline: list[TimelineEntry] = []
    meeting_findings: list[MeetingFinding] = []
    objections: list[str] = []
    requirements: list[str] = []
    competitors: list[str] = []
    commercial_findings: list[str] = []
    activity_patterns: list[str] = []
    close_context: CloseContext
