import logging
from datetime import date, datetime, time

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Task

log = logging.getLogger("todo.brief")


def _task_summary(task: Task) -> dict:
    return {
        "id": task.id,
        "content": task.content,
        "priority": task.priority,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "due_time": task.due_time.strftime("%H:%M") if task.due_time else None,
    }


def _fetch_calendar_events(day: date) -> list[dict]:
    """Read today's events from iCloud via CalDAV. Returns [] if unconfigured
    or on any error — the brief should never fail because of the calendar."""
    if not (settings.caldav_username and settings.caldav_password):
        return []
    try:
        import caldav  # imported lazily so the dep is optional at runtime

        client = caldav.DAVClient(
            url=settings.caldav_url,
            username=settings.caldav_username,
            password=settings.caldav_password,
        )
        principal = client.principal()
        start = datetime.combine(day, time.min)
        end = datetime.combine(day, time.max)

        events: list[dict] = []
        for calendar in principal.calendars():
            try:
                results = calendar.search(start=start, end=end, event=True, expand=True)
            except Exception:
                continue
            for ev in results:
                comp = ev.icalendar_component
                summary = str(comp.get("summary", "(untitled)"))
                dtstart = comp.get("dtstart")
                when = ""
                if dtstart is not None:
                    val = dtstart.dt
                    when = val.strftime("%H:%M") if isinstance(val, datetime) else "all day"
                events.append({"summary": summary, "start": when})
        events.sort(key=lambda e: e["start"])
        return events
    except Exception as e:  # noqa: BLE001 — calendar is best-effort
        log.warning("CalDAV fetch failed: %s", e)
        return []


def build_brief(db: Session, day: date | None = None) -> dict:
    """Assemble the daily brief: overdue, due today, important-undated tasks,
    plus today's calendar events."""
    day = day or date.today()

    overdue = db.scalars(
        select(Task)
        .where(Task.completed.is_(False), Task.due_date.is_not(None), Task.due_date < day)
        .order_by(Task.due_date, Task.priority)
    ).all()

    due_today = db.scalars(
        select(Task)
        .where(Task.completed.is_(False), Task.due_date == day)
        .order_by(Task.priority, Task.due_time)
    ).all()

    important = db.scalars(
        select(Task)
        .where(
            Task.completed.is_(False),
            Task.due_date.is_(None),
            or_(Task.priority == 1, Task.priority == 2),
        )
        .order_by(Task.priority)
    ).all()

    return {
        "date": day.isoformat(),
        "overdue": [_task_summary(t) for t in overdue],
        "due_today": [_task_summary(t) for t in due_today],
        "important_undated": [_task_summary(t) for t in important],
        "events": _fetch_calendar_events(day),
    }


def format_brief_text(brief: dict) -> str:
    """Render the brief as plain text suitable for an ntfy push body."""
    lines: list[str] = []

    def section(title: str, items: list[str]):
        if items:
            lines.append(title)
            lines.extend(f"• {i}" for i in items)
            lines.append("")

    def task_line(t: dict) -> str:
        prefix = f"[P{t['priority']}] " if t["priority"] < 4 else ""
        time_suffix = f" @ {t['due_time']}" if t["due_time"] else ""
        return f"{prefix}{t['content']}{time_suffix}"

    section("⚠️ Overdue", [task_line(t) for t in brief["overdue"]])
    section("📅 Due today", [task_line(t) for t in brief["due_today"]])
    section("⭐ Important (no date)", [task_line(t) for t in brief["important_undated"]])
    section(
        "🗓️ Today's events",
        [f"{e['start']} — {e['summary']}".strip(" —") for e in brief["events"]],
    )

    if not lines:
        return "Nothing on the radar today. 🎉"
    return "\n".join(lines).strip()
