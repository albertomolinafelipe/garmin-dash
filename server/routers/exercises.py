"""Exercise catalog for strength annotations.

The catalog is a plain YAML file under DATA_DIR (exercises.yaml), so it stays
hand-editable and portable (git / future Obsidian vault). The Settings page edits
the raw text; the annotation UI consumes the parsed names. Each entry may carry
free-form `categories` tags (e.g. push, calisthenics).
"""

from __future__ import annotations

import yaml
from fastapi import APIRouter, HTTPException

from ..config import get_settings
from ..schemas import Exercise, ExerciseCatalogRaw

router = APIRouter(prefix="/api/exercises", tags=["exercises"])

DEFAULT_CATALOG = """\
# Exercise catalog for strength annotations. Edit freely.
# Each entry has a name and optional categories: free-form tags used to group
# exercises (e.g. push, pull, legs, calisthenics). Write one tag or a list:
#   categories: push
#   categories: [push, calisthenics]
exercises:
  - name: Bench press
    categories: [push, barbell]
  - name: Push up
    categories: [push, calisthenics]
  - name: Pull up
    categories: [pull, calisthenics]
  - name: Barbell row
    categories: [pull, barbell]
  - name: Squat
    categories: [legs, barbell]
  - name: Deadlift
    categories: [legs, barbell]
"""


def _read_text() -> str:
    path = get_settings().exercises_path
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(DEFAULT_CATALOG)
    return path.read_text()


def _parse(text: str) -> list[Exercise]:
    """Parse catalog text into entries, raising HTTP 400 on a malformed file."""
    try:
        data = yaml.safe_load(text) or {}
    except yaml.YAMLError as e:
        raise HTTPException(400, f"Invalid YAML: {e}") from e
    if not isinstance(data, dict) or not isinstance(data.get("exercises"), list):
        raise HTTPException(400, "Expected a top-level 'exercises' list.")
    entries: list[Exercise] = []
    for item in data["exercises"]:
        if not isinstance(item, dict) or not item.get("name"):
            raise HTTPException(400, "Each exercise needs a 'name'.")
        entries.append(Exercise(name=str(item["name"]), categories=_tags(item)))
    return entries


def _tags(item: dict) -> list[str]:
    """Normalize an entry's tags to a list. Accepts `categories` or the legacy
    singular `category`, each written as a single string or a YAML list."""
    raw = item.get("categories", item.get("category"))
    if raw is None:
        return []
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, list):
        return [str(t) for t in raw]
    raise HTTPException(400, "'categories' must be a string or a list.")


@router.get("")
def list_exercises() -> list[Exercise]:
    """Parsed catalog — the suggestion vocabulary for the strength log."""
    return _parse(_read_text())


@router.get("/raw")
def get_raw() -> ExerciseCatalogRaw:
    return ExerciseCatalogRaw(text=_read_text())


@router.put("/raw")
def put_raw(body: ExerciseCatalogRaw) -> list[Exercise]:
    """Validate and save the raw catalog text; returns the parsed entries."""
    entries = _parse(body.text)  # raises 400 if malformed
    get_settings().exercises_path.write_text(body.text)
    return entries
