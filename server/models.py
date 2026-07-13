"""SQLModel tables.

Each activity row has three column families (see CLAUDE.md > Processing vs annotation):
  - synced       : from Garmin, OVERWRITTEN on every process/sync.
  - seeded-once  : machine-decided at first ingest (name, auto subtype), then user-
                   editable and NEVER clobbered by re-processing.
  - annotation   : purely user-owned, never touched by processing.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

# Metrics the processing step overwrites on every run. name/subtype are seeded once
# (see SEEDED_ONCE_FIELDS) and everything else is user-owned annotation.
ACTIVITY_SYNCED_FIELDS = {
    "garmin_activity_id", "activity_type", "start_time", "duration_s",
    "distance_m", "avg_hr", "max_hr", "elevation_gain_m", "calories",
    "avg_speed_mps", "avg_power_w", "fit_path", "synced_at",
}
# Written only on first insert, then owned by the user.
SEEDED_ONCE_FIELDS = {"name", "subtype"}
SLEEP_SYNCED_FIELDS = {
    "calendar_date", "start_time", "end_time", "total_sleep_s", "deep_sleep_s",
    "light_sleep_s", "rem_sleep_s", "awake_s", "avg_hrv", "resting_hr",
    "sleep_score", "synced_at",
}

# User-owned annotation fields (never overwritten by processing). `subtype` and `name`
# are seeded once but then editable, so they behave like annotations after insert.
ANNOTATION_FIELDS = {
    "annotated", "subtype", "name",
    "feeling", "effort", "food_during", "food_after", "caffeine", "weather", "notes",
}


class Activity(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)

    # --- synced from Garmin ---
    garmin_activity_id: int = Field(index=True, unique=True)
    name: str | None = None
    activity_type: str | None = Field(default=None, index=True)
    start_time: datetime | None = Field(default=None, index=True)
    duration_s: float | None = None
    distance_m: float | None = None
    avg_hr: int | None = None
    max_hr: int | None = None
    elevation_gain_m: float | None = None
    calories: int | None = None
    avg_speed_mps: float | None = None
    avg_power_w: float | None = None
    fit_path: str | None = None          # raw .fit on disk (relative to DATA_DIR)
    synced_at: datetime | None = None

    # --- user annotations (never overwritten by processing) ---
    # Legacy explicit flag; superseded by derived completeness (web/src/activityTypes.ts
    # needsAnnotation). Kept as a column for now; not used by the UI.
    annotated: bool = Field(default=False, index=True)
    # Discipline sub-classification: running → road/trail/mountain/treadmill,
    # climbing → rope/boulder/board. Seeded at ingest for road/treadmill.
    subtype: str | None = None
    # Running annotations (see CLAUDE.md > Annotations):
    feeling: int | None = None                 # 1..5, sad → happy
    effort: int | None = None                  # 1..5, how hard I tried
    food_during: list[str] | None = Field(default=None, sa_column=Column(JSON))
    food_after: list[str] | None = Field(default=None, sa_column=Column(JSON))
    caffeine: str | None = None                # yes | no | residual
    weather: str | None = None                 # normal | cold | hot | bad (optional)
    notes: str | None = None                   # free-text general notes


class Sleep(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)

    # --- synced from Garmin ---
    calendar_date: str = Field(index=True, unique=True)  # ISO date "YYYY-MM-DD"
    start_time: datetime | None = None
    end_time: datetime | None = None
    total_sleep_s: int | None = None
    deep_sleep_s: int | None = None
    light_sleep_s: int | None = None
    rem_sleep_s: int | None = None
    awake_s: int | None = None
    avg_hrv: float | None = None
    resting_hr: int | None = None
    sleep_score: int | None = None
    synced_at: datetime | None = None

    # No user annotation fields yet — TBD, see CLAUDE.md > Annotations.
