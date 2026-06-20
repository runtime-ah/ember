from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    # SQLite + a threaded server needs this; safe for our single-file setup.
    connect_args={"check_same_thread": False},
)


@event.listens_for(Engine, "connect")
def _enable_sqlite_fks(dbapi_connection, _connection_record):
    """SQLite ignores FK constraints unless told otherwise per-connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_task_reminder_times() -> None:
    """Convert any remaining task.reminder_time values to Reminder rows and clear
    the field. Idempotent — only touches tasks where reminder_time is still set."""
    import logging
    from datetime import datetime

    from sqlalchemy import text

    log = logging.getLogger("todo.db")
    with SessionLocal() as db:
        rows = db.execute(
            text("SELECT id, content, reminder_time, completed FROM tasks WHERE reminder_time IS NOT NULL")
        ).fetchall()
        now = datetime.now()
        inserted = 0
        for task_id, content, reminder_time_str, completed in rows:
            try:
                fire_time = datetime.fromisoformat(reminder_time_str)
            except (TypeError, ValueError):
                continue
            if not completed and fire_time > now:
                db.execute(
                    text(
                        "INSERT INTO reminders (task_id, message, fire_time, sent, \"order\", created_at)"
                        " VALUES (:task_id, :message, :fire_time, 0, 0, :now)"
                    ),
                    {"task_id": task_id, "message": content, "fire_time": reminder_time_str, "now": now.isoformat()},
                )
                inserted += 1
            db.execute(text("UPDATE tasks SET reminder_time = NULL WHERE id = :id"), {"id": task_id})
        db.commit()
    if inserted:
        log.info("Promoted %d task.reminder_time(s) to Reminder rows", inserted)


def init_db() -> None:
    # Import models so they register on Base.metadata before create_all.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _run_lightweight_migrations()
    _backfill_reminders_from_tasks()
    _migrate_task_reminder_times()


def _backfill_reminders_from_tasks() -> None:
    """One-time migration: copy task.reminder_time values into the Reminder table.
    Guarded by an empty-table check so it never duplicates on subsequent boots."""
    import logging
    from datetime import datetime

    from sqlalchemy import text

    log = logging.getLogger("todo.db")
    with SessionLocal() as db:
        count = db.execute(text("SELECT COUNT(*) FROM reminders")).scalar()
        if count and count > 0:
            return
        rows = db.execute(
            text("SELECT id, content, reminder_time, completed FROM tasks WHERE reminder_time IS NOT NULL")
        ).fetchall()
        now = datetime.now()
        inserted = 0
        for row in rows:
            task_id, content, reminder_time_str, completed = row
            if completed:
                continue
            try:
                fire_time = datetime.fromisoformat(reminder_time_str)
            except (TypeError, ValueError):
                continue
            sent = fire_time <= now
            db.execute(
                text(
                    "INSERT INTO reminders (task_id, message, fire_time, sent, sent_at, created_at)"
                    " VALUES (:task_id, :message, :fire_time, :sent, :sent_at, :now)"
                ),
                {
                    "task_id": task_id,
                    "message": content,
                    "fire_time": reminder_time_str,
                    "sent": 1 if sent else 0,
                    "sent_at": reminder_time_str if sent else None,
                    "now": now.isoformat(),
                },
            )
            inserted += 1
        db.commit()
    if inserted:
        log.info("Backfilled %d task reminder(s) into reminders table", inserted)


def _run_lightweight_migrations() -> None:
    """create_all() never alters existing tables. For this single-user app we
    handle additive columns ourselves with `ADD COLUMN ... IF NOT EXISTS`-style
    checks, rather than pulling in Alembic."""
    from sqlalchemy import inspect, text

    additions = {
        "projects": [("icon", "VARCHAR(64)"), ("pinned", "BOOLEAN DEFAULT 0"), ("archived", "BOOLEAN DEFAULT 0"), ("archived_at", "DATETIME")],
        "sections": [("icon", "VARCHAR(64)")],
        "tasks": [
            ("effort", "FLOAT"),
            ("recurrence_rule", "VARCHAR(64)"),
        ],
        "lists": [
            ("list_type", "VARCHAR(20) DEFAULT 'checkbox'"),
            ("archived", "BOOLEAN DEFAULT 0"),
            ("archived_at", "DATETIME"),
        ],
    }
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in additions.items():
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl_type in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}"))
