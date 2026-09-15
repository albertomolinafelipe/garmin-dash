"""Direct Postgres access for the sample hypertable.

Only the full-resolution samples are written here: their volume makes COPY the
only sensible transport, and this runs as a trusted local CLI. Everything else
(activities and the daily summaries) goes through Hasura -- see `hasura.py`.

Every statement is built with psycopg.sql composition, so table and column
names are quoted as identifiers and values always travel as bound parameters.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg
from psycopg import sql

from .fit import Sample

log = logging.getLogger(__name__)


@contextmanager
def connect(database_url: str) -> Iterator[psycopg.Connection]:
    with psycopg.connect(database_url) as conn:
        yield conn


def replace_samples(
    conn: psycopg.Connection, activity_id: int, samples: Sequence[Sample]
) -> int:
    """Replace an activity's samples and stamp it as synced, atomically.

    Delete-then-COPY keeps the operation idempotent, so re-running a partially
    completed backfill cannot leave duplicated or interleaved rows.
    """
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM activity_samples WHERE activity_id = %s", (activity_id,)
        )
        copy_sql = (
            "COPY activity_samples "
            "(activity_id, recorded_at, elapsed_s, hr, altitude_m, distance_m, geom) "
            "FROM STDIN"
        )
        with cur.copy(copy_sql) as copy:
            for sample in samples:
                copy.write_row(
                    (
                        activity_id,
                        sample.recorded_at,
                        sample.elapsed_s,
                        sample.hr,
                        sample.altitude_m,
                        sample.distance_m,
                        # PostGIS parses EWKT on input, which keeps this a single
                        # COPY rather than a staging table plus ST_MakePoint.
                        f"SRID=4326;POINT({sample.lng} {sample.lat})"
                        if sample.has_position
                        else None,
                    )
                )
        cur.execute(
            "UPDATE activities SET samples_synced_at = %s WHERE id = %s",
            (datetime.now(timezone.utc), activity_id),
        )
    return len(samples)


def activities_needing_samples(
    conn: psycopg.Connection, *, limit: int | None = None
) -> list[tuple[int, int]]:
    """GPS activities with no full-resolution samples yet, newest first.

    Candidates come from the database, so building the worklist costs no Garmin
    requests and the backfill can be re-planned freely.
    """
    statement = sql.SQL(
        "SELECT id, garmin_activity_id FROM activities "
        "WHERE start_lat IS NOT NULL AND samples_synced_at IS NULL "
        "ORDER BY start_time DESC NULLS LAST"
    )
    params: list[object] = []
    if limit is not None:
        statement += sql.SQL(" LIMIT %s")
        params.append(limit)
    with conn.cursor() as cur:
        cur.execute(statement, params)
        return [(int(row[0]), int(row[1])) for row in cur.fetchall()]
