"""Deterministic won/lost pattern engine.

Given a segment (and optionally an industry), this counts how many closed deals
exhibit each factor "bucket" (see bucketing.py) and turns that into a Pattern row
with a strength/confidence computed by strength.py. Nothing here calls the LLM;
it only reads DealFactor/DealAnalysis/Deal/DealContact/DealSnapshot/HumanFeedback
rows already persisted by the investigation engine.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.analysis import DealAnalysis, DealFactor, HumanFeedback
from app.models.deal import Deal, DealContact, DealSnapshot
from app.models.enums import ContactRole, DealOutcome, DealSegment, FactorCategory
from app.models.pattern import Pattern, PatternOccurrence
from app.services.patterns.bucketing import bucket_definition, bucket_key_for_factor
from app.services.patterns.strength import compute_strength


def _effective_categories_for_deal(session: Session, deal_id: uuid.UUID) -> set[tuple[FactorCategory, str]]:
    """Returns the set of (category, specific_issue) pairs attributed to a deal,
    honoring any human correction over the AI's original classification."""

    analysis = (
        session.query(DealAnalysis)
        .filter(DealAnalysis.deal_id == deal_id, DealAnalysis.is_current == True)  # noqa: E712
        .one_or_none()
    )
    if analysis is None:
        return set()

    feedback = (
        session.query(HumanFeedback)
        .filter(HumanFeedback.analysis_id == analysis.id, HumanFeedback.override_category.isnot(None))
        .order_by(HumanFeedback.created_at.desc())
        .first()
    )
    if feedback is not None:
        return {(feedback.override_category, feedback.selected_reason or feedback.override_category.value)}

    factors = session.query(DealFactor).filter(DealFactor.deal_analysis_id == analysis.id).all()
    return {(f.category, f.specific_issue) for f in factors}


def _factor_bucket_stats(
    session: Session, organization_id: uuid.UUID, deals: list[Deal]
) -> dict[str, dict]:
    """bucket_key -> {lost_deal_ids: set, won_deal_ids: set}"""

    stats: dict[str, dict] = defaultdict(lambda: {"lost": set(), "won": set()})
    for deal in deals:
        if deal.outcome not in (DealOutcome.WON, DealOutcome.LOST):
            continue
        cohort = "lost" if deal.outcome == DealOutcome.LOST else "won"
        for category, issue in _effective_categories_for_deal(session, deal.id):
            key = bucket_key_for_factor(category, issue)
            stats[key][cohort].add(deal.id)
    return stats


def _decision_maker_late_deal_ids(session: Session, deals: list[Deal]) -> set[uuid.UUID]:
    late: set[uuid.UUID] = set()
    for deal in deals:
        contacts = session.query(DealContact).filter(
            DealContact.deal_id == deal.id, DealContact.role == ContactRole.DECISION_MAKER
        ).all()
        proposal_snapshot = (
            session.query(DealSnapshot)
            .filter(DealSnapshot.deal_id == deal.id, DealSnapshot.stage_name.ilike("%proposal%"))
            .order_by(DealSnapshot.entered_at)
            .first()
        )
        if not contacts:
            late.add(deal.id)
            continue
        earliest_engaged = min((c.engaged_at for c in contacts if c.engaged_at), default=None)
        if earliest_engaged is None:
            late.add(deal.id)
            continue
        if proposal_snapshot and earliest_engaged >= proposal_snapshot.entered_at:
            late.add(deal.id)
    return late


def _upsert_pattern(
    session: Session,
    *,
    organization_id: uuid.UUID,
    category: FactorCategory,
    bucket_key: str,
    segment_definition: dict,
    lost_ids: set[uuid.UUID],
    won_ids: set[uuid.UUID],
    total_lost: int,
    total_won: int,
) -> Pattern | None:
    settings = get_settings()
    result = compute_strength(
        lost_with_factor=len(lost_ids),
        won_with_factor=len(won_ids),
        total_lost=total_lost,
        total_won=total_won,
        settings=settings,
    )
    if result is None:
        return None
    strength, confidence = result

    definition = bucket_definition(bucket_key)
    narrative = definition["narrative"].format(
        lost_count=len(lost_ids),
        won_count=len(won_ids),
        total_lost=total_lost,
        total_won=total_won,
        industry=segment_definition.get("industry", ""),
        segment=segment_definition.get("segment", "").replace("_", "-"),
    )

    # Keyed on (category, bucket_key, AND the segment scope) -- two different
    # segments (e.g. enterprise vs. mid_market) can each have their own
    # independent "missing_decision_maker" pattern; without the scope in the
    # lookup key they'd collapse into one shared row that whichever segment's
    # refresh ran last would silently overwrite.
    existing = (
        session.query(Pattern)
        .filter(Pattern.organization_id == organization_id, Pattern.category == category)
        .all()
    )
    pattern = next(
        (
            p
            for p in existing
            if p.segment_definition.get("bucket_key") == bucket_key
            and p.segment_definition.get("segment") == segment_definition.get("segment")
            and p.segment_definition.get("industry") == segment_definition.get("industry")
        ),
        None,
    )
    now = datetime.now(timezone.utc)
    if pattern is None:
        pattern = Pattern(
            organization_id=organization_id,
            name=definition["name"],
            category=category,
            segment_definition={**segment_definition, "bucket_key": bucket_key},
            first_detected_at=now,
        )
        session.add(pattern)

    pattern.lost_count = len(lost_ids)
    pattern.won_count = len(won_ids)
    pattern.sample_size = total_lost + total_won
    pattern.pattern_strength = strength
    pattern.confidence = confidence
    pattern.narrative = narrative
    pattern.last_detected_at = now
    session.flush()

    session.query(PatternOccurrence).filter(PatternOccurrence.pattern_id == pattern.id).delete()
    for deal_id in lost_ids:
        session.add(PatternOccurrence(pattern_id=pattern.id, deal_id=deal_id, outcome="lost"))
    for deal_id in won_ids:
        session.add(PatternOccurrence(pattern_id=pattern.id, deal_id=deal_id, outcome="won"))

    return pattern


