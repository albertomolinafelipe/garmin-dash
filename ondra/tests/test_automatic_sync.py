import asyncio

import pytest

from app.main import (
    AUTOMATIC_SYNC_DAYS,
    AUTOMATIC_SYNC_INTERVAL_S,
    AUTOMATIC_SYNC_MAX_ACTIVITIES,
    Settings,
    _automatic_sync_loop,
)

SETTINGS = Settings(
    remote_schema_secret="remote-secret",
    hasura_graphql_url="http://hasura.test/v1/graphql",
    hasura_admin_secret="admin-secret",
)


def test_automatic_sync_runs_immediately_then_waits_24_hours(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sync_calls: list[tuple[int, int]] = []
    sleep_calls: list[int] = []

    async def fake_run_sync(
        settings: Settings, *, days: int, max_activities: int
    ) -> None:
        assert settings is SETTINGS
        sync_calls.append((days, max_activities))

    async def stop_after_first_sleep(seconds: int) -> None:
        sleep_calls.append(seconds)
        raise asyncio.CancelledError

    monkeypatch.setattr("app.main._run_sync", fake_run_sync)
    monkeypatch.setattr("app.main.asyncio.sleep", stop_after_first_sleep)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(_automatic_sync_loop(SETTINGS))

    expected_sync_call = (AUTOMATIC_SYNC_DAYS, AUTOMATIC_SYNC_MAX_ACTIVITIES)
    assert sync_calls == [expected_sync_call]
    assert sleep_calls == [AUTOMATIC_SYNC_INTERVAL_S]
