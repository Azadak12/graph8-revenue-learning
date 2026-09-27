from abc import ABC, abstractmethod

from app.schemas.evidence_bundle import DealEvidenceBundle
from app.schemas.llm_extraction import DealAnalysisExtraction


class DealExtractor(ABC):
    """Extracts a structured DealAnalysisExtraction from a DealEvidenceBundle.

    This is the ONLY place free-form reasoning happens. Its output is validated
    against a strict Pydantic schema before anything downstream touches it.
    """

    model_identifier: str

    @abstractmethod
    def extract(
        self, bundle: DealEvidenceBundle, *, graph8_deal_id: str | None = None
    ) -> DealAnalysisExtraction: ...
