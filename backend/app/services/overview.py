"""Builds the Overview page payload from already-computed structured data.

Never recomputes analytics from scratch here -- reads Deal/DealAnalysis/Pattern
rows that the investigation, pattern, and recommendation engines already wrote.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.analysis import DealAnalysis
from app.models.deal import Deal
from app.models.enums import AnalysisStatus, DealOutcome, PatternStrength
from app.models.pattern import Pattern
from app.schemas.api import OverviewSummary, PatternOut

_QUALIFYING_STRENGTHS = {
    PatternStrength.EMERGING_PATTERN,
    PatternStrength.RECURRING_PATTERN,
    PatternStrength.STRONG_PATTERN,
}


def build_overview(session: Session, *, organization_id: uuid.UUID) -> OverviewSummary:
    deals = session.query(Deal).filter(Deal.organization_id == organization_id).all()
    won = sum(1 for d in deals if d.outcome == DealOutcome.WON)
    lost = sum(1 for d in deals if d.outcome == DealOutcome.LOST)

    awaiting = (
        session.query(DealAnalysis)
        .filter(
            DealAnalysis.organization_id == organization_id,
            DealAnalysis.is_current == True,  # noqa: E712
            DealAnalysis.status == AnalysisStatus.NEEDS_CLARIFICATION,
        )
        .count()
    )

    patterns = (
        session.query(Pattern)
        .filter(Pattern.organization_id == organization_id, Pattern.pattern_strength.in_(_QUALIFYING_STRENGTHS))
        .order_by(Pattern.lost_count.desc())
        .all()
    )

    executive_summary = [p.narrative for p in patterns[:4]]
    if not executive_summary:
        executive_summary = [
            "Not enough closed deals analyzed yet to surface organization-wide patterns."
        ]

    focus_departments: dict[str, int] = {}
    for pattern in patterns:
        for rec in pattern.recommendations:
            focus_departments[rec.department.value] = focus_departments.get(rec.department.value, 0) + 1
    focus_areas = [d for d, _ in sorted(focus_departments.items(), key=lambda kv: -kv[1])][:5]

    recent_learnings = [p.narrative for p in patterns[:6]]

    return OverviewSummary(
        total_deals_analyzed=won + lost,
        won_count=won,
        lost_count=lost,
        awaiting_clarification=awaiting,
        executive_summary=executive_summary,
        emerging_patterns=[PatternOut.model_validate(p) for p in patterns],
        focus_areas=focus_areas,
        recent_learnings=recent_learnings,
    )
