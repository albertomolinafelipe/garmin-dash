"""Environment-backed settings shared by both entry points."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


class ConfigError(RuntimeError):
    """A required setting is missing or unusable."""


@dataclass(frozen=True)
class Settings:
    database_url: str
    garth_dir: Path
    garmin_email: str | None
    garmin_password: str | None
    # Seconds to wait between activity downloads. Garmin rate-limits aggressively;
    # this is the main dial for staying under it.
    request_delay_s: float

    @classmethod
    def from_env(cls) -> Settings:
        database_url = os.environ.get("DATABASE_URL", "").strip()
        if not database_url:
            raise ConfigError(
                "DATABASE_URL is required, e.g. postgres://user:pass@host:5432/dbname"
            )
        raw_delay = os.environ.get("REQUEST_DELAY_S", "2.0")
        try:
            request_delay_s = float(raw_delay)
        except ValueError as exc:
            raise ConfigError(
                f"REQUEST_DELAY_S must be a number, got {raw_delay!r}"
            ) from exc
        return cls(
            database_url=database_url,
            garth_dir=Path(
                os.environ.get("GARTH_DIR", "~/.garmin-sync/garth")
            ).expanduser(),
            garmin_email=os.environ.get("GARMIN_EMAIL") or None,
            garmin_password=os.environ.get("GARMIN_PASSWORD") or None,
            request_delay_s=request_delay_s,
        )
