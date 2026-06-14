# Session Log — 2026-06-13

A full day building the self-hosted task manager (see [plan.md](plan.md)). We went
from an empty repo to Phase 1 complete + the Phase 2 MCP server + a calendar view,
plus a UI refresh and a real Todoist data import.

---

## What we built today

Roughly in order. Each bullet maps to one or more commits.

### Core app (Phase 1)
- **Backend** (FastAPI + SQLite): models for Project / Section / Task (one-level
  subtasks, FK cascades, SQLite FK enforcement), full CRUD REST API with filtering,
  complete/uncomplete, reorder, and subtask-depth validation. Env-driven config
  (`TODO_*`). Pytest suite (**6 tests passing**).
- **Frontend** (React 19 + Vite + Tailwind v4): project sidebar, section-grouped
  task list, add/edit/complete/delete, custom checkboxes, priority dots, due-date
  badges, subtasks — all using the design-guide tokens.
- **Collapsible sidebar** with smooth width animation; state persists.

### Reminders + brief
- **Reminders engine**: per-task `reminder_time`, fired by APScheduler, pushed via
  **ntfy**. CRUD-synced (create/edit schedules, complete/delete cancels); past-due
  reminders skipped on restart. Settable from the task editor (bell field).
- **Daily brief**: cron at `TODO_BRIEF_TIME`, pushed via ntfy; also `GET /api/brief`
  (overdue / due today / important undated / iCloud events).
- **Verified live**: ntfy push delivery confirmed; the user installed the ntfy app
  and subscribed to the topic (in `backend/.env`). All three test pushes landed,
  including a real APScheduler-fired timed reminder.

### UI / UX
- **Light/dark theme toggle** — warm cream light mode (not stark white), persists,
  honors OS preference on first load.
- **Icons for projects & sections** — curated lucide set + icon picker; shown in the
  sidebar, collapsed rail, headers, and section banners. Added a lightweight additive
  DB migration so the new `icon` column landed without data loss.
- **Add-task cleanup** — one top-level "+ Add task", per-task hover "+" for subtasks,
  removed the repeated inline buttons.
- **Sections as collapsible banners** with task counts and hover actions.
- **Refined-warm design system** — stronger type hierarchy, soft elevation
  (`shadow-soft`/`shadow-pop`), `accent-subtle` active tint, due/reminder pills,
  pop-in micro-interactions, themed scrollbars.
- **Denser task list with subtle row dividers** (Todoist-style).
- **Collapsible subtasks** (collapsed by default, count badge, expand state persists).
- **Hierarchy** — indentation + subtle connector lines for section → task → subtask.
- **Drag-to-reorder** tasks within a group (native HTML5 DnD, persisted).
- **Click-off behavior** — now **commits** (saves new items / edits unless blank);
  Escape still cancels. (We first made it dismiss, then reversed per feedback.)

### Mobile
- **Mobile capture view** — phone-width "Quick add" screen (project chips, task field,
  priority chips, due date, "Just added" confirmation). Desktop unchanged ≥ 640px.

### Phase 2
- **MCP server** (`mcp_server/`, FastMCP streamable-HTTP) wrapping the backend over
  HTTP. Tools: `get_projects`, `get_tasks`, `add_task`, `update_task`, `complete_task`,
  `get_brief`. Verified against the backend and via a full MCP client handshake.
  Intended to run on the Pi and connect from Claude.ai over Tailscale.

### Calendar
- **Calendar view** (separate sidebar entry) — month grid + week columns, prev/next/
  Today nav, week/month toggle. Shows iCloud events **and** tasks with due dates;
  today highlighted. Shows a "not connected" hint until CalDAV creds are set.
- Backend: `app/ical.py` (range CalDAV fetch + short TTL cache, shared with the brief)
  and `GET /api/calendar?start&end` returning `{configured, events}`.

### Data
- **Imported the user's Todoist** (projects/sections/tasks, priorities, due dates,
  subtask relationships, section icons) via the Todoist MCP → backend API. The user
  then curated it down to a single **To Do** project (35 tasks). One-time snapshot,
  not a live sync.

---

## Current state

- **Stack**: FastAPI + SQLite backend, React/Vite/Tailwind frontend, APScheduler,
  ntfy, CalDAV (read), FastMCP. Monorepo: `backend/`, `frontend/`, `mcp_server/`.
- **Running locally** (dev servers on the Mac): backend `:8000`, frontend `:5173`,
  MCP `:8765` (started on demand). These are dev servers — they drop when the machine
  sleeps; durable hosting is the Pi (not done yet).
- **Configured**: ntfy (topic in `backend/.env`, phone subscribed).
- **Not configured**: iCloud CalDAV (needs an app-specific password) → calendar shows
  tasks only until then.
- **Data**: one "To Do" project with the imported Todoist tasks. SQLite at
  `backend/todo.db` (gitignored).
- **Tests**: backend 6/6 passing.

---

## Backlog

**Next up (decided): Natural-language quick add** — parse `call mom tomorrow 5pm p1`
into date / priority / (later) recurrence on input, in the composer and mobile capture.

Tier 1 (high value, fits the app):
- **Recurring tasks** — "every Tuesday", "every 2 weeks", weekdays; completing rolls
  to next date. Prerequisite for natural-language add to fully pay off. *(Note: we
  picked natural-language add to go first, but recurring is the bigger unlock — worth
  reconsidering order in the morning.)*
- **Today / Upcoming smart view** — cross-project overdue + due-today (+ next 7 days),
  next to the Calendar entry. `/api/brief` already computes most of it.

Tier 2 (later):
- **Labels + saved filters** — `@errand`, `@15min`, saved queries across projects.
- **Ntfy tap-to-complete / open** — `Click` + `Actions` on reminder pushes (a
  "Complete" button from the lock screen). Needs the Pi/Tailscale base URL and
  per-task frontend routing. The `send_push` helper already accepts a `click` param.
- **Drag a task onto a calendar day** to set/move its due date.
- **Merge calendar into the task views** (we built it as a separate view "for now").

Tier 3 (intentionally skipping — cuts against the minimalist feel):
- Pomodoro timer, habit tracker, gamification/karma.

Operational / pending input:
- **iCloud CalDAV creds** — add `TODO_CALDAV_USERNAME` / `TODO_CALDAV_PASSWORD`
  (app-specific password from appleid.apple.com) to `backend/.env`, then restart the
  backend; first real exercise of the CalDAV path — may need iCloud-quirk debugging.
- **Pi deployment** — make backend + MCP run durably over Tailscale (systemd or
  docker-compose). This is what turns it into a real daily driver and makes the MCP
  connector reachable from Claude.ai.

---

## Notes / gotchas

- **No auth** by design — Tailscale is the security boundary (single user).
- **Reminders/brief** depend on the backend process staying up (APScheduler is
  in-process) — another reason the Pi deployment matters.
- **`.env` holds secrets** (ntfy topic; later CalDAV creds) and is gitignored.
- **Design preferences** are saved to memory: refined-warm minimalist, keep cream/dark
  palette, incremental changes, click-off commits (not discards), show hierarchy.
