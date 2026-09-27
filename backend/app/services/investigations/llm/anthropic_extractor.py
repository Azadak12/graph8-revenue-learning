"""Real LLM extraction via the Anthropic API, using tool-use to force strict
structured output. The model never gets to return free-form prose that we then
try to parse — it must call `record_deal_analysis` with arguments matching
DealAnalysisExtraction's JSON schema, and we validate that with Pydantic before
persisting anything.
"""

from __future__ import annotations

import json

import anthropic

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.evidence_bundle import DealEvidenceBundle
from app.schemas.llm_extraction import DEPARTMENTS, FACTOR_CATEGORIES, DealAnalysisExtraction
from app.services.investigations.llm.base import DealExtractor

logger = get_logger(__name__)

_SYSTEM_PROMPT = """You are the Revenue Learning analysis engine for Graph8. You turn the \
evidence for one CLOSED deal (won or lost) into a strictly factual, evidence-grounded \
structured analysis.

Rules you must follow:
- Every factor you name must be grounded in the evidence provided. Do not invent facts.
- Never claim certainty beyond the evidence. Use hedged language: "appears to have", \
"was associated with", "may have contributed", "worth investigating". Never say a factor \
"definitely caused" the outcome.
- If evidence is thin or ambiguous, set overall_confidence to "low" or "unknown", leave \
primary_factor null if you cannot responsibly name one, and set \
human_confirmation_required to true. Returning "unknown" is a GOOD outcome when evidence \
is insufficient — do not force a conclusion.
- If the evidence points to a buyer-side event unrelated to the seller's execution (e.g. a \
budget freeze, internal reorg, project cancellation), name that plainly and mark \
preventability as "not_preventable" — do not blame the sales team for it.
- category must be one of: """ + ", ".join(FACTOR_CATEGORIES) + """
- departments must be drawn from: """ + ", ".join(DEPARTMENTS) + """
- You MUST call the record_deal_analysis tool exactly once with your findings."""

_TOOL_SCHEMA = {
    "name": "record_deal_analysis",
    "description": "Record the structured analysis for this closed deal.",
    "input_schema": DealAnalysisExtraction.model_json_schema(),
}


class AnthropicExtractor(DealExtractor):
    def __init__(self) -> None:
        settings = get_settings()
        self.model_identifier = settings.llm_model
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def extract(
        self, bundle: DealEvidenceBundle, *, graph8_deal_id: str | None = None
    ) -> DealAnalysisExtraction:
        user_content = (
            "Analyze this closed deal. Evidence bundle (already normalized, JSON):\n\n"
            + bundle.model_dump_json(indent=2)
        )

        response = self._client.messages.create(
            model=self.model_identifier,
            max_tokens=2000,
            system=_SYSTEM_PROMPT,
            tools=[_TOOL_SCHEMA],
            tool_choice={"type": "tool", "name": "record_deal_analysis"},
            messages=[{"role": "user", "content": user_content}],
        )

        for block in response.content:
            if block.type == "tool_use" and block.name == "record_deal_analysis":
                return DealAnalysisExtraction.model_validate(block.input)

        logger.error("anthropic_extraction_no_tool_call", graph8_deal_id=graph8_deal_id)
        raise ValueError("Model did not return a structured tool call")
