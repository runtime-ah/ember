# Todo

A self-hosted task manager — see [plan.md](plan.md) for the full design.

Monorepo: FastAPI + SQLite backend, React + Vite + Tailwind frontend. Runs on a
Raspberry Pi over Tailscale; developed and tested on macOS.

## Status

**Milestones 1–5 complete** (core app + reminders + daily brief):

- Projects, sections, tasks, one-level subtasks
- Priority (p1–p4), due date/time, descriptions
- Create / edit / complete / uncomplete / delete
- Collapsible sidebar; show/hide completed tasks
- Dark UI per the plan's style guide
- **Reminders** — per-task `reminder_time`, fired by APScheduler, pushed via ntfy
- **Daily brief** — cron at `TODO_BRIEF_TIME`, pushed via ntfy; also on-demand at
  `GET /api/brief` (overdue, due today, important undated, iCloud events)

Not yet built: mobile capture view, drag-to-reorder, MCP server (Phase 2).

### Notifications setup (one-time, to receive on your phone)

1. Install the **ntfy** app (iOS/Android).
2. Subscribe to the topic in `backend/.env` (`TODO_NTFY_TOPIC`). The topic name is
   the only secret on `ntfy.sh`, so keep it private.

Reminders whose time passes while the server is down are skipped on restart (no
stale-notification spam). The daily brief degrades gracefully — calendar events
are omitted until CalDAV credentials are set.

## Run it (dev, on macOS)

Two processes. Backend on `:8000`, frontend on `:5173` (Vite proxies `/api` →
backend, so the browser only ever talks to `:5173`).

### Backend

```sh
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs. The SQLite file (`backend/todo.db`) is
created on first run.

### Frontend

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

### Tests

```sh
cd backend && uv run pytest
```

## Configuration

Backend settings come from environment variables (prefix `TODO_`) or a
`backend/.env` file. See [backend/app/config.py](backend/app/config.py). Notable
ones for later milestones:

| Var | Purpose |
|---|---|
| `TODO_DATABASE_PATH` | SQLite file location (absolute path on the Pi) |
| `TODO_NTFY_SERVER` / `TODO_NTFY_TOPIC` | Push notifications |
| `TODO_CALDAV_USERNAME` / `TODO_CALDAV_PASSWORD` | iCloud app-specific password |
| `TODO_BRIEF_TIME` | Daily brief time, `HH:MM` |
