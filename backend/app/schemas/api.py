import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_type: str
    source_external_id: str | None
    source_timestamp: datetime | None
    finding: str
    excerpt: str | None
    strength: str


class FactorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    category: str
    specific_issue: str
    factor_type: str
    confidence: str
    preventability: str
    department: str
    is_primary: bool
    evidence: list[EvidenceOut] = []


class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    analysis_version: int
    outcome: str
    summary: str
    confidence: str
    human_confirmation_required: bool
    status: str
    completed_at: datetime | None
    factors: list[FactorOut] = []


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    title: str | None
    role: str
    engaged_at: datetime | None


class StageEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    stage_name: str
    entered_at: datetime
    exited_at: datetime | None


class WarningOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    pattern_id: uuid.UUID
    explanation: str
    similarity_basis: dict
    status: str


class DealListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    company_name: str
    industry: str
    segment: str
    amount: float
    currency: str
    outcome: str
    closed_at: datetime | None
    analysis_status: str | None = None
    primary_factor_category: str | None = None
    confidence: str | None = None


class DealDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    company_name: str
    industry: str
    segment: str
    amount: float
    currency: str
    outcome: str
    stage_name: str | None
    owner_name: str | None
    opened_at: datetime | None
    closed_at: datetime | None
    contacts: list[ContactOut] = []
    stage_history: list[StageEventOut] = []
    analysis: AnalysisOut | None = None
    warnings: list[WarningOut] = []


class FeedbackIn(BaseModel):
    feedback_type: str
    selected_reason: str | None = None
    override_category: str | None = None
    was_seller_controllable: bool | None = None
    another_vendor_selected: bool | None = None
    comment: str | None = None


class PatternOccurrenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    deal_id: uuid.UUID
    outcome: str


class PatternOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    category: str
    segment_definition: dict
    lost_count: int
    won_count: int
    sample_size: int
    pattern_strength: str
    confidence: str
    status: str
    narrative: str
    first_detected_at: datetime
    last_detected_at: datetime


class PatternDetail(PatternOut):
    occurrences: list[PatternOccurrenceOut] = []


class RecommendationActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    action_type: str
    status: str
    graph8_object_type: str | None
    graph8_object_id: str | None


class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    pattern_id: uuid.UUID
    department: str
    title: str
    explanation: str
    recommended_action: str
    priority: str
    status: str
    actions: list[RecommendationActionOut] = []


class ActionProposeIn(BaseModel):
    action_type: str


class OverviewSummary(BaseModel):
    total_deals_analyzed: int
    won_count: int
    lost_count: int
    awaiting_clarification: int
    executive_summary: list[str]
    emerging_patterns: list[PatternOut]
    focus_areas: list[str]
    recent_learnings: list[str]


class AgentAskIn(BaseModel):
    question: str


class AgentAskOut(BaseModel):
    answer: str
    sources: list[str] = []
    suggested_actions: list[str] = []


class CoachingItemOut(BaseModel):
    category: str
    issue_examples: list[str]
    deal_count: int
    deals: list[dict]
    recurring: bool


class RepPerformanceOut(BaseModel):
    owner_name: str
    total_deals: int
    won: int
    lost: int
    win_rate: int | None
    coaching_items: list[CoachingItemOut]


class Graph8ConnectionOut(BaseModel):
    mode: str
    status: str
    graph8_org_id: str | None
    last_sync_at: str | None


class Graph8ConnectionIn(BaseModel):
    api_key: str
