"""SQLModel tables.

Each record has two column families:
  - synced      : pulled from Garmin, OVERWRITTEN on every sync.
  - annotation  : user-owned, seeded empty on insert and NEVER overwritten by sync.

Keeping them separate is what makes re-syncing safe.
"""
from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel

# Fields the sync is allowed to write. Everything else on a row is user-owned and
# must survive a re-sync untouched. Kept here so sync.py has one source of truth.
ACTIVITY_SYNCED_FIELDS = {
    "garmin_activity_id", "name", "activity_type", "start_time", "duration_s",
    "distance_m", "avg_hr", "max_hr", "elevation_gain_m", "calories",
    "avg_speed_mps", "avg_power_w", "fit_path", "synced_at",
}
SLEEP_SYNCED_FIELDS = {
    "calendar_date", "start_time", "end_time", "total_sleep_s", "deep_sleep_s",
    "light_sleep_s", "rem_sleep_s", "awake_s", "avg_hrv", "resting_hr",
    "sleep_score", "synced_at",
}

ANNOTATION_FIELDS = {"annotated", "feeling", "rpe", "mood", "tags", "notes"}


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

    # --- user annotations (never overwritten by sync) ---
    annotated: bool = Field(default=False, index=True)  # explicit "I've reviewed this"
    feeling: str | None = None
    rpe: int | None = None               # rating of perceived exertion 1-10
    mood: str | None = None
    tags: str | None = None              # comma-separated for now
    notes: str | None = None             # markdown body


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

    # --- user annotations (never overwritten by sync) ---
    feeling: str | None = None
    rpe: int | None = None
    mood: str | None = None
    tags: str | None = None
    notes: str | None = None
