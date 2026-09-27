"""Future Deal Warnings: organizational memory applied to active deals.

Matches an active deal's structured attributes (industry, segment) against
Patterns already detected from closed deals. Deliberately does NOT produce a
win-probability score or say "you will lose this deal" — only a contextual,
explainable warning plus a recommended discovery action.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.enums import PatternStatus, PatternStrength
from app.models.pattern import FutureDealWarning, Pattern
from app.services.graph8.base import Graph8Provider
from app.services.graph8.sync import sync_deal

_QUALIFYING_STRENGTHS = {
    PatternStrength.EMERGING_PATTERN,
    PatternStrength.RECURRING_PATTERN,
    PatternStrength.STRONG_PATTERN,
}

# For these buckets, if the active deal's known requirements already mention the
# relevant keyword, the risk is already being tracked -- don't warn again.
_RESOLVED_IF_REQUIREMENT_MENTIONS = {
    "scim_provisioning": ["scim", "provisioning"],
}


def _pattern_matches_deal(pattern: Pattern, industry: str, segment: str) -> bool:
    seg_def = pattern.segment_definition
    if "industry" in seg_def:
        return seg_def["industry"] == industry and seg_def.get("segment") == segment
    return seg_def.get("segment") == segment


def refresh_future_warnings(
    session: Session, *, organization_id: uuid.UUID, provider: Graph8Provider
) -> list[FutureDealWarning]:
    active_g8_deals = provider.list_active_deals()
    patterns = (
        session.query(Pattern)
        .filter(
            Pattern.organization_id == organization_id,
            Pattern.status == PatternStatus.ACTIVE,
            Pattern.pattern_strength.in_(_QUALIFYING_STRENGTHS),
        )
        .all()
    )

    created: list[FutureDealWarning] = []
    for g8_deal in active_g8_deals:
        deal, bundle = sync_deal(session, organization_id, provider, g8_deal.external_id)

        for pattern in patterns:
            if not _pattern_matches_deal(pattern, deal.industry, deal.segment.value):
                continue

            bucket_key = pattern.segment_definition.get("bucket_key", "")
            resolved_keywords = _RESOLVED_IF_REQUIREMENT_MENTIONS.get(bucket_key)
            if resolved_keywords and any(
                kw in r.lower() for r in bundle.requirements for kw in resolved_keywords
            ):
                continue

            existing = (
                session.query(FutureDealWarning)
                .filter(FutureDealWarning.deal_id == deal.id, FutureDealWarning.pattern_id == pattern.id)
                .one_or_none()
            )
            if existing and existing.status in ("acknowledged", "dismissed", "task_created"):
                continue

            if existing is None:
                existing = FutureDealWarning(
                    organization_id=organization_id, deal_id=deal.id, pattern_id=pattern.id, status="open"
                )
                session.add(existing)

            existing.explanation = (
                f"{pattern.narrative} This deal shares the same industry/segment profile."
            )
            existing.similarity_basis = {
                "industry": deal.industry,
                "segment": deal.segment.value,
                "pattern_id": str(pattern.id),
                "pattern_name": pattern.name,
            }
            created.append(existing)

    session.flush()
    return created
