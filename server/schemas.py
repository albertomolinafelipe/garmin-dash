"""API request/response models (kept separate from DB tables)."""
from __future__ import annotations

from pydantic import BaseModel


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


class SyncResult(BaseModel):
    activities_created: int = 0
    activities_updated: int = 0
    sleep_created: int = 0
    sleep_updated: int = 0
    errors: list[str] = []
