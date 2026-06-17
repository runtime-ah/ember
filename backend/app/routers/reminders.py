from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.scheduler import remove_reminder, sync_reminder

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _get_or_404(db: Session, reminder_id: int) -> models.Reminder:
    rem = db.get(models.Reminder, reminder_id)
    if rem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reminder not found")
    return rem


@router.get("", response_model=list[schemas.ReminderOut])
def list_reminders(
    include_past: bool = Query(False),
    task_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    stmt = select(models.Reminder)
    if task_id is not None:
        stmt = stmt.where(models.Reminder.task_id == task_id)
    if not include_past:
        stmt = stmt.where(
            or_(
                models.Reminder.fire_time >= datetime.now(),
                models.Reminder.recurrence_rule.is_not(None),
            )
        )
    stmt = stmt.order_by(models.Reminder.fire_time, models.Reminder.id)
    return db.scalars(stmt).all()


@router.post("", response_model=schemas.ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(payload: schemas.ReminderCreate, db: Session = Depends(get_db)):
    if payload.task_id is not None and db.get(models.Task, payload.task_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    rem = models.Reminder(**payload.model_dump())
    db.add(rem)
    db.commit()
    db.refresh(rem)
    sync_reminder(rem)
    return rem


@router.get("/{reminder_id}", response_model=schemas.ReminderOut)
def get_reminder(reminder_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, reminder_id)


@router.patch("/{reminder_id}", response_model=schemas.ReminderOut)
def update_reminder(
    reminder_id: int, payload: schemas.ReminderUpdate, db: Session = Depends(get_db)
):
    rem = _get_or_404(db, reminder_id)
    data = payload.model_dump(exclude_unset=True)
    if "task_id" in data and data["task_id"] is not None:
        if db.get(models.Task, data["task_id"]) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    for field, value in data.items():
        setattr(rem, field, value)
    # Editing fire_time or recurrence resets sent state.
    if "fire_time" in data or "recurrence_rule" in data:
        rem.sent = False
        rem.sent_at = None
    db.commit()
    db.refresh(rem)
    sync_reminder(rem)
    return rem


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    rem = _get_or_404(db, reminder_id)
    remove_reminder(rem.id)
    db.delete(rem)
    db.commit()
