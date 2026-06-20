from calendar import monthrange
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.scheduler import remove_reminder, sync_reminder

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_or_404(db: Session, task_id: int) -> models.Task:
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


def _validate_parent(db: Session, parent_id: int | None) -> None:
    """Subtasks are one level deep: a parent must itself be a top-level task."""
    if parent_id is None:
        return
    parent = db.get(models.Task, parent_id)
    if parent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent task not found")
    if parent.parent_id is not None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Subtasks can only be one level deep"
        )


def _sync_labels(db: Session, task: models.Task, label_ids: list[int]) -> None:
    if not label_ids:
        task.labels = []
        return
    labels = db.scalars(
        select(models.Label).where(models.Label.id.in_(label_ids))
    ).all()
    task.labels = list(labels)


def _reminders_for_task(db: Session, task_id: int) -> list[models.Reminder]:
    return list(db.scalars(
        select(models.Reminder).where(models.Reminder.task_id == task_id)
    ).all())


def _promote_reminder_time(db: Session, task: models.Task, fire_time: datetime) -> None:
    """Create a Reminder row from a task-level reminder_time and schedule it.
    Clears task.reminder_time so the two systems don't diverge."""
    rem = models.Reminder(task_id=task.id, message=task.content, fire_time=fire_time)
    db.add(rem)
    db.flush()
    sync_reminder(rem)
    task.reminder_time = None


def _next_due_date(rule: str, current: date | None) -> date:
    base = current or date.today()
    if rule == "daily":
        return base + timedelta(days=1)
    if rule == "weekdays":
        d = base + timedelta(days=1)
        while d.weekday() >= 5:
            d += timedelta(days=1)
        return d
    if rule == "weekly":
        return base + timedelta(weeks=1)
    if rule == "biweekly":
        return base + timedelta(weeks=2)
    if rule == "monthly":
        y, m, d = base.year, base.month, base.day
        m += 1
        if m > 12:
            m, y = 1, y + 1
        d = min(d, monthrange(y, m)[1])
        return date(y, m, d)
    return base + timedelta(days=1)


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(
    project_id: int | None = None,
    section_id: int | None = None,
    parent_id: int | None = None,
    priority: int | None = None,
    due_date: date | None = None,
    due_before: date | None = None,
    due_after: date | None = None,
    label_id: int | None = None,
    completed: bool | None = None,
    no_due_date: bool | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(models.Task)
    if project_id is not None:
        stmt = stmt.where(models.Task.project_id == project_id)
    if section_id is not None:
        stmt = stmt.where(models.Task.section_id == section_id)
    if parent_id is not None:
        stmt = stmt.where(models.Task.parent_id == parent_id)
    if priority is not None:
        stmt = stmt.where(models.Task.priority == priority)
    if due_date is not None:
        stmt = stmt.where(models.Task.due_date == due_date)
    if due_before is not None:
        stmt = stmt.where(models.Task.due_date <= due_before)
    if due_after is not None:
        stmt = stmt.where(models.Task.due_date >= due_after)
    if label_id is not None:
        stmt = stmt.where(models.Task.labels.any(models.Label.id == label_id))
    if completed is not None:
        stmt = stmt.where(models.Task.completed == completed)
    if no_due_date is True:
        stmt = stmt.where(models.Task.due_date == None)  # noqa: E711
    stmt = stmt.order_by(models.Task.order, models.Task.id)
    return db.scalars(stmt).all()


@router.post("", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    if db.get(models.Project, payload.project_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    _validate_parent(db, payload.parent_id)
    data = payload.model_dump(exclude={"label_ids"})
    reminder_time = data.pop("reminder_time", None)
    task = models.Task(**data)
    db.add(task)
    db.flush()  # get task.id before syncing labels and creating reminder
    _sync_labels(db, task, payload.label_ids)
    if reminder_time:
        _promote_reminder_time(db, task, reminder_time)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, task_id)


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = _get_or_404(db, task_id)
    data = payload.model_dump(exclude_unset=True, exclude={"label_ids"})
    if "project_id" in data and db.get(models.Project, data["project_id"]) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    reminder_time = data.pop("reminder_time", None)
    for field, value in data.items():
        setattr(task, field, value)
    if payload.label_ids is not None:
        _sync_labels(db, task, payload.label_ids)
    if reminder_time is not None:
        _promote_reminder_time(db, task, reminder_time)
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/complete", response_model=schemas.TaskOut)
def complete_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_or_404(db, task_id)
    task.completed = True
    task.completed_at = datetime.now()
    # Silence any pending reminders for this task.
    for rem in _reminders_for_task(db, task.id):
        remove_reminder(rem.id)
        rem.sent = True
    db.commit()
    db.refresh(task)

    # Spawn the next occurrence for top-level recurring tasks.
    if task.recurrence_rule and task.parent_id is None:
        next_due = _next_due_date(task.recurrence_rule, task.due_date)
        next_task = models.Task(
            project_id=task.project_id,
            section_id=task.section_id,
            content=task.content,
            description=task.description,
            priority=task.priority,
            effort=task.effort,
            recurrence_rule=task.recurrence_rule,
            due_date=next_due,
            order=task.order,
        )
        next_task.labels = list(task.labels)
        db.add(next_task)
        db.commit()
        db.refresh(next_task)

    return task


@router.post("/{task_id}/uncomplete", response_model=schemas.TaskOut)
def uncomplete_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_or_404(db, task_id)
    task.completed = False
    task.completed_at = None
    # Re-arm any future reminders that were silenced when the task was completed.
    for rem in _reminders_for_task(db, task.id):
        if rem.fire_time > datetime.now():
            rem.sent = False
            rem.sent_at = None
    db.commit()
    db.refresh(task)
    for rem in _reminders_for_task(db, task.id):
        sync_reminder(rem)
    return task


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_tasks(payload: schemas.ReorderRequest, db: Session = Depends(get_db)):
    ids = [item.id for item in payload.items]
    tasks = {t.id: t for t in db.scalars(select(models.Task).where(models.Task.id.in_(ids)))}
    for item in payload.items:
        task = tasks.get(item.id)
        if task is not None:
            task.order = item.order
    db.commit()


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_or_404(db, task_id)
    # Remove in-memory scheduler jobs before DB cascade deletes the rows.
    for rem in _reminders_for_task(db, task_id):
        remove_reminder(rem.id)
    db.delete(task)
    db.commit()
