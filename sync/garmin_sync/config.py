"""Environment-backed settings shared by both entry points."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


class ConfigError(RuntimeError):
    """A required setting is missing or unusable."""


def load_dotenv(start: Path | None = None) -> Path | None:
    """Populate os.environ from the nearest .env, searching upward from `start`.

    Values are read literally: no `$` expansion and no treating an inline `#` as
    a comment, so a Hasura admin secret full of shell metacharacters survives
    intact -- which sourcing .env or `make include`-ing it does not. Only whole
    lines beginning with `#` are comments. Existing environment variables win,
    so an explicit override still takes precedence over the file.
    """
    directory = (start or Path.cwd()).resolve()
    for candidate in (directory, *directory.parents):
        env_path = candidate / ".env"
        if env_path.is_file():
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                os.environ.setdefault(key.strip(), value)
            return env_path
    return None


@dataclass(frozen=True)
class Settings:
    # Summaries are written through Hasura; only the sample hypertable, which
    # COPY loads by the million, still talks to Postgres directly. So the daily
    # `sync` needs both, while the samples-only `backfill` needs the DB alone.
    database_url: str
    hasura_url: str | None
    hasura_admin_secret: str | None
    garth_dir: Path
    garmin_email: str | None
    garmin_password: str | None
    # Seconds to wait between activity downloads. Garmin rate-limits aggressively;
    # this is the main dial for staying under it.
    request_delay_s: float

    @classmethod
    def from_env(cls) -> Settings:
        database_url = os.environ.get("DB_CONNECTION_STRING", "").strip()
        if not database_url:
            raise ConfigError(
                "DB_CONNECTION_STRING is required, e.g. "
                "postgres://user:pass@host:5432/dbname"
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
            hasura_url=os.environ.get("HASURA_GRAPHQL_URL", "").strip() or None,
            hasura_admin_secret=os.environ.get(
                "HASURA_GRAPHQL_ADMIN_SECRET", ""
            ).strip()
            or None,
            garth_dir=Path(
                os.environ.get("GARTH_DIR", "~/.garmin-sync/garth")
            ).expanduser(),
            garmin_email=os.environ.get("GARMIN_EMAIL") or None,
            garmin_password=os.environ.get("GARMIN_PASSWORD") or None,
            request_delay_s=request_delay_s,
        )

    def require_hasura(self) -> tuple[str, str]:
        """URL and admin secret for the summary writes, or a clear error.

        Only `sync` needs Hasura, so this is checked at use rather than in
        `from_env`; a samples-only `backfill` must still run with the DB alone.
        """
        if not self.hasura_url or not self.hasura_admin_secret:
            missing = ", ".join(
                name
                for name, value in (
                    ("HASURA_GRAPHQL_URL", self.hasura_url),
                    ("HASURA_GRAPHQL_ADMIN_SECRET", self.hasura_admin_secret),
                )
                if not value
            )
            raise ConfigError(
                f"{missing} required to sync summaries through Hasura, e.g. "
                "HASURA_GRAPHQL_URL=https://<project>.hasura.<region>.nhost.run/v1/graphql"
            )
        return self.hasura_url, self.hasura_admin_secret
