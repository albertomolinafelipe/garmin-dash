"""Full-resolution FIT stream extraction.

Garmin ORIGINAL downloads are ZIP archives containing one FIT file; a bare FIT
payload is also accepted. Nothing is downsampled: every record message with a
timestamp becomes one row, so all channels share a clock.
"""

from __future__ import annotations

import io
import logging
import math
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, cast

import fitdecode

log = logging.getLogger(__name__)

_SEMICIRCLE_TO_DEG = 180.0 / 2**31


@dataclass(frozen=True)
class Sample:
    recorded_at: datetime
    elapsed_s: int
    hr: int | None
    altitude_m: float | None
    distance_m: float | None
    lat: float | None
    lng: float | None

    @property
    def has_position(self) -> bool:
        return self.lat is not None and self.lng is not None


def parse_samples(data: bytes) -> list[Sample]:
    """Extract every timestamped record message, ordered by time."""
    try:
        raw = _read_records(_fit_bytes(data))
    except Exception as exc:  # noqa: BLE001 - corrupt downloads are expected input
        log.warning("Could not parse FIT download: %s", exc)
        return []
    if not raw:
        return []

    raw.sort(key=lambda row: row[0])
    start = raw[0][0]
    samples: list[Sample] = []
    seen: set[datetime] = set()
    for recorded_at, hr, altitude, distance, lat, lng in raw:
        # The hypertable is keyed on (activity_id, recorded_at); Garmin
        # occasionally emits duplicate timestamps, so keep the first.
        if recorded_at in seen:
            continue
        seen.add(recorded_at)
        samples.append(
            Sample(
                recorded_at=recorded_at,
                elapsed_s=int((recorded_at - start).total_seconds()),
                hr=hr,
                altitude_m=altitude,
                distance_m=distance,
                lat=lat,
                lng=lng,
            )
        )
    return samples


def _fit_bytes(data: bytes) -> bytes:
    """Unwrap a Garmin ORIGINAL ZIP in memory; tolerate a bare FIT payload."""
    if not zipfile.is_zipfile(io.BytesIO(data)):
        return data
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members = [info for info in archive.infolist() if not info.is_dir()]
        member = next(
            (info for info in members if info.filename.lower().endswith(".fit")),
            members[0] if members else None,
        )
        return archive.read(member) if member is not None else b""


_RawRow = tuple[
    datetime, int | None, float | None, float | None, float | None, float | None
]


def _read_records(data: bytes) -> list[_RawRow]:
    rows: list[_RawRow] = []
    with fitdecode.FitReader(io.BytesIO(data)) as fit:
        for frame in fit:
            if not isinstance(frame, fitdecode.FitDataMessage):
                continue
            if frame.name != "record":
                continue
            timestamp = frame.get_value("timestamp", fallback=None)
            if not isinstance(timestamp, datetime):
                continue
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)

            altitude = _number(frame.get_value("enhanced_altitude", fallback=None))
            if altitude is None:
                altitude = _number(frame.get_value("altitude", fallback=None))

            lat = _number(frame.get_value("position_lat", fallback=None))
            lng = _number(frame.get_value("position_long", fallback=None))
            rows.append(
                (
                    timestamp,
                    _integer(frame.get_value("heart_rate", fallback=None)),
                    altitude,
                    _number(frame.get_value("distance", fallback=None)),
                    lat * _SEMICIRCLE_TO_DEG if lat is not None else None,
                    lng * _SEMICIRCLE_TO_DEG if lng is not None else None,
                )
            )
    return rows


def _number(value: object) -> float | None:
    try:
        number = float(cast(Any, value))
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _integer(value: object) -> int | None:
    number = _number(value)
    return int(number) if number is not None else None
