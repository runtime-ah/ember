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


def init_db() -> None:
    # Import models so they register on Base.metadata before create_all.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _run_lightweight_migrations()


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
    }
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in additions.items():
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl_type in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}"))
