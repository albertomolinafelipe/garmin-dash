"""Runtime configuration, read from environment (.env supported for local dev)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # no-op in Docker if there is no .env; convenient for native dev


class Settings:
    def __init__(self) -> None:
        self.garmin_email: str | None = os.getenv("GARMIN_EMAIL")
        self.garmin_password: str | None = os.getenv("GARMIN_PASSWORD")

        # All persistent state lives under DATA_DIR so a single volume covers it.
        self.data_dir: Path = Path(os.getenv("DATA_DIR", "/data"))
        self.db_path: Path = self.data_dir / "garmin_dash.db"
        self.fit_dir: Path = self.data_dir / "fit"           # raw .fit files
        self.token_dir: Path = self.data_dir / "garth"       # garth token cache

        # Where the built SPA lives inside the image (set by Dockerfile copy).
        self.static_dir: Path = Path(os.getenv("STATIC_DIR", "web_dist"))

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.fit_dir, self.token_dir):
            d.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
