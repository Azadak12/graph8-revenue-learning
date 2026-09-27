"""Groups DealFactor rows into human-legible "pattern buckets".

Deliberately coarser than the raw factor taxonomy: several categories/issues that
tell the same business story (SCIM vs. "identity provisioning", pricing vs.
packaging) are folded into one bucket so the pattern engine can accumulate enough
sample size to say something meaningful, instead of fragmenting evidence across
near-duplicate buckets of size 1.
"""

from __future__ import annotations

from app.models.enums import FactorCategory

# bucket_key -> (display name, narrative template, grain)
# grain "industry_segment" = pattern computed within one industry+segment pair
# grain "segment"          = pattern computed across all industries within a segment
BUCKET_DEFINITIONS: dict[str, dict] = {
    "scim_provisioning": {
        "name": "SCIM / identity provisioning gap",
        "grain": "industry_segment",
        "narrative": (
            "SCIM / automated identity-provisioning requirements have repeatedly appeared in lost "
            "{industry} {segment} deals ({lost_count} of {total_lost} lost deals analyzed), and do not "
            "appear as an issue in any of the {total_won} won deals in the same segment "
            "({won_count} comparable wins)."
        ),
    },
    "pricing_packaging": {
        "name": "Pricing & packaging friction",
        "grain": "segment",
        "narrative": (
            "Pricing or packaging friction (rigid bundles, list price above budget, inflexible contract "
            "terms) appears in {lost_count} of {total_lost} lost {segment} deals analyzed, versus "
            "{won_count} of {total_won} won {segment} deals."
        ),
    },
    "missing_decision_maker": {
        "name": "Decision maker engaged late",
        "grain": "segment",
        "narrative": (
            "Among {segment} deals, the economic/technical decision maker engaged only late in the "
            "cycle (at or after the Proposal stage) or never at all in {lost_count} of {total_lost} lost "
            "deals, versus {won_count} of {total_won} won deals."
        ),
    },
    "competitor": {
        "name": "Competitive losses",
        "grain": "industry_segment",
        "narrative": (
            "{lost_count} of {total_lost} lost {industry} {segment} deals cite a named competitor as the "
            "deciding factor, versus {won_count} of {total_won} won deals."
        ),
    },
    "proposal_delay": {
        "name": "Internal proposal delay",
        "grain": "segment",
        "narrative": (
            "Internal delays getting a proposal out appear in {lost_count} of {total_lost} lost "
            "{segment} deals analyzed, versus {won_count} of {total_won} won deals."
        ),
    },
}

_DEFAULT_GRAIN = "industry_segment"


def bucket_key_for_factor(category: FactorCategory, specific_issue: str) -> str:
    issue_lower = specific_issue.lower()
    if "scim" in issue_lower or "provisioning" in issue_lower:
        return "scim_provisioning"
    if category in (FactorCategory.PRICING, FactorCategory.PACKAGING):
        return "pricing_packaging"
    if category == FactorCategory.MISSING_DECISION_MAKER:
        return "missing_decision_maker"
    if category == FactorCategory.COMPETITOR:
        return "competitor"
    if category == FactorCategory.PROPOSAL_DELAY:
        return "proposal_delay"
    return category.value


def bucket_definition(bucket_key: str) -> dict:
    return BUCKET_DEFINITIONS.get(
        bucket_key,
        {"name": bucket_key.replace("_", " ").title(), "grain": _DEFAULT_GRAIN, "narrative": (
            "{lost_count} of {total_lost} lost {industry} {segment} deals analyzed show this factor, "
            "versus {won_count} of {total_won} won deals."
        )},
    )
