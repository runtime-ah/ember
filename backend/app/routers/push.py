from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.database import get_db

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get("/vapid-public-key")
def get_vapid_public_key():
    return {"key": settings.vapid_public_key, "enabled": bool(settings.vapid_public_key)}


@router.post("/subscribe", response_model=schemas.PushSubscribeOut, status_code=status.HTTP_201_CREATED)
def subscribe(payload: schemas.PushSubscribeIn, db: Session = Depends(get_db)):
    existing = db.scalars(
        select(models.PushSubscription).where(
            models.PushSubscription.endpoint == payload.endpoint
        )
    ).first()
    if existing:
        existing.p256dh = payload.p256dh
        existing.auth = payload.auth
        existing.ua_label = payload.ua_label
        db.commit()
        db.refresh(existing)
        return existing
    sub = models.PushSubscription(**payload.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(payload: dict, db: Session = Depends(get_db)):
    endpoint = payload.get("endpoint", "")
    sub = db.scalars(
        select(models.PushSubscription).where(
            models.PushSubscription.endpoint == endpoint
        )
    ).first()
    if sub:
        db.delete(sub)
        db.commit()
