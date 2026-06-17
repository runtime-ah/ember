import logging
from calendar import monthrange
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import select

from app.brief import build_brief, format_brief_text
from app.config import settings
from app.database import SessionLocal
from app.models import Reminder, Task
from app.notifications import dispatch_notification

log = logging.getLogger("todo.scheduler")

scheduler = BackgroundScheduler()

_DAILY_BRIEF_ID = "daily-brief"


def _reminder_job_id(reminder_id: int) -> str:
    return f"reminder:{reminder_id}"


def _next_fire_time(rule: str, current: datetime) -> datetime:
    """Advance fire_time by one recurrence interval, preserving time-of-day."""
    d = current.date()
    t = current.time()
    if rule == "daily":
        d = d + timedelta(days=1)
    elif rule == "weekdays":
        d = d + timedelta(days=1)
        while d.weekday() >= 5:
            d += timedelta(days=1)
    elif rule == "weekly":
        d = d + timedelta(weeks=1)
    elif rule == "biweekly":
        d = d + timedelta(weeks=2)
    elif rule == "monthly":
        y, m, day = d.year, d.month, d.day
        m += 1
        if m > 12:
            m, y = 1, y + 1
        day = min(day, monthrange(y, m)[1])
        d = d.replace(year=y, month=m, day=day)
    else:
        d = d + timedelta(days=1)
    return datetime.combine(d, t)


def _fire_reminder(reminder_id: int) -> None:
    """Runs at a reminder's fire_time. Reloads from DB so we don't notify for
    reminders whose linked task has since been completed or deleted."""
    with SessionLocal() as db:
        rem = db.get(Reminder, reminder_id)
        if rem is None:
            return
        if rem.task_id is not None:
            task = db.get(Task, rem.task_id)
            if task is None or task.completed:
                return
        dispatch_notification(rem.message, title="Reminder", priority=4, tags=["bell"])
        if rem.recurrence_rule:
            rem.fire_time = _next_fire_time(rem.recurrence_rule, rem.fire_time)
            db.commit()
            sync_reminder(rem)
        else:
            rem.sent = True
            rem.sent_at = datetime.now()
            db.commit()


def sync_reminder(reminder: Reminder) -> None:
    """Schedule (or reschedule) a reminder. Removes any existing job and only
    re-adds it if the reminder is still pending and in the future."""
    job_id = _reminder_job_id(reminder.id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    if reminder.sent and not reminder.recurrence_rule:
        return
    if reminder.fire_time <= datetime.now():
        return

    scheduler.add_job(
        _fire_reminder,
        trigger=DateTrigger(run_date=reminder.fire_time),
        args=[reminder.id],
        id=job_id,
        replace_existing=True,
    )


def remove_reminder(reminder_id: int) -> None:
    job_id = _reminder_job_id(reminder_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


def _send_daily_brief() -> None:
    with SessionLocal() as db:
        brief = build_brief(db)
    dispatch_notification(
        format_brief_text(brief), title="Daily Brief", priority=3, tags=["calendar"]
    )


def _schedule_daily_brief() -> None:
    try:
        hour, minute = (int(x) for x in settings.brief_time.split(":"))
    except ValueError:
        log.error("Invalid TODO_BRIEF_TIME %r; expected HH:MM", settings.brief_time)
        return
    scheduler.add_job(
        _send_daily_brief,
        trigger=CronTrigger(hour=hour, minute=minute),
        id=_DAILY_BRIEF_ID,
        replace_existing=True,
    )


def _schedule_existing_reminders() -> None:
    """On startup, schedule all pending future reminders. Already-fired one-shots
    and past reminders are skipped — we don't want stale notifications on every boot."""
    with SessionLocal() as db:
        reminders = db.scalars(
            select(Reminder).where(
                Reminder.fire_time > datetime.now(),
                (Reminder.sent == False) | (Reminder.recurrence_rule.is_not(None)),  # noqa: E712
            )
        ).all()
        for rem in reminders:
            sync_reminder(rem)
    log.info("Scheduled %d pending reminder(s)", len(reminders))


def start_scheduler() -> None:
    scheduler.start()
    _schedule_daily_brief()
    _schedule_existing_reminders()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
