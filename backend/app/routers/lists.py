from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/lists", tags=["lists"])


def _get_or_404(db: Session, list_id: int) -> models.List:
    lst = db.get(models.List, list_id)
    if lst is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "List not found")
    return lst


def _get_item_or_404(db: Session, list_id: int, item_id: int) -> models.ListItem:
    item = db.get(models.ListItem, item_id)
    if item is None or item.list_id != list_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@router.get("", response_model=list[schemas.ListOut])
def get_lists(
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
):
    stmt = select(models.List)
    if not include_archived:
        stmt = stmt.where(models.List.archived == False)  # noqa: E712
    stmt = stmt.order_by(models.List.order, models.List.id)
    return db.scalars(stmt).all()


@router.post("", response_model=schemas.ListOut, status_code=status.HTTP_201_CREATED)
def create_list(payload: schemas.ListCreate, db: Session = Depends(get_db)):
    lst = models.List(**payload.model_dump())
    db.add(lst)
    db.commit()
    db.refresh(lst)
    return lst


@router.get("/{list_id}", response_model=schemas.ListOut)
def get_list(list_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, list_id)


@router.patch("/{list_id}", response_model=schemas.ListOut)
def update_list(list_id: int, payload: schemas.ListUpdate, db: Session = Depends(get_db)):
    lst = _get_or_404(db, list_id)
    data = payload.model_dump(exclude_unset=True)
    if "archived" in data:
        data["archived_at"] = datetime.utcnow() if data["archived"] else None
    for field, value in data.items():
        setattr(lst, field, value)
    db.commit()
    db.refresh(lst)
    return lst


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(list_id: int, db: Session = Depends(get_db)):
    lst = _get_or_404(db, list_id)
    db.delete(lst)
    db.commit()


@router.post("/{list_id}/reset", response_model=schemas.ListOut)
def reset_list(list_id: int, db: Session = Depends(get_db)):
    """Uncheck all items in the list."""
    lst = _get_or_404(db, list_id)
    for item in lst.items:
        item.checked = False
    db.commit()
    db.refresh(lst)
    return lst


@router.post("/{list_id}/items", response_model=schemas.ListItemOut, status_code=status.HTTP_201_CREATED)
def add_item(list_id: int, payload: schemas.ListItemCreate, db: Session = Depends(get_db)):
    _get_or_404(db, list_id)
    item = models.ListItem(list_id=list_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{list_id}/items/{item_id}", response_model=schemas.ListItemOut)
def update_item(
    list_id: int, item_id: int, payload: schemas.ListItemUpdate, db: Session = Depends(get_db)
):
    item = _get_item_or_404(db, list_id, item_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(list_id: int, item_id: int, db: Session = Depends(get_db)):
    item = _get_item_or_404(db, list_id, item_id)
    db.delete(item)
    db.commit()


@router.post("/{list_id}/items/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_items(list_id: int, payload: schemas.ReorderRequest, db: Session = Depends(get_db)):
    _get_or_404(db, list_id)
    ids = [i.id for i in payload.items]
    items = {
        i.id: i
        for i in db.scalars(select(models.ListItem).where(models.ListItem.id.in_(ids)))
    }
    for ri in payload.items:
        item = items.get(ri.id)
        if item:
            item.order = ri.order
    db.commit()
