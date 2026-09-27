"""Turns a raw G8DealBundle into a bounded DealEvidenceBundle safe to send to the LLM.

Rules:
  - Never forward raw transcripts wholesale; meeting summaries only (already short).
  - Cap list lengths so a pathological deal can't blow the prompt budget.
  - Compute sales_cycle_days deterministically here, not by asking the LLM.
"""

from __future__ import annotations

from app.schemas.evidence_bundle import (
    CloseContext,
    DealContext,
    DealEvidenceBundle,
    MeetingFinding,
    StakeholderSummary,
    TimelineEntry,
)
from app.services.graph8.schemas import G8DealBundle

_MAX_MEETINGS = 12
_MAX_LIST_ITEMS = 15


def build_evidence_bundle(bundle: G8DealBundle) -> DealEvidenceBundle:
    deal = bundle.deal

    sales_cycle_days = None
    if deal.opened_at and deal.closed_at:
        sales_cycle_days = (deal.closed_at - deal.opened_at).days

    timeline = []
    for stage in bundle.stage_history:
        days_in_stage = None
        if stage.exited_at:
            days_in_stage = (stage.exited_at - stage.entered_at).days
        timeline.append(
            TimelineEntry(
                stage_name=stage.stage_name,
                entered_at=stage.entered_at.isoformat(),
                exited_at=stage.exited_at.isoformat() if stage.exited_at else None,
                days_in_stage=days_in_stage,
            )
        )

    stakeholders = [
        StakeholderSummary(
            name=c.name,
            title=c.title,
            role=c.role,
            engaged_at=c.engaged_at.isoformat() if c.engaged_at else None,
        )
        for c in bundle.contacts
    ]

    meeting_findings = [
        MeetingFinding(
            source_external_id=m.external_id,
            occurred_at=m.occurred_at.isoformat() if m.occurred_at else None,
            summary=m.summary,
        )
        for m in bundle.meetings[:_MAX_MEETINGS]
    ]
    # Fold note bodies in as additional low-weight findings.
    for n in bundle.notes[:_MAX_MEETINGS]:
        meeting_findings.append(
            MeetingFinding(
                source_external_id=n.external_id,
                occurred_at=n.created_at.isoformat() if n.created_at else None,
                summary=f"[internal note] {n.body}",
            )
        )

    return DealEvidenceBundle(
        deal_context=DealContext(
            company_name=deal.company_name,
            industry=deal.industry,
            segment=deal.segment,
            amount=deal.amount,
            currency=deal.currency,
            outcome=deal.outcome,
            sales_cycle_days=sales_cycle_days,
        ),
        stakeholders=stakeholders[:_MAX_LIST_ITEMS],
        timeline=timeline,
        meeting_findings=meeting_findings,
        objections=bundle.objections[:_MAX_LIST_ITEMS],
        requirements=bundle.requirements[:_MAX_LIST_ITEMS],
        competitors=bundle.competitors[:_MAX_LIST_ITEMS],
        commercial_findings=bundle.pricing_notes[:_MAX_LIST_ITEMS],
        activity_patterns=[],
        close_context=CloseContext(
            close_reason_raw=deal.close_reason_raw,
            closed_at=deal.closed_at.isoformat() if deal.closed_at else None,
        ),
    )
