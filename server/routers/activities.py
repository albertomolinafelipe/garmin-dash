from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models import Activity
from ..schemas import AnnotationUpdate

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("")
def list_activities(
    limit: int = 100,
    offset: int = 0,
    activity_type: str | None = None,
    annotated: bool | None = None,
    session: Session = Depends(get_session),
) -> list[Activity]:
    stmt = select(Activity)
    if activity_type:
        stmt = stmt.where(Activity.activity_type == activity_type)
    if annotated is not None:
        stmt = stmt.where(Activity.annotated == annotated)
    stmt = stmt.order_by(Activity.start_time.desc()).offset(offset).limit(limit)
    return list(session.exec(stmt))


@router.get("/{activity_id}")
def get_activity(
    activity_id: int, session: Session = Depends(get_session)
) -> Activity:
    activity = session.get(Activity, activity_id)
    if not activity:
        raise HTTPException(404, "Activity not found")
    return activity


@router.patch("/{activity_id}")
def update_annotations(
    activity_id: int,
    body: AnnotationUpdate,
    session: Session = Depends(get_session),
) -> Activity:
    activity = session.get(Activity, activity_id)
    if not activity:
        raise HTTPException(404, "Activity not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(activity, field, value)
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity
