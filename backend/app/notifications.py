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
