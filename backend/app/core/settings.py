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

    # Dev-friendly defaults so the project can run without Docker/installed Postgres.
    # For production, override via environment variables.
    database_url: str = "sqlite:///./routa_dev.db"

    jwt_secret: str = "dev-secret-change-me"
    jwt_alg: str = "HS256"
    jwt_expires_min: int = 60 * 24  # Access token: 24 часа
    jwt_refresh_expires_days: int = 30  # Refresh token: 30 дней

    # Password reset
    password_reset_expires_min: int = 60  # 1 час на сброс пароля
    password_reset_secret: str = ""  # Отдельный секрет для токенов сброса

    # Rate limiting
    rate_limit_requests: int = 100  # Запросов в минуту
    rate_limit_window_seconds: int = 60

    redis_url: str = "redis://localhost:6379/0"

    # Email settings (для восстановления пароля)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@routox.io"

    # Background scheduler (incidents escalation). Disabled by default to avoid double-running in multi-worker setups.
    enable_scheduler: bool = False
    scheduler_interval_seconds: int = 60

    # If true, creates tables automatically on startup (useful for dev).
    # Note: even if false, SQLite will still auto-create by default.
    auto_create_schema: bool = False

    cors_origins: str = "http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000"

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
