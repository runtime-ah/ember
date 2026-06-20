from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration. Override via environment variables or a .env file.

    Defaults target local Mac development; the Pi deployment supplies its own
    values (database path, CalDAV credentials, VAPID keys) via env.
    """

    model_config = SettingsConfigDict(env_file=".env", env_prefix="TODO_", extra="ignore")

    # Database — single SQLite file. Absolute path on the Pi, local file in dev.
    database_path: Path = Path("todo.db")

    # CORS origins allowed to call the API (the Vite dev server in dev).
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # --- Daily brief ---
    brief_time: str = "06:00"  # 24h HH:MM, local time

    # --- iCloud CalDAV (read-only; milestone 5) ---
    caldav_url: str = "https://caldav.icloud.com"
    caldav_username: str = ""
    caldav_password: str = ""  # app-specific password

    # --- Web Push (VAPID) ---
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:alex.runtime1@gmail.com"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.database_path}"


settings = Settings()
