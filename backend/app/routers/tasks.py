from datetime import date, datetime

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


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(
    project_id: int | None = None,
    section_id: int | None = None,
    parent_id: int | None = None,
    priority: int | None = None,
    due_date: date | None = None,
    completed: bool | None = None,
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
    if completed is not None:
        stmt = stmt.where(models.Task.completed == completed)
    stmt = stmt.order_by(models.Task.order, models.Task.id)
    return db.scalars(stmt).all()


@router.post("", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    if db.get(models.Project, payload.project_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    _validate_parent(db, payload.parent_id)
    task = models.Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    sync_reminder(task)
    return task


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, task_id)


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = _get_or_404(db, task_id)
    data = payload.model_dump(exclude_unset=True)
    if "project_id" in data and db.get(models.Project, data["project_id"]) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    for field, value in data.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    sync_reminder(task)
    return task


@router.post("/{task_id}/complete", response_model=schemas.TaskOut)
def complete_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_or_404(db, task_id)
    task.completed = True
    task.completed_at = datetime.now()
    db.commit()
    db.refresh(task)
    remove_reminder(task.id)
    return task


@router.post("/{task_id}/uncomplete", response_model=schemas.TaskOut)
def uncomplete_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_or_404(db, task_id)
    task.completed = False
    task.completed_at = None
    db.commit()
    db.refresh(task)
    sync_reminder(task)
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
    db.delete(task)
    db.commit()
    remove_reminder(task_id)
