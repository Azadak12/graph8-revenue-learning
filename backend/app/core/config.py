from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Graph8 Revenue Learning"
    environment: str = "development"

    database_url: str = "postgresql+psycopg://g8:g8@localhost:5432/revenue_learning"
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Encryption for stored secrets (Graph8 API keys). Fernet key, base64, 32 bytes.
    secret_encryption_key: str = "0" * 44

    # Graph8 integration. Presence of GRAPH8_API_KEY switches an org into live mode.
    graph8_api_key: str | None = None
    graph8_base_url: str = "https://be.graph8.com/api/v1"
    graph8_webhook_secret: str | None = None

    # AI provider
    anthropic_api_key: str | None = None
    llm_model: str = "claude-sonnet-5"
    analysis_prompt_version: str = "v1"
    taxonomy_version: str = "v1"

    # Pattern engine thresholds
    pattern_min_sample_size: int = 3
    pattern_recurring_threshold: int = 5
    pattern_strong_threshold: int = 8

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5180", "http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
