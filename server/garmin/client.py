"""Thin wrapper around python-garminconnect with garth token caching.

Login flow: try to resume from the cached garth tokens under DATA_DIR/garth; if
that fails (no cache / expired), do a full email+password login and persist the
tokens so subsequent starts don't need to log in again.
"""
from __future__ import annotations

import logging

from garminconnect import Garmin

from ..config import get_settings

log = logging.getLogger(__name__)

_client: Garmin | None = None


class GarminAuthError(RuntimeError):
    pass


def get_client() -> Garmin:
    """Return a logged-in Garmin client (cached for the process lifetime)."""
    global _client
    if _client is not None:
        return _client

    settings = get_settings()
    settings.ensure_dirs()
    token_store = str(settings.token_dir)

    client = Garmin()
    try:
        # Resume from cached tokens — no network credentials needed.
        client.login(token_store)
        log.info("Garmin: resumed session from cached tokens")
    except Exception:  # noqa: BLE001 - garminconnect raises a variety of types
        if not settings.garmin_email or not settings.garmin_password:
            raise GarminAuthError(
                "No cached Garmin session and GARMIN_EMAIL/GARMIN_PASSWORD are unset."
            )
        log.info("Garmin: cached session invalid, logging in with credentials")
        client = Garmin(settings.garmin_email, settings.garmin_password)
        client.login()
        client.garth.dump(token_store)  # persist for next time

    _client = client
    return _client


def reset_client() -> None:
    """Drop the cached client (e.g. after an auth error) so the next call re-logs in."""
    global _client
    _client = None
