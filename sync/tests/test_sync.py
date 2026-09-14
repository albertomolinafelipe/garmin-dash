from datetime import datetime, timezone

import pytest

from garmin_sync import normalize
from garmin_sync.config import ConfigError, Settings
from garmin_sync.db import ACTIVITY_SYNCED_COLUMNS
from garmin_sync.fit import Sample, parse_samples

# Columns the user owns through the dashboard. A re-sync that writes any of
# these silently destroys annotations, which is unrecoverable -- the data only
# exists here, never in Garmin.
ANNOTATION_COLUMNS = (
    "name",
    "subtype",
    "feeling",
    "effort",
    "food_during",
    "food_after",
    "caffeine",
    "weather",
    "notes",
    "focus",
    "hard_tries",
    "strength_exercises",
    "samples_synced_at",
)


@pytest.mark.parametrize("column", ANNOTATION_COLUMNS)
def test_upserts_never_overwrite_user_columns(column: str) -> None:
    assert column not in ACTIVITY_SYNCED_COLUMNS


def test_activity_row_maps_garmin_summary() -> None:
    row = normalize.activity_row(
        {
            "activityId": 42,
            "activityType": {"typeKey": "trail_running"},
            "startTimeLocal": "2026-09-14 07:30:00",
            "duration": 3600.5,
            "distance": 12000.0,
            "averageHR": 148,
            "maxHR": 179,
            "elevationGain": 850.0,
            "activityName": "Morning trail",
        },
        start_location=(42.6, 0.7),
        synced_at=datetime(2026, 9, 14, tzinfo=timezone.utc),
    )
    assert row["garmin_activity_id"] == 42
    assert row["activity_type"] == "trail_running"
    assert row["distance_m"] == 12000.0
    assert row["start_lat"] == 42.6
    assert row["name"] == "Morning trail"


def test_activity_row_requires_an_id() -> None:
    with pytest.raises(ValueError, match="activityId"):
        normalize.activity_row({"activityType": {"typeKey": "running"}})


def test_activity_row_survives_missing_fields() -> None:
    row = normalize.activity_row({"activityId": 7})
    assert row["garmin_activity_id"] == 7
    assert row["distance_m"] is None
    assert row["start_lat"] is None


@pytest.mark.parametrize(
    ("activity_type", "expected"),
    [
        ("running", "road"),
        ("treadmill_running", "treadmill"),
        ("trail_running", None),
        ("rock_climbing", None),
        (None, None),
    ],
)
def test_seed_subtype(activity_type: str | None, expected: str | None) -> None:
    assert normalize.seed_subtype(activity_type) == expected


def test_parse_samples_tolerates_corrupt_downloads() -> None:
    assert parse_samples(b"definitely not a FIT file") == []


def test_sample_position_gating() -> None:
    at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    located = Sample(at, 0, 120, 100.0, 0.0, 42.0, 0.7)
    indoor = Sample(at, 0, 120, None, None, None, None)
    assert located.has_position
    assert not indoor.has_position


def test_readiness_skips_unkeyable_snapshots() -> None:
    rows = normalize.readiness_rows(
        [
            {
                "calendarDate": "2026-09-14",
                "timestamp": "2026-09-14T06:00:00",
                "score": 80,
            },
            {"calendarDate": "2026-09-14"},  # no timestamp
            {"timestamp": "2026-09-14T07:00:00"},  # no date
            "not a dict",
        ]
    )
    assert len(rows) == 1
    assert rows[0]["score"] == 80


def test_settings_rejects_missing_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ConfigError, match="DATABASE_URL"):
        Settings.from_env()


def test_settings_rejects_unparsable_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgres://localhost/db")
    monkeypatch.setenv("REQUEST_DELAY_S", "soon")
    with pytest.raises(ConfigError, match="REQUEST_DELAY_S"):
        Settings.from_env()
