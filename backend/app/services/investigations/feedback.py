"""Applies salesperson clarification / correction to an existing DealAnalysis.

Additive by design: the original AI analysis (DealFactor rows, confidence, etc.)
is never overwritten -- a HumanFeedback row layers on top, and the pattern engine
already knows to prefer feedback.override_category over the AI's classification
when it exists (see patterns/engine._effective_categories_for_deal).
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.analysis import DealAnalysis, HumanFeedback
from app.models.deal import Deal
from app.models.enums import AnalysisStatus, ConfidenceLevel, FactorCategory
from app.services.patterns.engine import refresh_patterns_for_segment
from app.services.recommendations.engine import refresh_recommendations

_REASON_TO_CATEGORY = {
    "pricing": FactorCategory.PRICING,
    "missing_capability": FactorCategory.PRODUCT_CAPABILITY_GAP,
    "competitor": FactorCategory.COMPETITOR,
    "security_compliance": FactorCategory.SECURITY,
    "budget_timing": FactorCategory.BUDGET,
    "buyer_cancelled_internally": FactorCategory.BUYER_PROJECT_CANCELLED,
    "stakeholder_issue": FactorCategory.STAKEHOLDER_MISALIGNMENT,
    "other": FactorCategory.OTHER,
}


def submit_feedback(
    session: Session,
    *,
    organization_id: uuid.UUID,
    deal: Deal,
    analysis: DealAnalysis,
    user_id: uuid.UUID | None,
    feedback_type: str,
    selected_reason: str | None,
    override_category: str | None,
    was_seller_controllable: bool | None,
    another_vendor_selected: bool | None,
    comment: str | None,
) -> HumanFeedback:
    resolved_category = None
    if override_category:
        resolved_category = FactorCategory(override_category)
    elif selected_reason and selected_reason in _REASON_TO_CATEGORY:
        resolved_category = _REASON_TO_CATEGORY[selected_reason]

    feedback = HumanFeedback(
        organization_id=organization_id,
        deal_id=deal.id,
        analysis_id=analysis.id,
        user_id=user_id,
        feedback_type=feedback_type,
        selected_reason=selected_reason,
        override_category=resolved_category,
        was_seller_controllable=was_seller_controllable,
        another_vendor_selected=another_vendor_selected,
        comment=comment,
    )
    session.add(feedback)

    if analysis.status == AnalysisStatus.NEEDS_CLARIFICATION:
        analysis.status = AnalysisStatus.COMPLETED
        analysis.confidence = ConfidenceLevel.MEDIUM
        analysis.human_confirmation_required = False
        if resolved_category and (not analysis.summary or analysis.confidence == ConfidenceLevel.UNKNOWN):
            analysis.summary = (
                f"{analysis.summary} Updated after rep clarification: {comment or selected_reason or ''}"
            ).strip()

    session.flush()

    refresh_patterns_for_segment(
        session, organization_id=organization_id, industry=deal.industry, segment=deal.segment
    )
    refresh_recommendations(session, organization_id=organization_id)

    return feedback
