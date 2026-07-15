"""Raw .fit file storage + on-demand time-series parsing.

DB summary metrics come from Garmin's activity summary JSON (see sync.py); the raw
.fit stays on disk for full fidelity. This module owns both the download-to-disk step
and the parse-on-demand step that extracts per-record streams (HR now; elevation /
GPS track later) for the activity detail charts. We deliberately do NOT persist the
time-series — it's cheap to re-parse the raw file when a chart is opened.
"""

from __future__ import annotations

import io
import logging
import math
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, cast

import fitdecode
from garminconnect import Garmin

from ..config import get_settings

log = logging.getLogger(__name__)

# Target resolution for a detail chart — plenty for a smooth line, small over the
# wire. Series longer than this are bucket-averaged down to it.
DEFAULT_MAX_POINTS = 400
# A route needs more points than a chart to keep its shape crisp on a map.
DEFAULT_MAX_TRACK_POINTS = 800
# Garmin stores lat/long as "semicircles" (int32); this scales them to degrees.
_SEMICIRCLE_TO_DEG = 180.0 / 2**31


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
            str(activity_id), dl_fmt=Garmin.ActivityDownloadFormat.ORIGINAL
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


# --- parse-on-demand: per-record time-series ---------------------------------


def heart_rate(
    fit_rel_path: str | None, max_points: int = DEFAULT_MAX_POINTS
) -> list[dict]:
    """Heart-rate series for a stored activity, downsampled to <= ``max_points``.

    Returns ``[{"t": seconds_from_start, "v": bpm}, ...]`` (empty if the file is
    missing or has no HR — e.g. an activity recorded without a HR strap).
    """
    return _series(fit_rel_path, ("heart_rate",), max_points)


def elevation(
    fit_rel_path: str | None, max_points: int = DEFAULT_MAX_POINTS
) -> list[dict]:
    """Altitude series (metres) over time, downsampled. Prefers the barometric
    ``enhanced_altitude`` and falls back to plain ``altitude``. Empty for indoor
    activities that carry no altitude."""
    return _series(fit_rel_path, ("enhanced_altitude", "altitude"), max_points)


def track(
    fit_rel_path: str | None, max_points: int = DEFAULT_MAX_TRACK_POINTS
) -> list[dict]:
    """GPS route as ``[{"lat": .., "lng": ..}, ...]`` in degrees, stride-sampled to
    <= ``max_points`` (endpoints kept). Empty for indoor / GPS-less activities."""
    path = _resolve(fit_rel_path)
    if path is None:
        return []
    try:
        pts = _read_track(path)
    except Exception as exc:  # noqa: BLE001
        log.warning("failed to parse track from %s: %s", path, exc)
        return []
    return _stride(pts, max_points)


def start_location(fit_rel_path: str | None) -> tuple[float, float] | None:
    """First GPS fix in degrees for a stored activity, if present."""
    path = _resolve(fit_rel_path)
    if path is None:
        return None
    try:
        return _read_first_track_point(path)
    except Exception as exc:  # noqa: BLE001
        log.warning("failed to parse start location from %s: %s", path, exc)
        return None


def _resolve(fit_rel_path: str | None) -> Path | None:
    if not fit_rel_path:
        return None
    path = get_settings().data_dir / fit_rel_path
    if not path.exists():
        log.warning("fit file missing on disk: %s", path)
        return None
    return path


def _series(
    fit_rel_path: str | None, fields: tuple[str, ...], max_points: int
) -> list[dict]:
    path = _resolve(fit_rel_path)
    if path is None:
        return []
    try:
        # Try each candidate field in order; use the first that yields data.
        for field in fields:
            raw = _read_record_field(path, field)
            if raw:
                return _downsample(raw, max_points)
    except Exception as exc:  # noqa: BLE001 - never let a bad file 500 the detail page
        log.warning("failed to parse %s from %s: %s", fields, path, exc)
    return []


def _fit_bytes(path: Path) -> bytes:
    """Raw .fit bytes. Garmin's ORIGINAL download is a zip wrapping the .fit, so
    transparently unwrap it; tolerate a bare .fit too."""
    data = path.read_bytes()
    if zipfile.is_zipfile(io.BytesIO(data)):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            members = z.namelist()
            name = next((n for n in members if n.lower().endswith(".fit")), None)
            if name is None and members:
                name = members[0]
            if name is not None:
                return z.read(name)
    return data


def _read_record_field(path: Path, field: str) -> list[tuple[int, float]]:
    """(elapsed_seconds, value) for every `record` message carrying `field`."""
    out: list[tuple[int, float]] = []
    start = None
    with fitdecode.FitReader(io.BytesIO(_fit_bytes(path))) as fit:
        for frame in fit:
            if (
                not isinstance(frame, fitdecode.FitDataMessage)
                or frame.name != "record"
            ):
                continue
            value = frame.get_value(field, fallback=None)
            ts = frame.get_value("timestamp", fallback=None)
            if value is None or not isinstance(ts, datetime):
                continue
            if start is None:
                start = ts
            try:
                out.append((int((ts - start).total_seconds()), float(cast(Any, value))))
            except (TypeError, ValueError):
                continue
    return out


def _read_track(path: Path) -> list[tuple[float, float]]:
    """(lat, lng) in degrees for every `record` with a GPS fix."""
    out: list[tuple[float, float]] = []
    with fitdecode.FitReader(io.BytesIO(_fit_bytes(path))) as fit:
        for frame in fit:
            point = _track_point(frame)
            if point is not None:
                out.append(point)
    return out


def _read_first_track_point(path: Path) -> tuple[float, float] | None:
    """(lat, lng) in degrees for the first `record` with a GPS fix."""
    with fitdecode.FitReader(io.BytesIO(_fit_bytes(path))) as fit:
        for frame in fit:
            point = _track_point(frame)
            if point is not None:
                return point
    return None


def _track_point(frame) -> tuple[float, float] | None:
    if not isinstance(frame, fitdecode.FitDataMessage) or frame.name != "record":
        return None
    lat = frame.get_value("position_lat", fallback=None)
    lng = frame.get_value("position_long", fallback=None)
    if lat is None or lng is None:
        return None
    try:
        return (
            float(cast(Any, lat)) * _SEMICIRCLE_TO_DEG,
            float(cast(Any, lng)) * _SEMICIRCLE_TO_DEG,
        )
    except (TypeError, ValueError):
        return None


def _stride(points: list[tuple[float, float]], max_points: int) -> list[dict]:
    """Uniformly thin a path to <= ``max_points``, always keeping the last point so
    the route doesn't stop short."""
    n = len(points)
    if n == 0:
        return []
    step = max(1, math.ceil(n / max_points))
    kept = points[::step]
    if kept[-1] != points[-1]:
        kept.append(points[-1])
    return [{"lat": round(lat, 6), "lng": round(lng, 6)} for lat, lng in kept]


def _downsample(samples: list[tuple[int, float]], max_points: int) -> list[dict]:
    """Bucket-average to at most ``max_points`` points, keeping each bucket's mid
    timestamp so the x-axis stays honest."""
    n = len(samples)
    if n == 0:
        return []
    if n <= max_points:
        return [{"t": t, "v": round(v)} for t, v in samples]
    bucket = math.ceil(n / max_points)
    out: list[dict] = []
    for i in range(0, n, bucket):
        chunk = samples[i : i + bucket]
        t = chunk[len(chunk) // 2][0]
        v = sum(c[1] for c in chunk) / len(chunk)
        out.append({"t": t, "v": round(v)})
    return out
