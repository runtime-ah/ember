import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import select

from app.brief import build_brief, format_brief_text
from app.config import settings
from app.database import SessionLocal
from app.models import Task
from app.notifications import send_push

log = logging.getLogger("todo.scheduler")

scheduler = BackgroundScheduler()

_DAILY_BRIEF_ID = "daily-brief"


def _reminder_job_id(task_id: int) -> str:
    return f"reminder:{task_id}"


def _fire_reminder(task_id: int) -> None:
    """Runs at a task's reminder_time. Reloads the task so we don't notify for
    something completed or deleted since the job was scheduled."""
    with SessionLocal() as db:
        task = db.get(Task, task_id)
        if task is None or task.completed or task.reminder_time is None:
            return
        send_push(
            task.content,
            title="Reminder",
            priority=4,
            tags=["bell"],
        )


def sync_reminder(task: Task) -> None:
    """Schedule (or reschedule) a task's reminder. Removes any existing job and
    only re-adds it if the reminder is pending and in the future."""
    job_id = _reminder_job_id(task.id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    if task.completed or task.reminder_time is None:
        return
    if task.reminder_time <= datetime.now():
        return

    scheduler.add_job(
        _fire_reminder,
        trigger=DateTrigger(run_date=task.reminder_time),
        args=[task.id],
        id=job_id,
        replace_existing=True,
    )


def remove_reminder(task_id: int) -> None:
    job_id = _reminder_job_id(task_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


def _send_daily_brief() -> None:
    with SessionLocal() as db:
        brief = build_brief(db)
    send_push(format_brief_text(brief), title="Daily Brief", priority=3, tags=["calendar"])


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
    """On startup, schedule reminders for all pending future tasks. Reminders
    whose time already passed while the server was down are skipped (we don't
    want to fire stale notifications on every boot)."""
    with SessionLocal() as db:
        tasks = db.scalars(
            select(Task).where(
                Task.completed.is_(False),
                Task.reminder_time.is_not(None),
                Task.reminder_time > datetime.now(),
            )
        ).all()
        for task in tasks:
            sync_reminder(task)
    log.info("Scheduled %d pending reminder(s)", len(tasks))


def start_scheduler() -> None:
    scheduler.start()
    _schedule_daily_brief()
    _schedule_existing_reminders()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
