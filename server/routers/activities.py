from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..garmin import fit
from ..models import Activity
from ..schemas import ActivityStreams, AnnotationUpdate

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


@router.get("/food-options")
def food_options(session: Session = Depends(get_session)) -> list[str]:
    """Distinct foods used across all activities — the learned suggestion vocabulary
    for the food_during / food_after inputs. (Declared before /{activity_id}.)"""
    foods: set[str] = set()
    for activity in session.exec(select(Activity)):
        for lst in (activity.food_during, activity.food_after):
            if lst:
                foods.update(lst)
    return sorted(foods)


@router.get("/{activity_id}")
def get_activity(
    activity_id: int, session: Session = Depends(get_session)
) -> Activity:
    activity = session.get(Activity, activity_id)
    if not activity:
        raise HTTPException(404, "Activity not found")
    return activity


@router.get("/{activity_id}/streams")
def activity_streams(
    activity_id: int, session: Session = Depends(get_session)
) -> ActivityStreams:
    """Per-record time-series parsed on demand from the raw .fit (HR for now)."""
    activity = session.get(Activity, activity_id)
    if not activity:
        raise HTTPException(404, "Activity not found")
    return ActivityStreams(
        activity_id=activity_id,
        heart_rate=fit.heart_rate(activity.fit_path),
        elevation=fit.elevation(activity.fit_path),
        track=fit.track(activity.fit_path),
    )


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