def _bucket_key_to_category(bucket_key: str) -> FactorCategory:
    mapping = {
        "scim_provisioning": FactorCategory.PRODUCT_CAPABILITY_GAP,
        "pricing_packaging": FactorCategory.PRICING,
        "missing_decision_maker": FactorCategory.MISSING_DECISION_MAKER,
        "competitor": FactorCategory.COMPETITOR,
        "proposal_delay": FactorCategory.PROPOSAL_DELAY,
    }
    if bucket_key in mapping:
        return mapping[bucket_key]
    try:
        return FactorCategory(bucket_key)
    except ValueError:
        return FactorCategory.OTHER


def refresh_patterns_for_segment(
    session: Session, *, organization_id: uuid.UUID, industry: str, segment: DealSegment
) -> list[Pattern]:
    """Recompute patterns touching this (industry, segment) — called after any
    new/updated DealAnalysis. Computes both the industry+segment grain and the
    broader segment-only grain, since different bucket types want different
    grains (see bucketing.BUCKET_DEFINITIONS)."""

    patterns: list[Pattern] = []

    industry_segment_deals = (
        session.query(Deal)
        .filter(
            Deal.organization_id == organization_id,
            Deal.industry == industry,
            Deal.segment == segment,
            Deal.outcome.in_([DealOutcome.WON, DealOutcome.LOST]),
        )
        .all()
    )
    segment_only_deals = (
        session.query(Deal)
        .filter(
            Deal.organization_id == organization_id,
            Deal.segment == segment,
            Deal.outcome.in_([DealOutcome.WON, DealOutcome.LOST]),
        )
        .all()
    )

    total_lost_is = sum(1 for d in industry_segment_deals if d.outcome == DealOutcome.LOST)
    total_won_is = sum(1 for d in industry_segment_deals if d.outcome == DealOutcome.WON)
    total_lost_s = sum(1 for d in segment_only_deals if d.outcome == DealOutcome.LOST)
    total_won_s = sum(1 for d in segment_only_deals if d.outcome == DealOutcome.WON)

    is_stats = _factor_bucket_stats(session, organization_id, industry_segment_deals)
    s_stats = _factor_bucket_stats(session, organization_id, segment_only_deals)

    seen_bucket_keys = set(is_stats) | set(s_stats)
    for bucket_key in seen_bucket_keys:
        grain = bucket_definition(bucket_key)["grain"]
        if grain == "industry_segment":
            stat = is_stats.get(bucket_key, {"lost": set(), "won": set()})
            seg_def = {"industry": industry, "segment": segment.value}
            total_lost, total_won = total_lost_is, total_won_is
        else:
            stat = s_stats.get(bucket_key, {"lost": set(), "won": set()})
            seg_def = {"segment": segment.value}
            total_lost, total_won = total_lost_s, total_won_s

        pattern = _upsert_pattern(
            session,
            organization_id=organization_id,
            category=_bucket_key_to_category(bucket_key),
            bucket_key=bucket_key,
            segment_definition=seg_def,
            lost_ids=stat["lost"],
            won_ids=stat["won"],
            total_lost=total_lost,
            total_won=total_won,
        )
        if pattern:
            patterns.append(pattern)

    # Decision-maker timing: deterministic, computed at the segment-only grain.
    late_ids = _decision_maker_late_deal_ids(session, segment_only_deals)
    lost_late = {d.id for d in segment_only_deals if d.outcome == DealOutcome.LOST and d.id in late_ids}
    won_late = {d.id for d in segment_only_deals if d.outcome == DealOutcome.WON and d.id in late_ids}
    pattern = _upsert_pattern(
        session,
        organization_id=organization_id,
        category=FactorCategory.MISSING_DECISION_MAKER,
        bucket_key="missing_decision_maker",
        segment_definition={"segment": segment.value},
        lost_ids=lost_late,
        won_ids=won_late,
        total_lost=total_lost_s,
        total_won=total_won_s,
    )
    if pattern:
        patterns.append(pattern)

    session.flush()
    return patterns
