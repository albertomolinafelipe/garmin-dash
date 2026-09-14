"""Pure mapping of Garmin API responses onto database rows.

No I/O and no Garmin SDK types, so this stays cheap to test. Garmin's metric
units are preserved as-is; conversion is the dashboard's concern.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any


def seed_subtype(activity_type: str | None) -> str | None:
    """Seed only unambiguous running subtypes; the user edits the rest."""
    at = (activity_type or "").lower()
    if at == "running":
        return "road"
    if "running" in at and ("treadmill" in at or "indoor" in at):
        return "treadmill"
    return None


def activity_row(
    summary: dict[str, Any],
    *,
    start_location: tuple[float, float] | None = None,
    synced_at: datetime | None = None,
) -> dict[str, Any]:
    type_value = summary.get("activityType")
    activity_type = type_value.get("typeKey") if isinstance(type_value, dict) else None
    try:
        garmin_activity_id = int(summary["activityId"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("activityId must be an integer") from exc
    return {
        "garmin_activity_id": garmin_activity_id,
        "activity_type": _string(activity_type),
        "start_time": _parse_dt(summary.get("startTimeLocal")),
        "duration_s": _float(summary.get("duration")),
        "distance_m": _float(summary.get("distance")),
        "avg_hr": _int(summary.get("averageHR")),
        "max_hr": _int(summary.get("maxHR")),
        "elevation_gain_m": _float(summary.get("elevationGain")),
        "calories": _int(summary.get("calories")),
        "avg_speed_mps": _float(summary.get("averageSpeed")),
        "avg_power_w": _float(summary.get("avgPower")),
        "start_lat": start_location[0] if start_location else None,
        "start_lng": start_location[1] if start_location else None,
        "synced_at": synced_at or datetime.now(timezone.utc),
        "name": _string(summary.get("activityName")),
        "subtype": seed_subtype(_string(activity_type)),
    }


def sleep_row(
    response: dict[str, Any], *, synced_at: datetime | None = None
) -> dict[str, Any]:
    dto = _mapping(response.get("dailySleepDTO"))
    scores = _mapping(dto.get("sleepScores"))
    overall = _mapping(scores.get("overall"))
    return {
        "calendar_date": _iso_date(dto.get("calendarDate"), "dailySleepDTO"),
        "start_time": _epoch_ms(dto.get("sleepStartTimestampGMT")),
        "end_time": _epoch_ms(dto.get("sleepEndTimestampGMT")),
        "total_sleep_s": _int(dto.get("sleepTimeSeconds")),
        "deep_sleep_s": _int(dto.get("deepSleepSeconds")),
        "light_sleep_s": _int(dto.get("lightSleepSeconds")),
        "rem_sleep_s": _int(dto.get("remSleepSeconds")),
        "awake_s": _int(dto.get("awakeSleepSeconds")),
        "avg_hrv": _float(response.get("avgOvernightHrv")),
        "resting_hr": _int(response.get("restingHeartRate")),
        "sleep_score": _int(overall.get("value")),
        "synced_at": synced_at or datetime.now(timezone.utc),
    }


def hrv_row(
    response: dict[str, Any], *, synced_at: datetime | None = None
) -> dict[str, Any]:
    summary = _mapping(response.get("hrvSummary"))
    baseline = _mapping(summary.get("baseline"))
    raw_readings = response.get("hrvReadings")
    readings = [
        {"t": t, "v": v}
        for reading in (raw_readings if isinstance(raw_readings, list) else [])
        if isinstance(reading, dict)
        and (t := _string(reading.get("readingTimeGMT"))) is not None
        and (v := _int(reading.get("hrvValue"))) is not None
    ]
    return {
        "calendar_date": _iso_date(summary.get("calendarDate"), "hrvSummary"),
        "weekly_avg": _int(summary.get("weeklyAvg")),
        "last_night_avg": _int(summary.get("lastNightAvg")),
        "last_night_5min_high": _int(summary.get("lastNight5MinHigh")),
        "baseline_low_upper": _int(baseline.get("lowUpper")),
        "baseline_balanced_low": _int(baseline.get("balancedLow")),
        "baseline_balanced_upper": _int(baseline.get("balancedUpper")),
        "baseline_marker_value": _float(baseline.get("markerValue")),
        "status": _string(summary.get("status")),
        "feedback_phrase": _string(summary.get("feedbackPhrase")),
        "start_time": _utc(_parse_dt(response.get("sleepStartTimestampGMT"))),
        "end_time": _utc(_parse_dt(response.get("sleepEndTimestampGMT"))),
        "readings": json.dumps(readings),
        "synced_at": synced_at or datetime.now(timezone.utc),
    }


def readiness_rows(
    response: Any, *, synced_at: datetime | None = None
) -> list[dict[str, Any]]:
    """Map a readiness response to per-snapshot rows.

    The endpoint returns several same-day snapshots with distinct inputContext;
    any snapshot missing the date or timestamp cannot be keyed, so it is skipped.
    """
    stamp = synced_at or datetime.now(timezone.utc)
    snapshots = response if isinstance(response, list) else [response]
    rows: list[dict[str, Any]] = []
    for snapshot in snapshots:
        if not isinstance(snapshot, dict):
            continue
        try:
            calendar_date = date.fromisoformat(str(snapshot.get("calendarDate")))
        except (TypeError, ValueError):
            continue
        timestamp = _utc(_parse_dt(snapshot.get("timestamp")))
        if timestamp is None:
            continue
        rows.append(
            {
                "calendar_date": calendar_date,
                "timestamp": timestamp,
                "device_id": _int(snapshot.get("deviceId")),
                "level": _string(snapshot.get("level")),
                "feedback_long": _string(snapshot.get("feedbackLong")),
                "feedback_short": _string(snapshot.get("feedbackShort")),
                "score": _int(snapshot.get("score")),
                "sleep_score": _int(snapshot.get("sleepScore")),
                "sleep_score_factor_percent": _int(
                    snapshot.get("sleepScoreFactorPercent")
                ),
                "sleep_score_factor_feedback": _string(
                    snapshot.get("sleepScoreFactorFeedback")
                ),
                "recovery_time": _int(snapshot.get("recoveryTime")),
                "recovery_time_factor_percent": _int(
                    snapshot.get("recoveryTimeFactorPercent")
                ),
                "recovery_time_factor_feedback": _string(
                    snapshot.get("recoveryTimeFactorFeedback")
                ),
                "acwr_factor_percent": _int(snapshot.get("acwrFactorPercent")),
                "acwr_factor_feedback": _string(snapshot.get("acwrFactorFeedback")),
                "acute_load": _int(snapshot.get("acuteLoad")),
                "stress_history_factor_percent": _int(
                    snapshot.get("stressHistoryFactorPercent")
                ),
                "stress_history_factor_feedback": _string(
                    snapshot.get("stressHistoryFactorFeedback")
                ),
                "hrv_factor_percent": _int(snapshot.get("hrvFactorPercent")),
                "hrv_factor_feedback": _string(snapshot.get("hrvFactorFeedback")),
                "hrv_weekly_average": _int(snapshot.get("hrvWeeklyAverage")),
                "sleep_history_factor_percent": _int(
                    snapshot.get("sleepHistoryFactorPercent")
                ),
                "sleep_history_factor_feedback": _string(
                    snapshot.get("sleepHistoryFactorFeedback")
                ),
                "valid_sleep": _bool(snapshot.get("validSleep")),
                "input_context": _string(snapshot.get("inputContext")),
                "recovery_time_change_phrase": _string(
                    snapshot.get("recoveryTimeChangePhrase")
                ),
                "synced_at": stamp,
            }
        )
    return rows


def _mapping(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _iso_date(value: object, field: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field}.calendarDate must be an ISO date") from exc


def _utc(value: datetime | None) -> datetime | None:
    return value.replace(tzinfo=timezone.utc) if value is not None else None


def _parse_dt(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(str(value), fmt)
        except (ValueError, TypeError):
            continue
    return None


def _epoch_ms(value: object) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(str(value)) / 1000, tz=timezone.utc)
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def _string(value: object) -> str | None:
    return str(value) if value is not None else None


def _bool(value: object) -> bool | None:
    return value if isinstance(value, bool) else None


def _float(value: object) -> float | None:
    try:
        return float(str(value))
    except (ValueError, TypeError):
        return None


def _int(value: object) -> int | None:
    try:
        return int(float(str(value)))
    except (ValueError, TypeError, OverflowError):
        return None
