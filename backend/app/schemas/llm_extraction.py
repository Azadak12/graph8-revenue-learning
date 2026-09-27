"""Structured output contract for the AI extraction step.

This is the ONLY shape the LLM is allowed to return (enforced via Anthropic tool-use /
strict JSON schema). Deterministic code (pattern engine, recommendation engine) never
consumes free-form prose — only this schema, persisted verbatim into DealFactor /
DealEvidence rows.
"""

from pydantic import BaseModel, Field

from app.models.enums import (
    ConfidenceLevel,
    Department,
    EvidenceSourceType,
    EvidenceStrength,
    FactorCategory,
    Preventability,
)

FACTOR_CATEGORIES = [c.value for c in FactorCategory]
DEPARTMENTS = [d.value for d in Department]


class ExtractedEvidence(BaseModel):
    source_type: EvidenceSourceType
    source_external_id: str | None = None
    finding: str = Field(description="One or two sentence, human-readable finding")
    excerpt: str | None = Field(default=None, description="Short supporting excerpt, <= 280 chars")
    strength: EvidenceStrength


class ExtractedFactor(BaseModel):
    category: FactorCategory
    specific_issue: str = Field(description="Concrete, specific description, not just the category")
    confidence: ConfidenceLevel
    preventability: Preventability
    departments: list[Department] = Field(min_length=1)
    evidence: list[ExtractedEvidence] = Field(
        default_factory=list,
        description="Evidence supporting this factor. Empty only if confidence is LOW/UNKNOWN.",
    )


class DealAnalysisExtraction(BaseModel):
    """Top-level structured result the model must return for one closed deal."""

    outcome: str = Field(description="'won' or 'lost', echoed back from input")
    summary: str = Field(
        description=(
            "2-4 sentence plain-language explanation of what happened, written for a business "
            "reader. Never claim certainty beyond the evidence. Use hedged language such as "
            "'appears to have', 'was associated with', 'may have contributed'."
        )
    )
    primary_factor: ExtractedFactor | None = Field(
        default=None, description="Null if evidence is insufficient to name a primary factor"
    )
    secondary_factors: list[ExtractedFactor] = Field(default_factory=list, max_length=4)
    overall_confidence: ConfidenceLevel
    human_confirmation_required: bool = Field(
        description="True whenever overall_confidence is LOW/UNKNOWN, or evidence is thin"
    )
    unknowns: list[str] = Field(
        default_factory=list, description="Specific open questions worth asking the rep"
    )
