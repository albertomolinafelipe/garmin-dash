"""Tiny hand-rolled migrations for the SQLite schema.

No Alembic — this is a single-user local app. Each migration is idempotent: it
checks the current schema and only acts when needed. Called from init_db() after
SQLModel.create_all (which creates missing tables but never alters existing ones).
"""

from __future__ import annotations

import logging

from sqlalchemy import text

from .db import engine

log = logging.getLogger(__name__)

# Everything logged before this date is considered already-reviewed. Activities on
# or after the cutoff start life un-annotated. One-time seed, see below.
ANNOTATED_CUTOFF = "2026-07-13"


def run_migrations() -> None:
    _add_activity_annotated_column()
    _add_activity_column("subtype", "VARCHAR")
    _drop_legacy_annotation_columns()  # must run before (re)adding feeling
    _add_activity_column("feeling", "INTEGER")
    _add_activity_column("effort", "INTEGER")
    _add_activity_column("caffeine", "VARCHAR")
    _add_activity_column("weather", "VARCHAR")
    _add_activity_column("notes", "VARCHAR")
    _add_activity_column("focus", "VARCHAR")
    _add_activity_column("hard_tries", "INTEGER")
    _add_activity_column("food_during", "JSON")
    _add_activity_column("food_after", "JSON")
    _add_activity_column("start_lat", "FLOAT")
    _add_activity_column("start_lng", "FLOAT")
    _seed_running_subtypes()


def _drop_legacy_annotation_columns() -> None:
    """Remove the old placeholder annotation columns (rpe/mood/tags/notes) and the
    old TEXT `feeling` so it can be re-added as INTEGER. Idempotent: `feeling` is only
    dropped while it's still the legacy (non-INTEGER) column."""
    with engine.begin() as conn:
        types = {
            row[1]: (row[2] or "").upper()
            for row in conn.execute(text("PRAGMA table_info(activity)"))
        }
        # notes is intentionally NOT here — it's a real field again (re-added below).
        for name in ("rpe", "mood", "tags"):
            if name in types:
                log.info("migration: dropping legacy column activity.%s", name)
                conn.execute(text(f"ALTER TABLE activity DROP COLUMN {name}"))
        if "feeling" in types and "INT" not in types["feeling"]:
            log.info("migration: dropping legacy TEXT activity.feeling (re-add as INT)")
            conn.execute(text("ALTER TABLE activity DROP COLUMN feeling"))


def _seed_running_subtypes() -> None:
    """Seed subtype for unambiguous running (processing step) on rows that don't have
    one yet. Only touches NULLs, so hand-set values are safe."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE activity SET subtype='road' "
                "WHERE subtype IS NULL AND activity_type='running'"
            )
        )
        conn.execute(
            text(
                "UPDATE activity SET subtype='treadmill' "
                "WHERE subtype IS NULL AND activity_type LIKE '%treadmill%'"
            )
        )


def _add_activity_column(name: str, sql_type: str) -> None:
    """Add a nullable column to `activity` if it isn't there yet."""
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(activity)"))}
        if name in cols:
            return
        log.info("migration: adding activity.%s", name)
        conn.execute(text(f"ALTER TABLE activity ADD COLUMN {name} {sql_type}"))


def _add_activity_annotated_column() -> None:
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(activity)"))}
        if "annotated" in cols:
            return  # already migrated (or fresh DB created with the column)

        log.info("migration: adding activity.annotated + backfilling by cutoff")
        conn.execute(
            text("ALTER TABLE activity ADD COLUMN annotated BOOLEAN NOT NULL DEFAULT 0")
        )
        # One-time backfill: mark everything before the cutoff as annotated.
        conn.execute(
            text("UPDATE activity SET annotated = 1 WHERE start_time < :cutoff"),
            {"cutoff": ANNOTATED_CUTOFF},
        )
