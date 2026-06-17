from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from datetime import date

FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

from app import ical
from app.brief import build_brief
from app.config import settings
from app.database import get_db, init_db
from app.routers import labels, lists, projects, push, reminders, sections, tasks, views
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

app.include_router(labels.router)
app.include_router(lists.router)
app.include_router(views.router)
app.include_router(projects.router)
app.include_router(sections.router)
app.include_router(tasks.router)
app.include_router(reminders.router)
app.include_router(push.router)


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


# Serve the built React frontend. Must be last so API routes take priority.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
