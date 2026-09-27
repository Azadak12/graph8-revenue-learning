"""Maps a pattern bucket to department-specific recommended actions.

This is deliberately rule-based, not LLM-generated: recommendations are business
actions with real consequences (they can create Graph8 tasks), so their wording
is authored and reviewed like product copy, not sampled from a model.
"""

from __future__ import annotations

from app.models.enums import Department, RecommendationPriority

RECOMMENDATION_RULES: dict[str, list[dict]] = {
    "scim_provisioning": [
        {
            "department": Department.PRODUCT,
            "title": "Evaluate SCIM / automated provisioning for enterprise accounts",
            "explanation": (
                "SCIM has repeatedly appeared as a blocker in enterprise financial-services "
                "opportunities. It's worth evaluating whether SCIM 2.0 support belongs on the "
                "near-term roadmap for this segment."
            ),
            "recommended_action": "Assess SCIM 2.0 support against the enterprise roadmap and vendor-review requirements seen in this segment.",
            "priority": RecommendationPriority.HIGH,
        },
        {
            "department": Department.SALES_ENGINEERING,
            "title": "Add identity-provisioning discovery earlier",
            "explanation": (
                "In several lost deals, the provisioning/SCIM requirement wasn't raised until "
                "technical evaluation or later, leaving no time to address it."
            ),
            "recommended_action": "Add an identity-management / provisioning question to the standard technical discovery checklist.",
            "priority": RecommendationPriority.MEDIUM,
        },
        {
            "department": Department.SALES,
            "title": "Confirm provisioning expectations before technical evaluation",
            "explanation": "Confirming this early avoids investing a full cycle in a deal with an unresolvable technical gap.",
            "recommended_action": "Ask about SSO/SCIM and identity-provider requirements during discovery for enterprise financial-services prospects.",
            "priority": RecommendationPriority.MEDIUM,
        },
    ],
    "pricing_packaging": [
        {
            "department": Department.PRICING,
            "title": "Introduce modular / tiered packaging for mid-market",
            "explanation": (
                "Mid-market losses cluster around rigid packaging (full-suite-only bundles, "
                "annual-only terms) that doesn't match buyer budgets or cycles."
            ),
            "recommended_action": "Evaluate a modular or tiered package, and a monthly/quarterly billing option, for the mid-market segment.",
            "priority": RecommendationPriority.HIGH,
        },
        {
            "department": Department.SALES,
            "title": "Qualify budget and economic buyer earlier in mid-market deals",
            "explanation": "Several mid-market losses had no economic buyer engaged before the pricing conversation happened.",
            "recommended_action": "Add a budget/economic-buyer qualification step before sending a mid-market proposal.",
            "priority": RecommendationPriority.MEDIUM,
        },
    ],
    "missing_decision_maker": [
        {
            "department": Department.SALES,
            "title": "Introduce decision-maker validation before Proposal",
            "explanation": (
                "Won deals in this segment consistently had the economic/technical decision maker "
                "engaged well before the Proposal stage; lost deals often didn't."
            ),
            "recommended_action": "Require confirmation that the economic/technical decision maker has been identified and engaged before a deal can move to Proposal.",
            "priority": RecommendationPriority.HIGH,
        },
        {
            "department": Department.LEADERSHIP,
            "title": "Add stakeholder coverage to deal inspection",
            "explanation": "Deal reviews don't currently surface missing decision-maker engagement as a risk flag.",
            "recommended_action": "Add a stakeholder-coverage check (champion + economic buyer identified) to the standard deal-inspection review.",
            "priority": RecommendationPriority.MEDIUM,
        },
    ],
    "competitor": [
        {
            "department": Department.PRODUCT,
            "title": "Review competitive differentiation for this segment",
            "explanation": "Competitive losses in this segment cite a specific capability gap relative to a named competitor.",
            "recommended_action": "Review the competitive comparison and assess whether a roadmap investment is warranted.",
            "priority": RecommendationPriority.MEDIUM,
        },
        {
            "department": Department.SALES,
            "title": "Surface competitive landscape earlier in discovery",
            "explanation": "Competitive evaluations were sometimes discovered late, leaving no time to differentiate.",
            "recommended_action": "Ask directly about parallel vendor evaluations during discovery.",
            "priority": RecommendationPriority.LOW,
        },
    ],
    "proposal_delay": [
        {
            "department": Department.OPERATIONS,
            "title": "Reduce internal proposal turnaround time",
            "explanation": "Deals have been lost to competitors during internal proposal approval delays while buyer interest was highest.",
            "recommended_action": "Set an SLA for proposal approval turnaround and monitor deals that exceed it.",
            "priority": RecommendationPriority.MEDIUM,
        },
    ],
}


def rules_for_bucket(bucket_key: str) -> list[dict]:
    return RECOMMENDATION_RULES.get(bucket_key, [])
