"""Pull activities + sleep from Garmin and upsert into SQLite.

Idempotent: matches on garmin_activity_id / calendar_date. On insert, synced fields
are written and annotation fields are left as their DB defaults (empty). On update,
ONLY synced fields are touched — user annotations are never overwritten.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from ..models import Activity, Sleep
from ..schemas import SyncResult
from .client import get_client
from .fit import download_fit, start_location
from .process import seed_subtype

log = logging.getLogger(__name__)


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(str(value), fmt)
        except (ValueError, TypeError):
            continue
    return None


def sync(
    session: Session,
    days: int = 30,
    download_fits: bool = True,
    max_activities: int | None = 50,
) -> SyncResult:
    """Pull activities + sleep into the DB.

    ``max_activities`` caps how far back activities are pulled; ``None`` paginates
    all the way to the start of history (full backfill). ``days`` bounds the sleep
    look-back (sleep is one API call per day, so a backfill still caps this).
    """
    result = SyncResult()
    client = get_client()
    _sync_activities(
        session,
        client,
        result,
        max_activities=max_activities,
        download_fits=download_fits,
    )
    _sync_sleep(session, client, result, days=days)
    session.commit()
    return result


def _sync_activities(
    session,
    client,
    result,
    *,
    max_activities: int | None = 50,
    download_fits=True,
    batch=100,
):
    now = datetime.now(timezone.utc)
    start = 0
    fetched = 0
    while max_activities is None or fetched < max_activities:
        want = batch if max_activities is None else min(batch, max_activities - fetched)
        try:
            raw = client.get_activities(start, want)
        except Exception as exc:  # noqa: BLE001
            result.errors.append(f"get_activities({start}, {want}) failed: {exc}")
            break
        if not raw:
            break  # reached the start of history

        for a in raw:
            gid = a.get("activityId")
            if gid is None:
                continue
            existing = session.exec(
                select(Activity).where(Activity.garmin_activity_id == gid)
            ).first()

            fit_path = existing.fit_path if existing else None
            if download_fits and not fit_path:
                fit_path = download_fit(client, gid)

            activity_type = (a.get("activityType") or {}).get("typeKey")
            location = start_location(fit_path)
            # Synced metrics — rewritten on every process (never name/subtype).
            synced = dict(
                garmin_activity_id=gid,
                activity_type=activity_type,
                start_time=_parse_dt(a.get("startTimeLocal")),
                duration_s=a.get("duration"),
                distance_m=a.get("distance"),
                avg_hr=a.get("averageHR"),
                max_hr=a.get("maxHR"),
                elevation_gain_m=a.get("elevationGain"),
                calories=a.get("calories"),
                avg_speed_mps=a.get("averageSpeed"),
                avg_power_w=a.get("avgPower"),
                fit_path=fit_path,
                start_lat=location[0] if location else None,
                start_lng=location[1] if location else None,
                synced_at=now,
            )

            if existing:
                for k, v in synced.items():
                    setattr(
                        existing, k, v
                    )  # only synced metrics; name/subtype/annotations kept
                session.add(existing)
                result.activities_updated += 1
            else:
                # Seed name + subtype once (processing step), then never clobber.
                session.add(
                    Activity(
                        **synced,
                        name=a.get("activityName"),
                        subtype=seed_subtype(activity_type),
                    )
                )
                result.activities_created += 1

        fetched += len(raw)
        start += len(raw)
        if len(raw) < want:
            break  # last (partial) page — no more to fetch


def _sync_sleep(session, client, result, *, days: int):
    today = datetime.now().date()
    for offset in range(days):
        day = (today - timedelta(days=offset)).isoformat()
        try:
            data = client.get_sleep_data(day)
        except Exception as exc:  # noqa: BLE001
            result.errors.append(f"get_sleep_data({day}) failed: {exc}")
            continue

        dto = (data or {}).get("dailySleepDTO") or {}
        if not dto or dto.get("sleepTimeSeconds") in (None, 0):
            continue  # no sleep recorded that night

        now = datetime.now(timezone.utc)
        existing = session.exec(select(Sleep).where(Sleep.calendar_date == day)).first()

        synced = dict(
            calendar_date=day,
            start_time=_epoch_ms(dto.get("sleepStartTimestampGMT")),
            end_time=_epoch_ms(dto.get("sleepEndTimestampGMT")),
            total_sleep_s=dto.get("sleepTimeSeconds"),
            deep_sleep_s=dto.get("deepSleepSeconds"),
            light_sleep_s=dto.get("lightSleepSeconds"),
            rem_sleep_s=dto.get("remSleepSeconds"),
            awake_s=dto.get("awakeSleepSeconds"),
            avg_hrv=(data.get("avgOvernightHrv") if isinstance(data, dict) else None),
            resting_hr=(
                data.get("restingHeartRate") if isinstance(data, dict) else None
            ),
            sleep_score=((dto.get("sleepScores") or {}).get("overall") or {}).get(
                "value"
            ),
            synced_at=now,
        )

        if existing:
            for k, v in synced.items():
                setattr(existing, k, v)
            session.add(existing)
            result.sleep_updated += 1
        else:
            session.add(Sleep(**synced))
            result.sleep_created += 1


def _epoch_ms(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc)
    except (ValueError, TypeError, OverflowError):
        return None
