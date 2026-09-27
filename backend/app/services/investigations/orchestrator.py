"""Runs the full investigation pipeline for one closed deal.

DEAL -> OUTCOME -> EVIDENCE -> FACTORS -> (persist) -> pattern refresh ->
recommendation refresh -> future-warning refresh.

Deterministic bookkeeping (versioning, status, tenant scoping) lives here in
plain Python; only the factor/evidence extraction step delegates to the LLM.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.analysis import DealAnalysis, DealEvidence, DealFactor
from app.models.enums import AnalysisStatus, ConfidenceLevel, DealOutcome
from app.models.audit import AuditLog
from app.services.evidence.normalize import build_evidence_bundle
from app.services.graph8.base import Graph8Provider
from app.services.graph8.sync import sync_deal
from app.services.investigations.clarification import create_clarification_task
from app.services.investigations.llm.factory import get_extractor
from app.services.patterns.engine import refresh_patterns_for_segment
from app.services.recommendations.engine import refresh_recommendations
from app.services.warnings.engine import refresh_future_warnings

logger = get_logger(__name__)


def run_investigation(
    session: Session, *, organization_id: uuid.UUID, provider: Graph8Provider, graph8_deal_id: str
) -> DealAnalysis | None:
    settings = get_settings()
    deal, g8_bundle = sync_deal(session, organization_id, provider, graph8_deal_id)

    if deal.outcome == DealOutcome.OPEN:
        # Expected, not exceptional: Graph8 has no deal.lost event (confirmed against a
        # live account 2026-09-27), so webhooks.py enqueues on deal.updated/
        # deal.stage_changed too, on the chance a delivery represents a loss. Most such
        # deliveries are still-open deals (a stage move that isn't a close) -- a quiet
        # no-op, not an error.
        logger.info("investigation_skipped_deal_still_open", deal_id=str(deal.id))
        return None

    evidence_bundle = build_evidence_bundle(g8_bundle)
    extractor = get_extractor()

    session.query(DealAnalysis).filter(
        DealAnalysis.organization_id == organization_id,
        DealAnalysis.deal_id == deal.id,
        DealAnalysis.is_current == True,  # noqa: E712
    ).update({"is_current": False})

    prior_version = (
        session.query(DealAnalysis)
        .filter(DealAnalysis.organization_id == organization_id, DealAnalysis.deal_id == deal.id)
        .count()
    )

    analysis = DealAnalysis(
        organization_id=organization_id,
        deal_id=deal.id,
        analysis_version=prior_version + 1,
        prompt_version=settings.analysis_prompt_version,
        model_identifier=extractor.model_identifier,
        taxonomy_version=settings.taxonomy_version,
        outcome=deal.outcome.value,
        summary="",
        confidence=ConfidenceLevel.UNKNOWN,
        status=AnalysisStatus.PROCESSING,
        is_current=True,
    )
    session.add(analysis)
    session.flush()

    try:
        extraction = extractor.extract(evidence_bundle, graph8_deal_id=graph8_deal_id)
    except Exception:
        logger.exception("investigation_extraction_failed", deal_id=str(deal.id))
        analysis.status = AnalysisStatus.FAILED
        analysis.summary = "Analysis failed due to an internal error. It will be retried."
        session.flush()
        return analysis

    analysis.summary = extraction.summary
    analysis.confidence = ConfidenceLevel(extraction.overall_confidence)
    analysis.human_confirmation_required = extraction.human_confirmation_required
    analysis.status = (
        AnalysisStatus.NEEDS_CLARIFICATION
        if extraction.human_confirmation_required
        else AnalysisStatus.COMPLETED
    )
    analysis.completed_at = datetime.now(timezone.utc)

    all_extracted = []
    if extraction.primary_factor:
        all_extracted.append((extraction.primary_factor, True))
    for f in extraction.secondary_factors:
        all_extracted.append((f, False))

    primary_factor_row = None
    for extracted, is_primary in all_extracted:
        for department in extracted.departments:
            factor = DealFactor(
                organization_id=organization_id,
                deal_analysis_id=analysis.id,
                category=extracted.category,
                specific_issue=extracted.specific_issue,
                factor_type="primary" if is_primary else "secondary",
                confidence=extracted.confidence,
                preventability=extracted.preventability,
                department=department,
                is_primary=is_primary,
            )
            session.add(factor)
            session.flush()
            if is_primary and primary_factor_row is None:
                primary_factor_row = factor

            for ev in extracted.evidence:
                session.add(
                    DealEvidence(
                        organization_id=organization_id,
                        deal_id=deal.id,
                        analysis_id=analysis.id,
                        factor_id=factor.id,
                        source_type=ev.source_type,
                        source_external_id=ev.source_external_id,
                        finding=ev.finding,
                        excerpt=ev.excerpt,
                        strength=ev.strength,
                    )
                )

    if primary_factor_row:
        analysis.primary_factor_id = primary_factor_row.id

    session.flush()

    if analysis.status == AnalysisStatus.NEEDS_CLARIFICATION:
        try:
            task_id = create_clarification_task(provider, deal, analysis)
            session.add(
                AuditLog(
                    organization_id=organization_id,
                    action="create_clarification_task",
                    entity_type="deal_analysis",
                    entity_id=str(analysis.id),
                    log_metadata={"graph8_task_id": task_id},
                )
            )
        except Exception:
            logger.exception("clarification_task_creation_failed", deal_id=str(deal.id))

    refresh_patterns_for_segment(
        session, organization_id=organization_id, industry=deal.industry, segment=deal.segment
    )
    refresh_recommendations(session, organization_id=organization_id)
    refresh_future_warnings(session, organization_id=organization_id, provider=provider)

    return analysis
