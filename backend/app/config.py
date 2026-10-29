"""Application settings, read from environment variables / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./mindbridge.db"
    secret_key: str = "change-me-in-real-deployments"
    token_ttl_hours: int = 72

    llm_provider: str = "mock"  # "mock" | "openai_compatible"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_timeout_seconds: float = 20.0

    cors_origins: str = "http://localhost:5173"

    # Convenience for local SQLite. In Docker/Postgres, run `alembic upgrade head` instead.
    auto_create_tables: bool = True
    chat_rate_limit_per_minute: int = 30

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
