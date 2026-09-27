from app.core.config import get_settings
from app.services.investigations.llm.base import DealExtractor


def get_extractor() -> DealExtractor:
    settings = get_settings()
    if settings.anthropic_api_key:
        from app.services.investigations.llm.anthropic_extractor import AnthropicExtractor

        return AnthropicExtractor()
    from app.services.investigations.llm.deterministic_extractor import DeterministicDemoExtractor

    return DeterministicDemoExtractor()
