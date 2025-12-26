import json

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        # Disable automatic JSON decoding of complex types from env.
        # This lets us accept both JSON and plain strings for list fields.
        enable_decoding=False,
    )

    app_name: str = "RoutoX API"
    env: str = "dev"
    debug: bool = True
    api_prefix: str = "/api/v1"

    database_url: str

    jwt_secret: str
    jwt_alg: str = "HS256"
    jwt_expires_min: int = 60 * 24

    redis_url: str = "redis://redis:6379/0"

    # Background scheduler (incidents escalation). Disabled by default to avoid double-running in multi-worker setups.
    enable_scheduler: bool = False
    scheduler_interval_seconds: int = 60

    cors_origins: str = "http://localhost:8000,http://localhost:3000,http://127.0.0.1:3000"

    @field_validator("cors_origins", mode="after")
    @classmethod
    def _parse_cors_origins(cls, value) -> list[str]:
        # Accept:
        # - JSON list: ["http://...", "http://..."]
        # - single string: http://localhost:8000
        # - comma-separated: http://a,http://b
        if value is None:
            return ["http://localhost:8000"]
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return ["http://localhost:8000"]
            if raw.startswith("["):
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    return [raw]
            if "," in raw:
                return [part.strip() for part in raw.split(",") if part.strip()]
            return [raw]
        return ["http://localhost:8000"]


settings = Settings()
