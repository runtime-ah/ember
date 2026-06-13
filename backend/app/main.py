from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from datetime import date

from app import ical
from app.brief import build_brief
from app.config import settings
from app.database import get_db, init_db
from app.routers import projects, sections, tasks
from app.scheduler import shutdown_scheduler, start_scheduler


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="Todo", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(sections.router)
app.include_router(tasks.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/brief")
def get_brief(db: Session = Depends(get_db)):
    """Today's brief: overdue, due today, important undated tasks, and calendar
    events. Also pushed daily via ntfy; exposed here for on-demand use and the
    future dashboard widget."""
    return build_brief(db)


@app.get("/api/calendar")
def get_calendar(start: date, end: date):
    """iCloud calendar events between start and end (inclusive). Returns
    `configured: false` (with empty events) until CalDAV credentials are set."""
    return {"configured": ical.is_configured(), "events": ical.fetch_events(start, end)}
