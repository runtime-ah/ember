import logging
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import ical
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
        "events": ical.fetch_events(day, day),
    }


def _event_label(e: dict) -> str:
    when = "all day" if e["all_day"] else e["start"][11:16]  # HH:MM
    return f"{when} — {e['summary']}"


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
    section("🗓️ Today's events", [_event_label(e) for e in brief["events"]])

    if not lines:
        return "Nothing on the radar today. 🎉"
    return "\n".join(lines).strip()
