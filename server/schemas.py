"""API request/response models (kept separate from DB tables)."""

from __future__ import annotations

from pydantic import BaseModel


class StrengthEntry(BaseModel):
    """One logged exercise: a compact sets × reps × weight row. weight is null for
    bodyweight movements."""

    exercise: str
    sets: int | None = None
    reps: int | None = None
    weight: float | None = None


class AnnotationUpdate(BaseModel):
    """Partial update of the user-owned fields. Only fields the client actually sends
    are applied (see routers: model_dump(exclude_unset=True)), so one field can be
    PATCHed without clobbering the others. A field sent as null clears it."""

    name: str | None = None
    annotated: bool | None = None
    subtype: str | None = None
    feeling: int | None = None
    effort: int | None = None
    food_during: list[str] | None = None
    food_after: list[str] | None = None
    caffeine: str | None = None
    weather: str | None = None
    notes: str | None = None
    focus: str | None = None
    hard_tries: int | None = None
    strength_exercises: list[StrengthEntry] | None = None


class Exercise(BaseModel):
    """A catalog entry from exercises.yaml. `categories` are free-form tags (e.g.
    push, calisthenics) used to group/filter exercises."""

    name: str
    categories: list[str] = []


class ExerciseCatalogRaw(BaseModel):
    """Raw YAML text of the exercise catalog (edited in Settings)."""

    text: str


class Sample(BaseModel):
    """One point of a per-activity time-series."""

    t: int  # seconds from activity start
    v: float  # value (e.g. bpm)


class LatLng(BaseModel):
    lat: float
    lng: float


class ActivityStreams(BaseModel):
    """Parsed-on-demand time-series for an activity's detail charts. Streams are
    empty when the .fit is absent or lacks that channel."""

    activity_id: int
    heart_rate: list[Sample] = []
    elevation: list[Sample] = []
    track: list[LatLng] = []


class ActivityRoute(BaseModel):
    activity_id: int
    name: str | None = None
    start_time: str | None = None
    track: list[LatLng] = []


class SyncResult(BaseModel):
    activities_created: int = 0
    activities_updated: int = 0
    fits_downloaded: int = 0
    fits_missing: int = 0  # download failed/absent this run — re-run to retry
    sleep_created: int = 0
    sleep_updated: int = 0
    errors: list[str] = []
