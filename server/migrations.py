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
