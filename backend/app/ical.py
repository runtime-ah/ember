"""Read-only iCloud calendar access over CalDAV, for a date range.

Used by both the calendar view (/api/calendar) and the daily brief. Returns []
on any error or when credentials aren't configured, so callers never break.
Results are cached briefly to avoid hammering iCloud while navigating months.
"""

import logging
import time as _time
from datetime import date, datetime, time

from app.config import settings

log = logging.getLogger("todo.ical")

_cache: dict[tuple[str, str], tuple[float, list[dict]]] = {}
_TTL_SECONDS = 60


def is_configured() -> bool:
    return bool(settings.caldav_username and settings.caldav_password)


def fetch_events(start: date, end: date) -> list[dict]:
    """Events between start and end (inclusive), recurrences expanded.

    Each event: {summary, date (YYYY-MM-DD), start (ISO), end (ISO|None), all_day}.
    """
    if not is_configured():
        return []

    key = (start.isoformat(), end.isoformat())
    now = _time.time()
    cached = _cache.get(key)
    if cached and now - cached[0] < _TTL_SECONDS:
        return cached[1]

    events: list[dict] = []
    try:
        import caldav

        client = caldav.DAVClient(
            url=settings.caldav_url,
            username=settings.caldav_username,
            password=settings.caldav_password,
        )
        principal = client.principal()
        start_dt = datetime.combine(start, time.min)
        end_dt = datetime.combine(end, time.max)

        for calendar in principal.calendars():
            try:
                results = calendar.search(start=start_dt, end=end_dt, event=True, expand=True)
            except Exception:  # noqa: BLE001 — skip calendars that reject the search
                continue
            for ev in results:
                comp = ev.icalendar_component
                if comp is None:
                    continue
                dtstart = comp.get("dtstart")
                if dtstart is None:
                    continue
                sval = dtstart.dt
                all_day = not isinstance(sval, datetime)
                day = sval.date() if isinstance(sval, datetime) else sval
                dtend = comp.get("dtend")
                events.append(
                    {
                        "summary": str(comp.get("summary", "(untitled)")),
                        "date": day.isoformat(),
                        "start": sval.isoformat(),
                        "end": dtend.dt.isoformat() if dtend is not None else None,
                        "all_day": all_day,
                    }
                )
        events.sort(key=lambda e: (e["date"], 0 if e["all_day"] else 1, e["start"]))
        _cache[key] = (now, events)
    except Exception as e:  # noqa: BLE001 — calendar is best-effort
        log.warning("CalDAV fetch failed: %s", e)
        return []

    return events
