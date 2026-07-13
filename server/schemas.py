"""API request/response models (kept separate from DB tables)."""
from __future__ import annotations

from pydantic import BaseModel


class AnnotationUpdate(BaseModel):
    """Partial update of the user-owned fields. Any field left None is ignored,
    so a client can PATCH just one field without clobbering the others."""
    annotated: bool | None = None
    feeling: str | None = None
    rpe: int | None = None
    mood: str | None = None
    tags: str | None = None
    notes: str | None = None


class SyncResult(BaseModel):
    activities_created: int = 0
    activities_updated: int = 0
    sleep_created: int = 0
    sleep_updated: int = 0
    errors: list[str] = []
