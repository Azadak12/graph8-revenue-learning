"""Fallback extractor used when ANTHROPIC_API_KEY is not configured.

For demo deals it replays the seeded ground_truth so the rest of the pipeline
(persistence, pattern engine, recommendations, UI) is fully exercised offline.
For anything without ground truth (e.g. a live deal with no API key configured)
it returns an honest UNKNOWN rather than fabricating a conclusion.
"""

from __future__ import annotations

from app.schemas.evidence_bundle import DealEvidenceBundle
from app.schemas.llm_extraction import DealAnalysisExtraction, ExtractedEvidence, ExtractedFactor
from app.seed.demo_deals import ACTIVE_DEALS, CLOSED_DEALS
from app.services.investigations.llm.base import DealExtractor

_GROUND_TRUTH_BY_ID = {d["external_id"]: d for d in CLOSED_DEALS + ACTIVE_DEALS}


def _build_factor(raw: dict, bundle: DealEvidenceBundle) -> ExtractedFactor:
    evidence = []
    for finding in bundle.meeting_findings[:3]:
        evidence.append(
            ExtractedEvidence(
                source_type="meeting" if not finding.summary.startswith("[internal note]") else "note",
                source_external_id=finding.source_external_id,
                finding=finding.summary[:200],
                excerpt=finding.summary[:280],
                strength="strong" if raw["confidence"] == "high" else "moderate",
            )
        )
    return ExtractedFactor(
        category=raw["category"],
        specific_issue=raw["specific_issue"],
        confidence=raw["confidence"],
        preventability=raw["preventability"],
        departments=raw["departments"],
        evidence=evidence,
    )


class DeterministicDemoExtractor(DealExtractor):
    model_identifier = "deterministic-demo-v1"

    def extract(
        self, bundle: DealEvidenceBundle, *, graph8_deal_id: str | None = None
    ) -> DealAnalysisExtraction:
        raw = _GROUND_TRUTH_BY_ID.get(graph8_deal_id or "")
        if raw is None or "ground_truth" not in raw:
            return DealAnalysisExtraction(
                outcome=bundle.deal_context.outcome,
                summary=(
                    "We don't have enough evidence to confidently determine what drove this "
                    "outcome. No pre-analyzed reference data was found for this deal."
                ),
                primary_factor=None,
                secondary_factors=[],
                overall_confidence="unknown",
                human_confirmation_required=True,
                unknowns=["What was the main reason for this outcome?"],
            )

        gt = raw["ground_truth"]
        primary = _build_factor(gt["primary_factor"], bundle) if gt.get("primary_factor") else None
        secondary = [_build_factor(f, bundle) for f in gt.get("secondary_factors", [])]

        success_factors = gt.get("success_factors")
        summary_parts = []
        if bundle.deal_context.outcome == "won" and success_factors:
            summary_parts.append(
                f"{bundle.deal_context.company_name} closed won. Contributing factors appear to include: "
                + "; ".join(success_factors) + "."
            )
        elif primary:
            summary_parts.append(
                f"{bundle.deal_context.company_name} appears to have been lost primarily due to "
                f"{primary.specific_issue.lower()}."
            )
            if secondary:
                summary_parts.append(
                    "Contributing factors may also include: "
                    + "; ".join(f.specific_issue for f in secondary) + "."
                )
        else:
            summary_parts.append(
                "We don't have enough evidence to confidently determine why this deal closed the way it did."
            )

        return DealAnalysisExtraction(
            outcome=bundle.deal_context.outcome,
            summary=" ".join(summary_parts),
            primary_factor=primary,
            secondary_factors=secondary,
            overall_confidence=gt["overall_confidence"],
            human_confirmation_required=gt["human_confirmation_required"],
            unknowns=gt.get("unknowns", []),
        )
