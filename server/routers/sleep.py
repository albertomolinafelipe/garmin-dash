from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models import Sleep
from ..schemas import AnnotationUpdate

router = APIRouter(prefix="/api/sleep", tags=["sleep"])


@router.get("")
def list_sleep(
    limit: int = 100,
    offset: int = 0,
    session: Session = Depends(get_session),
) -> list[Sleep]:
    stmt = (
        select(Sleep)
        .order_by(Sleep.calendar_date.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(session.exec(stmt))


@router.get("/{sleep_id}")
def get_sleep(sleep_id: int, session: Session = Depends(get_session)) -> Sleep:
    record = session.get(Sleep, sleep_id)
    if not record:
        raise HTTPException(404, "Sleep record not found")
    return record


@router.patch("/{sleep_id}")
def update_annotations(
    sleep_id: int,
    body: AnnotationUpdate,
    session: Session = Depends(get_session),
) -> Sleep:
    record = session.get(Sleep, sleep_id)
    if not record:
        raise HTTPException(404, "Sleep record not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record
