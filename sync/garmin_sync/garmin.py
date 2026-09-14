"""Garmin authentication backed by a persistent garth token cache."""

from __future__ import annotations

import logging

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

from .config import Settings

log = logging.getLogger(__name__)


class GarminAuthError(RuntimeError):
    """Garmin authentication could not be established."""


class GarminRateLimitError(RuntimeError):
    """Garmin rejected the request because of rate limiting."""


def login(settings: Settings) -> Garmin:
    """Resume a cached Garmin session, falling back to credentials once.

    Tokens are re-dumped after every successful login so garth's silent refresh
    is persisted; a first run needs GARMIN_EMAIL and GARMIN_PASSWORD, and later
    runs are non-interactive.
    """
    settings.garth_dir.mkdir(parents=True, exist_ok=True, mode=0o700)

    client = Garmin()
    try:
        client.login(str(settings.garth_dir))
    except GarminConnectTooManyRequestsError as exc:
        raise GarminRateLimitError(
            "Garmin rate limit hit while resuming the session; retry later"
        ) from exc
    except (
        FileNotFoundError,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
    ) as exc:
        client = _credential_login(settings, exc)
    else:
        log.info("Resumed Garmin session from %s", settings.garth_dir)

    client.garth.dump(str(settings.garth_dir))
    return client


def _credential_login(settings: Settings, cache_error: Exception) -> Garmin:
    log.warning("Could not resume Garmin session: %s", cache_error)
    if not settings.garmin_email or not settings.garmin_password:
        raise GarminAuthError(
            "No usable Garmin token cache. Set GARMIN_EMAIL and GARMIN_PASSWORD "
            "once to create it."
        ) from cache_error

    log.info("Logging in to Garmin with credentials")
    client = Garmin(settings.garmin_email, settings.garmin_password)
    try:
        client.login()
    except GarminConnectTooManyRequestsError as exc:
        raise GarminRateLimitError(
            "Garmin rate limit hit during credential login; retry later"
        ) from exc
    return client
