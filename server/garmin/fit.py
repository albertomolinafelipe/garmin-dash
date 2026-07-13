"""Raw .fit file storage.

v1 stores only the raw .fit on disk; DB summary metrics come from Garmin's activity
summary JSON (see sync.py), which is simpler and sufficient. This module owns the
download-to-disk step and is the natural home for future per-second time-series
parsing (with e.g. fitdecode) when we build detail charts.
"""
from __future__ import annotations

import logging
from pathlib import Path

from garminconnect import Garmin

from ..config import get_settings

log = logging.getLogger(__name__)


def download_fit(client: Garmin, activity_id: int) -> str | None:
    """Download the original .fit for an activity into DATA_DIR/fit.

    Returns the path relative to DATA_DIR (what we store in the DB), or None on
    failure. Garmin serves the "original" as a zip; we save the raw bytes as-is so
    fidelity is preserved for later re-parsing.
    """
    settings = get_settings()
    settings.ensure_dirs()
    dest = settings.fit_dir / f"{activity_id}.fit"
    if dest.exists():
        return _rel(dest, settings.data_dir)

    try:
        data = client.download_activity(
            activity_id, dl_fmt=Garmin.ActivityDownloadFormat.ORIGINAL
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not download .fit for activity %s: %s", activity_id, exc)
        return None

    dest.write_bytes(data)
    return _rel(dest, settings.data_dir)


def _rel(path: Path, base: Path) -> str:
    try:
        return str(path.relative_to(base))
    except ValueError:
        return str(path)
