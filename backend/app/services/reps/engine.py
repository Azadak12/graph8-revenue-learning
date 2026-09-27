"""Per-rep ("closer") coaching insights.

Deliberately narrower than the org-wide pattern engine: instead of asking "is
this a real segment-wide pattern," it asks "does this one rep's own closed deals
show a repeated, seller-controllable issue worth coaching on." Scope is limited
to factors tagged `department in {SALES, SALES_ENGINEERING}` AND
`preventability in {PREVENTABLE, POTENTIALLY_PREVENTABLE}` -- i.e. things a rep
could plausibly have done differently (discovery, follow-up speed,
communication, stakeholder coverage), never product/pricing/leadership-owned
factors, and never anything already marked not_preventable (e.g. a buyer's
budget freeze) or unknown.

Computed on demand from already-persisted DealFactor/Deal rows -- no new table,
same "deterministic code computes counts, not the LLM" rule as the pattern
engine.
"""

from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.analysis import DealAnalysis, DealFactor
from app.models.deal import Deal
from app.models.enums import Department, DealOutcome, Preventability

_COACHABLE_DEPARTMENTS = {Department.SALES, Department.SALES_ENGINEERING}
_COACHABLE_PREVENTABILITY = {Preventability.PREVENTABLE, Preventability.POTENTIALLY_PREVENTABLE}


def _effective_categories_for_deal(session: Session, deal_id: uuid.UUID) -> dict[str, str]:
    """category -> specific_issue, deduped per deal.

    A single factor can be tagged with multiple coachable departments (e.g. both
    "sales" and "sales_engineering"), which persists as multiple DealFactor rows
    for the same category on the same deal -- without this dedup, that one
    finding would be double-counted as if it happened on two separate deals.
    """
    analysis = (
        session.query(DealAnalysis)
        .filter(DealAnalysis.deal_id == deal_id, DealAnalysis.is_current == True)  # noqa: E712
        .one_or_none()
    )
    if analysis is None:
        return {}
    factors = (
        session.query(DealFactor)
        .filter(
            DealFactor.deal_analysis_id == analysis.id,
            DealFactor.department.in_(_COACHABLE_DEPARTMENTS),
            DealFactor.preventability.in_(_COACHABLE_PREVENTABILITY),
        )
        .all()
    )
    return {f.category.value: f.specific_issue for f in factors}


def build_rep_performance(session: Session, *, organization_id: uuid.UUID) -> list[dict]:
    deals = (
        session.query(Deal)
        .filter(
            Deal.organization_id == organization_id,
            Deal.outcome.in_([DealOutcome.WON, DealOutcome.LOST]),
            Deal.owner_name.isnot(None),
        )
        .all()
    )

    by_owner: dict[str, list[Deal]] = defaultdict(list)
    for deal in deals:
        by_owner[deal.owner_name].append(deal)

    reps = []
    for owner_name, owner_deals in by_owner.items():
        won = sum(1 for d in owner_deals if d.outcome == DealOutcome.WON)
        lost = sum(1 for d in owner_deals if d.outcome == DealOutcome.LOST)
        total = won + lost

        # category -> {issue examples, deals}
        buckets: dict[str, dict] = defaultdict(lambda: {"issues": set(), "deals": []})
        for deal in owner_deals:
            if deal.outcome != DealOutcome.LOST:
                continue
            for category, specific_issue in _effective_categories_for_deal(session, deal.id).items():
                bucket = buckets[category]
                bucket["issues"].add(specific_issue)
                bucket["deals"].append({"id": str(deal.id), "company_name": deal.company_name})

        coaching_items = []
        for category, data in buckets.items():
            coaching_items.append(
                {
                    "category": category,
                    "issue_examples": sorted(data["issues"])[:3],
                    "deal_count": len(data["deals"]),
                    "deals": data["deals"],
                    "recurring": len(data["deals"]) >= 2,
                }
            )
        coaching_items.sort(key=lambda c: c["deal_count"], reverse=True)

        reps.append(
            {
                "owner_name": owner_name,
                "total_deals": total,
                "won": won,
                "lost": lost,
                "win_rate": round(won / total * 100) if total > 0 else None,
                "coaching_items": coaching_items,
            }
        )

    reps.sort(key=lambda r: sum(c["deal_count"] for c in r["coaching_items"]), reverse=True)
    return reps
