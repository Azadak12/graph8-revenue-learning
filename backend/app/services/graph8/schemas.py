"""Provider-agnostic Graph8 data shapes.

Both DemoGraph8Provider and LiveGraph8Provider return these dataclasses. Business
logic (investigation engine, pattern engine, API routers) only ever imports from
this module — never from demo_provider or live_provider directly.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class G8Contact:
    external_id: str
    name: str
    title: str | None
    role: str  # champion/decision_maker/influencer/blocker/coach/end_user/unknown
    engaged_at: datetime | None


@dataclass
class G8StageEvent:
    stage_id: str
    stage_name: str
    entered_at: datetime
    exited_at: datetime | None


@dataclass
class G8Meeting:
    external_id: str
    occurred_at: datetime | None
    summary: str
    transcript_excerpt: str | None = None


@dataclass
class G8Note:
    external_id: str
    created_at: datetime | None
    body: str


@dataclass
class G8Deal:
    external_id: str
    name: str
    company_name: str
    industry: str
    segment: str  # enterprise/mid_market/smb
    amount: float
    currency: str
    pipeline_id: str | None
    stage_id: str | None
    stage_name: str | None
    owner_name: str | None
    outcome: str  # open/won/lost
    close_reason_raw: str | None
    opened_at: datetime | None
    closed_at: datetime | None


@dataclass
class G8DealBundle:
    """Everything the investigation engine needs to build a DealEvidenceBundle."""

    deal: G8Deal
    contacts: list[G8Contact] = field(default_factory=list)
    stage_history: list[G8StageEvent] = field(default_factory=list)
    meetings: list[G8Meeting] = field(default_factory=list)
    notes: list[G8Note] = field(default_factory=list)
    objections: list[str] = field(default_factory=list)
    requirements: list[str] = field(default_factory=list)
    competitors: list[str] = field(default_factory=list)
    pricing_notes: list[str] = field(default_factory=list)
    follow_up_delay_days: int | None = None


@dataclass
class G8WebhookEvent:
    external_event_id: str
    event_type: str
    graph8_deal_id: str
    received_at: datetime
    raw_payload: dict
