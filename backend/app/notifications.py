import json
import logging

import httpx

from app.config import settings

log = logging.getLogger("todo.notifications")


def send_push(message: str, *, title: str | None = None, priority: int | None = None,
              tags: list[str] | None = None, click: str | None = None) -> bool:
    """Send a push via ntfy. No-op (returns False) if no topic is configured.

    ntfy publishes by POSTing the body to {server}/{topic} with metadata in
    headers. See https://docs.ntfy.sh/publish/.
    """
    if not settings.ntfy_topic:
        log.info("ntfy topic not configured; skipping push: %s", title or message)
        return False

    headers: dict[str, str] = {}
    if title:
        headers["Title"] = title
    if priority:
        headers["Priority"] = str(priority)  # 1 (min) .. 5 (max)
    if tags:
        headers["Tags"] = ",".join(tags)
    if click:
        headers["Click"] = click

    url = f"{settings.ntfy_server.rstrip('/')}/{settings.ntfy_topic}"
    try:
        resp = httpx.post(url, content=message.encode("utf-8"), headers=headers, timeout=10)
        resp.raise_for_status()
        return True
    except httpx.HTTPError as e:
        log.error("ntfy push failed: %s", e)
        return False


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
    """Fan-out notification to all configured channels (ntfy + Web Push)."""
    send_push(message, title=title, priority=priority, tags=tags, click=click)

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
