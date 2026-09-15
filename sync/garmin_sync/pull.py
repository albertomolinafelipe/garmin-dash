"""Garmin fetch plus database write for both entry points."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol, cast

import psycopg
from garminconnect import Garmin

from . import db, normalize
from .config import Settings
from .fit import Sample, parse_samples
from .hasura import Hasura

log = logging.getLogger(__name__)


class GarminClient(Protocol):
    def get_activities(self, start: int, limit: int) -> Any: ...
    def download_activity(self, activity_id: str, *, dl_fmt: Any) -> bytes: ...
    def get_sleep_data(self, cdate: str) -> dict[str, Any]: ...
    def get_hrv_data(self, cdate: str) -> dict[str, Any] | None: ...
    def get_training_readiness(self, cdate: str) -> Any: ...


@dataclass
class Report:
    activities: int = 0
    samples: int = 0
    sleep: int = 0
    hrv: int = 0
    readiness: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)

    def summary(self) -> str:
        parts = [
            f"{self.activities} activities",
            f"{self.samples} samples",
            f"{self.sleep} sleep",
            f"{self.hrv} hrv",
            f"{self.readiness} readiness",
        ]
        if self.skipped:
            parts.append(f"{self.skipped} skipped")
        if self.errors:
            parts.append(f"{len(self.errors)} errors")
        return ", ".join(parts)


def download_samples(client: GarminClient, garmin_activity_id: int) -> list[Sample]:
    """Download one activity's FIT file and parse it at full resolution."""
    payload = client.download_activity(
        str(garmin_activity_id), dl_fmt=Garmin.ActivityDownloadFormat.ORIGINAL
    )
    return parse_samples(payload)


def start_location(samples: list[Sample]) -> tuple[float, float] | None:
    for sample in samples:
        if sample.has_position:
            return cast(float, sample.lat), cast(float, sample.lng)
    return None


def sync_activities(
    conn: psycopg.Connection,
    hasura: Hasura,
    client: GarminClient,
    settings: Settings,
    *,
    limit: int,
    force: bool,
    report: Report,
) -> None:
    """Pull recent activities, skipping ones already stored unless forced.

    The activity summary is upserted through Hasura and its samples are COPYed
    to Postgres. These are separate transactions, so a sample failure leaves the
    summary saved without samples -- recoverable, since `backfill` then picks it
    up (start_lat set, samples_synced_at still null).
    """
    known = set() if force else hasura.known_garmin_activity_ids()
    try:
        page = cast(list[dict[str, Any]], client.get_activities(0, limit))
    except Exception as exc:  # noqa: BLE001 - third-party API exceptions vary
        report.errors.append(f"get_activities(0, {limit}) failed: {exc}")
        return

    for summary in page:
        try:
            garmin_activity_id = int(summary["activityId"])
        except (KeyError, TypeError, ValueError):
            report.errors.append(
                f"activity with unusable activityId skipped: {summary.get('activityId')!r}"
            )
            continue
        if garmin_activity_id in known:
            report.skipped += 1
            continue
        try:
            samples = download_samples(client, garmin_activity_id)
            row = normalize.activity_row(
                summary,
                start_location=start_location(samples),
                synced_at=datetime.now(timezone.utc),
            )
            activity_id = hasura.upsert_activity(row)
            if samples:
                report.samples += db.replace_samples(conn, activity_id, samples)
                conn.commit()
            report.activities += 1
            log.info(
                "synced activity %s (%d samples)", garmin_activity_id, len(samples)
            )
        except Exception as exc:  # noqa: BLE001 - tolerate one bad activity
            conn.rollback()
            report.errors.append(f"activity {garmin_activity_id} failed: {exc}")
        time.sleep(settings.request_delay_s)


def sync_daily(
    hasura: Hasura,
    client: GarminClient,
    settings: Settings,
    *,
    days: int,
    report: Report,
) -> None:
    """Pull the per-day summaries: sleep, HRV and training readiness."""
    today = datetime.now().date()
    stamp = datetime.now(timezone.utc)
    for offset in range(days):
        day = (today - timedelta(days=offset)).isoformat()

        try:
            data = client.get_sleep_data(day)
            daily = (data or {}).get("dailySleepDTO") or {}
            if daily.get("sleepTimeSeconds") not in (None, 0):
                report.sleep += hasura.upsert_rows(
                    "sleep", [normalize.sleep_row(data, synced_at=stamp)]
                )
        except Exception as exc:  # noqa: BLE001 - tolerate one bad day
            report.errors.append(f"sleep {day} failed: {exc}")

        try:
            data = client.get_hrv_data(day)
            if data:
                report.hrv += hasura.upsert_rows(
                    "daily_hrv", [normalize.hrv_row(data, synced_at=stamp)]
                )
        except Exception as exc:  # noqa: BLE001 - tolerate one bad day
            report.errors.append(f"hrv {day} failed: {exc}")

        try:
            rows = normalize.readiness_rows(
                client.get_training_readiness(day), synced_at=stamp
            )
            report.readiness += hasura.upsert_rows("training_readiness", rows)
        except Exception as exc:  # noqa: BLE001 - tolerate one bad day
            report.errors.append(f"readiness {day} failed: {exc}")

        time.sleep(settings.request_delay_s)
