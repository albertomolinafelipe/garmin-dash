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
    session: Session = Depends(get_session),
) -> SyncResult:
    try:
        return sync_mod.sync(session, days=days, download_fits=download_fits)
    except GarminAuthError as exc:
        raise HTTPException(401, str(exc)) from exc
