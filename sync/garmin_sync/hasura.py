"""Summary writes, through Hasura's GraphQL API.

Activities and the daily summaries (sleep, HRV, readiness) are low-volume and
share their table with user-authored annotations, so they go through Hasura
rather than raw SQL: one schema and permission contract, and `on_conflict`
update lists that name only the sync-owned columns so annotations survive a
re-sync. The sample hypertable is the sole exception; COPY loads it directly
(see `db.py`).

Table and constraint names below are fixed identifiers baked into the schema,
never user input, so interpolating them into the query text is safe; every
actual value travels as a GraphQL variable.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import requests

from .normalize import ACTIVITY_SYNCED_COLUMNS

log = logging.getLogger(__name__)


class HasuraError(RuntimeError):
    """A GraphQL request failed, either at the transport or the query level."""


@dataclass(frozen=True)
class _Table:
    """The generated GraphQL names Hasura derives for one tracked table."""

    insert_input: str
    update_column: str
    constraint: str


# The daily-summary tables written in bulk. Their constraint names come from the
# database's unique keys; update lists cover every column, since none of these
# tables carries user-authored data.
_TABLES = {
    "sleep": _Table(
        "sleep_insert_input", "sleep_update_column", "sleep_calendar_date_key"
    ),
    "daily_hrv": _Table(
        "daily_hrv_insert_input",
        "daily_hrv_update_column",
        "daily_hrv_calendar_date_key",
    ),
    "training_readiness": _Table(
        "training_readiness_insert_input",
        "training_readiness_update_column",
        "training_readiness_calendar_date_timestamp_key",
    ),
}


def _json_default(value: object) -> str:
    """Serialise the types normalize emits that JSON does not cover natively."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    raise TypeError(f"cannot serialise {type(value).__name__} to JSON")


class Hasura:
    """A thin GraphQL client scoped to this sync's summary writes."""

    def __init__(
        self,
        url: str,
        admin_secret: str,
        *,
        session: requests.Session | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._url = url
        self._timeout = timeout
        self._session = session or requests.Session()
        self._session.headers.update(
            {
                "content-type": "application/json",
                "x-hasura-admin-secret": admin_secret,
            }
        )

    def __enter__(self) -> Hasura:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._session.close()

    def execute(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        payload = json.dumps(
            {"query": query, "variables": variables}, default=_json_default
        )
        try:
            response = self._session.post(
                self._url, data=payload, timeout=self._timeout
            )
            response.raise_for_status()
            body = response.json()
        except requests.RequestException as exc:
            raise HasuraError(f"GraphQL request failed: {exc}") from exc
        if body.get("errors"):
            raise HasuraError(f"GraphQL errors: {body['errors']}")
        return body["data"]

    def known_garmin_activity_ids(self) -> set[int]:
        data = self.execute("query { activities { garmin_activity_id } }", {})
        return {int(row["garmin_activity_id"]) for row in data["activities"]}

    def upsert_activity(self, row: dict[str, Any]) -> int:
        """Insert or refresh one activity, returning its primary key.

        The update list is exactly the sync-owned columns, so a re-sync never
        touches annotations; `name` and `subtype` ride along on the insert but,
        being absent from that list, are only ever seeded.
        """
        query = (
            "mutation("
            "$obj: activities_insert_input!, "
            "$cols: [activities_update_column!]!) {"
            " insert_activities_one(object: $obj, on_conflict: {"
            " constraint: activities_garmin_activity_id_key,"
            " update_columns: $cols}) { id } }"
        )
        data = self.execute(query, {"obj": row, "cols": list(ACTIVITY_SYNCED_COLUMNS)})
        result = data.get("insert_activities_one")
        if not result:
            raise HasuraError("activity upsert returned no row")
        return int(result["id"])

    def upsert_rows(self, table: str, rows: list[dict[str, Any]]) -> int:
        """Upsert daily-summary rows, refreshing every column on conflict."""
        if not rows:
            return 0
        meta = _TABLES[table]
        # Union of keys across rows, so a row that omits an optional field does
        # not shorten the shared update list.
        columns = sorted({key for row in rows for key in row})
        query = (
            f"mutation($objects: [{meta.insert_input}!]!,"
            f" $cols: [{meta.update_column}!]!) {{"
            f" insert_{table}(objects: $objects, on_conflict: {{"
            f" constraint: {meta.constraint}, update_columns: $cols}})"
            " { affected_rows } }"
        )
        data = self.execute(query, {"objects": rows, "cols": columns})
        return int(data[f"insert_{table}"]["affected_rows"])
