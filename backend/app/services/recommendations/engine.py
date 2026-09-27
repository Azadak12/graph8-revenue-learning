"""Turns qualifying Patterns into department-specific Recommendations.

Only patterns at EMERGING_PATTERN strength or above generate recommendations —
a ONE_OFF is explicitly not enough evidence to ask a department to act on.
Recommendations never touch Graph8 directly; see recommendations/actions.py for
the human-approval-gated write path.

Two different patterns can independently qualify for the same rule (e.g. a
"missing_decision_maker" pattern scoped to enterprise AND a separate one scoped
to mid_market both trigger the same Sales rule) -- these are deduplicated into
ONE Recommendation per (department, title), attributed to whichever pattern has
the larger lost_count, rather than showing the same advice to Sales twice.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.enums import PatternStrength
from app.models.pattern import Pattern, Recommendation
from app.services.recommendations.rules import rules_for_bucket

_QUALIFYING_STRENGTHS = {
    PatternStrength.EMERGING_PATTERN,
    PatternStrength.RECURRING_PATTERN,
    PatternStrength.STRONG_PATTERN,
}


def refresh_recommendations(session: Session, *, organization_id: uuid.UUID) -> list[Recommendation]:
    patterns = (
        session.query(Pattern)
        .filter(Pattern.organization_id == organization_id, Pattern.pattern_strength.in_(_QUALIFYING_STRENGTHS))
        .all()
    )

    # (department, title) -> (rule, best pattern seen so far)
    best_by_rule: dict[tuple[str, str], tuple[dict, Pattern]] = {}
    for pattern in patterns:
        bucket_key = pattern.segment_definition.get("bucket_key", "")
        for rule in rules_for_bucket(bucket_key):
            key = (rule["department"].value, rule["title"])
            current = best_by_rule.get(key)
            if current is None or pattern.lost_count > current[1].lost_count:
                best_by_rule[key] = (rule, pattern)

    seen_ids: set[uuid.UUID] = set()
    created_or_updated: list[Recommendation] = []
    for (department, title), (rule, pattern) in best_by_rule.items():
        existing = (
            session.query(Recommendation)
            .filter(
                Recommendation.organization_id == organization_id,
                Recommendation.department == rule["department"],
                Recommendation.title == title,
            )
            .one_or_none()
        )
        if existing is None:
            existing = Recommendation(organization_id=organization_id, department=rule["department"], status="proposed")
            session.add(existing)
        existing.pattern_id = pattern.id
        existing.title = rule["title"]
        existing.explanation = rule["explanation"]
        existing.recommended_action = rule["recommended_action"]
        existing.priority = rule["priority"].value
        session.flush()
        seen_ids.add(existing.id)
        created_or_updated.append(existing)

    # Drop recommendations for rules that no longer qualify (e.g. a pattern
    # dropped below EMERGING after a human correction).
    stale_query = session.query(Recommendation).filter(
        Recommendation.organization_id == organization_id, Recommendation.status == "proposed"
    )
    if seen_ids:
        stale_query = stale_query.filter(~Recommendation.id.in_(seen_ids))
    for rec in stale_query.all():
        session.delete(rec)

    session.flush()
    return created_or_updated
