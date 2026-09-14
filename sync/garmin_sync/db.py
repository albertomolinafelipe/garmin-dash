"""Direct Postgres access.

The sync writes to Postgres rather than through Hasura: sample volume makes
COPY the only sensible transport, and this runs as a trusted local CLI.

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

# Columns the sync owns. Everything else on activities is user-authored
# annotation (name, subtype, feeling, effort, notes, ...) and must survive a
# re-sync untouched, so upserts never list those in DO UPDATE.
ACTIVITY_SYNCED_COLUMNS = (
    "activity_type",
    "start_time",
    "duration_s",
    "distance_m",
    "avg_hr",
    "max_hr",
    "elevation_gain_m",
    "calories",
    "avg_speed_mps",
    "avg_power_w",
    "start_lat",
    "start_lng",
    "synced_at",
)


@contextmanager
def connect(database_url: str) -> Iterator[psycopg.Connection]:
    with psycopg.connect(database_url) as conn:
        yield conn


def _upsert_statement(
    table: str, columns: Sequence[str], conflict: Sequence[str], updates: Sequence[str]
) -> sql.Composed:
    return sql.SQL(
        "INSERT INTO {table} ({columns}) VALUES ({values}) "
        "ON CONFLICT ({conflict}) DO UPDATE SET {updates}"
    ).format(
        table=sql.Identifier(table),
        columns=sql.SQL(", ").join(sql.Identifier(col) for col in columns),
        values=sql.SQL(", ").join(sql.Placeholder() * len(columns)),
        conflict=sql.SQL(", ").join(sql.Identifier(col) for col in conflict),
        updates=sql.SQL(", ").join(
            sql.SQL("{col} = EXCLUDED.{col}").format(col=sql.Identifier(col))
            for col in updates
        ),
    )


def upsert_activity(conn: psycopg.Connection, values: dict[str, object]) -> int:
    """Insert or refresh one activity, returning its primary key.

    `name` and `subtype` are seeded on first insert only: they are user-editable
    afterwards, so they are deliberately absent from the update list.
    """
    columns = ("garmin_activity_id", *ACTIVITY_SYNCED_COLUMNS, "name", "subtype")
    statement = _upsert_statement(
        "activities", columns, ("garmin_activity_id",), ACTIVITY_SYNCED_COLUMNS
    ) + sql.SQL(" RETURNING id")
    with conn.cursor() as cur:
        cur.execute(statement, [values.get(col) for col in columns])
        row = cur.fetchone()
    if row is None:
        raise RuntimeError("activity upsert returned no id")
    return int(row[0])


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


def known_garmin_activity_ids(conn: psycopg.Connection) -> set[int]:
    with conn.cursor() as cur:
        cur.execute("SELECT garmin_activity_id FROM activities")
        return {int(row[0]) for row in cur.fetchall()}


def upsert_rows(
    conn: psycopg.Connection,
    table: str,
    conflict: Sequence[str],
    rows: Sequence[dict[str, object]],
) -> int:
    """Generic upsert for the daily-summary tables (sleep, HRV, readiness)."""
    if not rows:
        return 0
    columns = tuple(rows[0])
    statement = _upsert_statement(table, columns, conflict, columns)
    with conn.cursor() as cur:
        cur.executemany(statement, [[row[col] for col in columns] for row in rows])
    return len(rows)
