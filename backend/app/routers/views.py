from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/views", tags=["views"])


def _get_or_404(db: Session, view_id: int) -> models.View:
    view = db.get(models.View, view_id)
    if view is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "View not found")
    return view


@router.get("", response_model=list[schemas.ViewOut])
def list_views(db: Session = Depends(get_db)):
    return db.scalars(select(models.View).order_by(models.View.order, models.View.id)).all()


@router.post("", response_model=schemas.ViewOut, status_code=status.HTTP_201_CREATED)
def create_view(payload: schemas.ViewCreate, db: Session = Depends(get_db)):
    view = models.View(**payload.model_dump())
    db.add(view)
    db.commit()
    db.refresh(view)
    return view


@router.patch("/{view_id}", response_model=schemas.ViewOut)
def update_view(view_id: int, payload: schemas.ViewUpdate, db: Session = Depends(get_db)):
    view = _get_or_404(db, view_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(view, field, value)
    db.commit()
    db.refresh(view)
    return view


@router.delete("/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_view(view_id: int, db: Session = Depends(get_db)):
    view = _get_or_404(db, view_id)
    db.delete(view)
    db.commit()
