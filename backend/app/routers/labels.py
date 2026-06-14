from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/labels", tags=["labels"])


def _get_or_404(db: Session, label_id: int) -> models.Label:
    label = db.get(models.Label, label_id)
    if label is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Label not found")
    return label


@router.get("", response_model=list[schemas.LabelOut])
def list_labels(db: Session = Depends(get_db)):
    return db.scalars(select(models.Label).order_by(models.Label.order, models.Label.id)).all()


@router.post("", response_model=schemas.LabelOut, status_code=status.HTTP_201_CREATED)
def create_label(payload: schemas.LabelCreate, db: Session = Depends(get_db)):
    existing = db.scalars(
        select(models.Label).where(models.Label.name == payload.name)
    ).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Label name already exists")
    label = models.Label(**payload.model_dump())
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.patch("/{label_id}", response_model=schemas.LabelOut)
def update_label(label_id: int, payload: schemas.LabelUpdate, db: Session = Depends(get_db)):
    label = _get_or_404(db, label_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(label, field, value)
    db.commit()
    db.refresh(label)
    return label


@router.delete("/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_label(label_id: int, db: Session = Depends(get_db)):
    label = _get_or_404(db, label_id)
    db.delete(label)
    db.commit()
