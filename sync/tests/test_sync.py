import json
import os
from datetime import date, datetime, timezone

import pytest

from pathlib import Path

from garmin_sync import normalize
from garmin_sync.config import ConfigError, Settings, load_dotenv
from garmin_sync.fit import Sample, parse_samples
from garmin_sync.hasura import Hasura, HasuraError, _json_default
from garmin_sync.normalize import ACTIVITY_SYNCED_COLUMNS

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
    monkeypatch.delenv("DB_CONNECTION_STRING", raising=False)
    with pytest.raises(ConfigError, match="DB_CONNECTION_STRING"):
        Settings.from_env()


def test_settings_rejects_unparsable_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DB_CONNECTION_STRING", "postgres://localhost/db")
    monkeypatch.setenv("REQUEST_DELAY_S", "soon")
    with pytest.raises(ConfigError, match="REQUEST_DELAY_S"):
        Settings.from_env()


def _settings(**over: object) -> Settings:
    base: dict[str, object] = {
        "database_url": "postgres://localhost/db",
        "hasura_url": "https://x/v1/graphql",
        "hasura_admin_secret": "secret",
        "garth_dir": normalize.__file__,  # any path; unused here
        "garmin_email": None,
        "garmin_password": None,
        "request_delay_s": 0.0,
    }
    base.update(over)
    return Settings(**base)  # type: ignore[arg-type]


def test_load_dotenv_keeps_metacharacters_and_respects_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A secret with $, # and () -- exactly what shell/make sourcing corrupts.
    secret = "_4q*=Q!5ylV#o)q7ZV3W4$=Xhvh@%abq"
    (tmp_path / ".env").write_text(
        "# a comment line\n"
        f"HASURA_GRAPHQL_ADMIN_SECRET={secret}\n"
        "DB_CONNECTION_STRING='postgres://u:p@h/db'\n"
        "ALREADY_SET=from_file\n"
    )
    monkeypatch.delenv("HASURA_GRAPHQL_ADMIN_SECRET", raising=False)
    monkeypatch.delenv("DB_CONNECTION_STRING", raising=False)
    monkeypatch.setenv("ALREADY_SET", "from_env")

    found = load_dotenv(start=tmp_path)

    assert found == tmp_path / ".env"
    # The whole secret survives, # and $ included; single quotes are stripped.
    assert os.environ["HASURA_GRAPHQL_ADMIN_SECRET"] == secret
    assert os.environ["DB_CONNECTION_STRING"] == "postgres://u:p@h/db"
    # A value already in the environment is not clobbered by the file.
    assert os.environ["ALREADY_SET"] == "from_env"


def test_require_hasura_returns_url_and_secret() -> None:
    assert _settings().require_hasura() == ("https://x/v1/graphql", "secret")


@pytest.mark.parametrize("missing", ["hasura_url", "hasura_admin_secret"])
def test_require_hasura_reports_what_is_missing(missing: str) -> None:
    with pytest.raises(ConfigError, match="Hasura"):
        _settings(**{missing: None}).require_hasura()


# --- Hasura GraphQL layer ------------------------------------------------------


class _FakeResponse:
    def __init__(self, body: dict[str, object]) -> None:
        self._body = body

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self._body


class _FakeSession:
    """Records posted GraphQL bodies and replays canned responses."""

    def __init__(self, responses: list[dict[str, object]]) -> None:
        self.headers: dict[str, str] = {}
        self._responses = responses
        self.posts: list[dict[str, object]] = []
        self.closed = False

    def post(self, url: str, data: str, timeout: float) -> _FakeResponse:
        self.posts.append({"url": url, "body": json.loads(data), "timeout": timeout})
        return _FakeResponse(self._responses.pop(0))

    def close(self) -> None:
        self.closed = True


def test_json_default_serialises_datetime_and_date() -> None:
    assert _json_default(datetime(2026, 9, 14, 7, 30, tzinfo=timezone.utc)).startswith(
        "2026-09-14T07:30"
    )
    assert _json_default(date(2026, 9, 14)) == "2026-09-14"


def test_json_default_rejects_unknown_type() -> None:
    with pytest.raises(TypeError):
        _json_default(object())


def test_hrv_row_readings_is_a_native_list() -> None:
    row = normalize.hrv_row(
        {
            "hrvSummary": {"calendarDate": "2026-09-14"},
            "hrvReadings": [{"readingTimeGMT": "2026-09-14T02:00:00", "hrvValue": 55}],
        }
    )
    # A list, so Hasura serialises it into the jsonb column -- not pre-encoded.
    assert row["readings"] == [{"t": "2026-09-14T02:00:00", "v": 55}]


def test_upsert_activity_returns_id_and_spares_annotations() -> None:
    session = _FakeSession([{"data": {"insert_activities_one": {"id": 99}}}])
    hasura = Hasura("https://x/v1/graphql", "secret", session=session)

    activity_id = hasura.upsert_activity(
        {
            "garmin_activity_id": 42,
            "name": "Morning trail",
            "synced_at": datetime(2026, 9, 14, tzinfo=timezone.utc),
        }
    )

    assert activity_id == 99
    body = session.posts[0]["body"]
    assert body["variables"]["cols"] == list(ACTIVITY_SYNCED_COLUMNS)
    # name is sent (seeded) but must not be in the conflict update list.
    assert "name" not in ACTIVITY_SYNCED_COLUMNS
    assert body["variables"]["obj"]["name"] == "Morning trail"
    # The datetime is serialised, not left as an unencodable object.
    assert body["variables"]["obj"]["synced_at"].startswith("2026-09-14")
    assert session.headers["x-hasura-admin-secret"] == "secret"


def test_upsert_rows_bulk_reports_affected_rows() -> None:
    session = _FakeSession(
        [{"data": {"insert_training_readiness": {"affected_rows": 2}}}]
    )
    hasura = Hasura("https://x/v1/graphql", "secret", session=session)

    n = hasura.upsert_rows(
        "training_readiness",
        [
            {"calendar_date": date(2026, 9, 14), "score": 80},
            {"calendar_date": date(2026, 9, 13)},
        ],
    )

    assert n == 2
    query = session.posts[0]["body"]["query"]
    assert "training_readiness_calendar_date_timestamp_key" in query
    # Update columns are the union across rows, so an omitted field is not lost.
    assert session.posts[0]["body"]["variables"]["cols"] == ["calendar_date", "score"]


def test_upsert_rows_skips_the_request_when_empty() -> None:
    session = _FakeSession([])
    hasura = Hasura("https://x/v1/graphql", "secret", session=session)
    assert hasura.upsert_rows("sleep", []) == 0
    assert session.posts == []


def test_execute_raises_on_graphql_errors() -> None:
    session = _FakeSession([{"errors": [{"message": "boom"}]}])
    hasura = Hasura("https://x/v1/graphql", "secret", session=session)
    with pytest.raises(HasuraError, match="boom"):
        hasura.known_garmin_activity_ids()
