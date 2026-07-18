from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ..db import get_session
from ..garmin import sync as sync_mod
from ..garmin.client import GarminAuthError
from ..schemas import SyncResult

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("")
def run_sync(
    days: int = 30,
    download_fits: bool = True,
    max_activities: int | None = 50,
    session: Session = Depends(get_session),
) -> SyncResult:
    """Sync activities + sleep. Pass ``max_activities=0`` (→ unbounded) for a full
    history backfill; the default caps to the most recent activities. Resumable: safe
    to re-run to retry .fit downloads that failed (see ``fits_missing``)."""
    # 0 is the natural "no limit" value over a query string (can't pass null easily).
    limit = None if max_activities in (0, None) else max_activities
    try:
        return sync_mod.sync(
            session,
            days=days,
            download_fits=download_fits,
            max_activities=limit,
        )
    except GarminAuthError as exc:
        raise HTTPException(401, str(exc)) from exc
