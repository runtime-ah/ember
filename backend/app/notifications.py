import json
import logging

from app.config import settings

log = logging.getLogger("todo.notifications")


def send_web_push(sub: "PushSubscription", payload: dict) -> bool | str:  # type: ignore[name-defined]
    """Send a Web Push to one subscription. Returns True on success, False on
    transient error, or 'GONE' when the subscription is no longer valid (caller
    should prune it)."""
    if not settings.vapid_private_key:
        return False

    try:
        from pywebpush import WebPushException, webpush

        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
        )
        return True
    except Exception as exc:
        try:
            from pywebpush import WebPushException
            if isinstance(exc, WebPushException):
                resp = exc.response  # type: ignore[attr-defined]
                if resp is not None and resp.status_code in (404, 410):
                    return "GONE"
        except ImportError:
            pass
        log.error("Web Push failed: %s", exc)
        return False


def dispatch_notification(
    message: str,
    *,
    title: str | None = None,
    priority: int | None = None,
    tags: list[str] | None = None,
    click: str | None = None,
) -> None:
    """Send a Web Push notification to all registered subscriptions."""
    if not settings.vapid_private_key:
        return

    from sqlalchemy import delete, select

    from app.database import SessionLocal
    from app.models import PushSubscription

    payload = {"title": title or "Ember", "body": message, "url": click or "./"}
    with SessionLocal() as db:
        subs = db.scalars(select(PushSubscription)).all()
        dead: list[int] = []
        for sub in subs:
            result = send_web_push(sub, payload)
            if result == "GONE":
                dead.append(sub.id)
        if dead:
            db.execute(delete(PushSubscription).where(PushSubscription.id.in_(dead)))
            db.commit()
            log.info("Pruned %d dead push subscription(s)", len(dead))
