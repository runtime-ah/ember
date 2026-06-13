from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/sections", tags=["sections"])


def _get_or_404(db: Session, section_id: int) -> models.Section:
    section = db.get(models.Section, section_id)
    if section is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Section not found")
    return section


@router.get("", response_model=list[schemas.SectionOut])
def list_sections(project_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(models.Section).order_by(models.Section.order, models.Section.id)
    if project_id is not None:
        stmt = stmt.where(models.Section.project_id == project_id)
    return db.scalars(stmt).all()


@router.post("", response_model=schemas.SectionOut, status_code=status.HTTP_201_CREATED)
def create_section(payload: schemas.SectionCreate, db: Session = Depends(get_db)):
    if db.get(models.Project, payload.project_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    section = models.Section(**payload.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@router.patch("/{section_id}", response_model=schemas.SectionOut)
def update_section(
    section_id: int, payload: schemas.SectionUpdate, db: Session = Depends(get_db)
):
    section = _get_or_404(db, section_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    db.commit()
    db.refresh(section)
    return section


@router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_section(section_id: int, db: Session = Depends(get_db)):
    section = _get_or_404(db, section_id)
    db.delete(section)
    db.commit()
