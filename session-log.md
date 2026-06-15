# Session Log — 2026-06-15

**V1 shipped and deployed to Pi.** `https://pi.tail56f1a8.ts.net/ember`

---

## What we built today

### Header & Sidebar Redesign
- Persistent "Ember" brand (flame + text) always in the top header bar; project/view title moved into the content area alongside the Add task button
- Both rendered at `text-[18–20px]`, larger than section labels (`text-[13px]`)
- Sidebar: Ember branding removed (header now owns it)
- **Right-click context menu** for project and view edit/delete — replaces hover buttons, rendered via React portal to escape CSS transform clipping; completely frees up the row layout so project names no longer truncate
- Sidebar collapse toggle aligned with nav items (same `px-2.5` padding), icon updated to `ChevronsLeft/Right` for clarity
- Tags and Views sections hidden when sidebar is collapsed (were unclickable anyway)
- Views section moved below Tags
- Mobile popout widened to `w-80` (320px)
- FilteredTaskView (Today, Upcoming, label views) now shows its title in the content area

### Calendar
- Multi-day event spanning bars across week rows (both all-day and timed events)
- `eventEndExclusive()` helper normalises iCal exclusive-end convention vs timed events
- iCloud CalDAV connected via `backend/.env` credentials (`TODO_CALDAV_USERNAME`, `TODO_CALDAV_PASSWORD`)

### PWA
- Flame icon generated via browser canvas → base64 → PNG (180, 192, 512px)
- Minimal service worker (`public/sw.js`) — satisfies Chrome/Safari PWA install requirements
- `manifest.json` fixed to use relative paths (`./`) so `start_url` and icon `src` resolve correctly whether the app is at `/` (dev) or `/ember/` (Pi)
- Service worker registered via `import.meta.env.BASE_URL` so path is correct in both environments

### Pi Deployment
- Multi-stage `Dockerfile`: Node 22 builds the frontend, Python 3.12 + uv runs the backend; SQLite in a named Docker volume
- `docker-compose.yml`: port bound to `127.0.0.1:8001` (loopback only, Caddy proxies)
- `deploy.sh`: rsync code → `docker compose up -d --build` → auto-inserts Caddy `handle_path /ember*` block on first run (idempotent thereafter)
- `sync-db.sh`: one command to copy local dev DB into the Pi container
- `Vite base: "/ember/"` for production builds; `VITE_API_BASE=/ember` baked in at build time so API calls route through Caddy correctly instead of hitting Garage Dashboard on port 8000
- Nav state (selected project / active view) persisted to `localStorage` so app reopens to last position on launch

---

## Current state

- V1 live at `https://pi.tail56f1a8.ts.net/ember`, PWA-installable, data migrated from dev
- All core task management, sections, labels, calendar, daily brief, and reminders are implemented
- Mobile use reveals gaps: right-click context menu is inaccessible, no swipe gestures, hover-gated UI doesn't work on touch

---

# Session Log — 2026-06-14

Building on Phase 1 + 2 foundation from yesterday. Added labels/tagging, NL input parsing,
effort field, reminder in the add composer, better time picker, recurring tasks, and
Today/Upcoming filtered views.

---

## What we built today

### Backend (additive migrations — no data loss)

- **`labels` table** — `id, name, color, order, created_at`
- **`task_labels` junction** — many-to-many tasks ↔ labels (cascade deletes)
- **`views` table** — `id, name, icon, filter_json, order` (for future custom views)
- **`tasks.effort`** — nullable Float (hours)
- **`tasks.recurrence_rule`** — nullable String (`"daily"`, `"weekdays"`, `"weekly"`, `"biweekly"`, `"monthly"`)
- **`/api/labels`** router — full CRUD (409 on duplicate name)
- **`/api/views`** router — full CRUD
- **`GET /api/tasks`** new query params: `label_id`, `due_before`, `due_after`
- **`POST /api/tasks/:id/complete`** — if task has `recurrence_rule`, spawns a new task with next due date rolled forward; original is marked complete
- All 6 backend tests still passing

### Frontend

**NL parser** (`src/lib/nlParser.js`):
- Detects `#tagname` → labels
- `today`, `tomorrow`, weekday names, `next monday`, `jan 15` → due date
- `9am`, `2:30pm`, `14:00` → due time
- `p1`–`p4` → priority
- `2h`, `1.5h`, `30m` → effort (hours)
- `daily`, `every day`, `every tuesday`, `weekly`, `weekdays`, `biweekly`, `monthly` → recurrence
- Returns `{ content, labels, dueDate, dueTime, priority, effort, recurrenceRule }` with raw input stripped of consumed tokens

**TimePicker** (`src/components/TimePicker.jsx`):
- Replaces `datetime-local` with a clean popover of preset times (7am–10pm, 30-min increments)
- Shows formatted "9:30 AM" style; "Clear" option when a time is set

**LabelPicker** (`src/components/LabelPicker.jsx`):
- Inline tag input: shows existing labels as removable pills
- Dropdown filters as you type; "Create '#name'" at the bottom if name doesn't exist
- Creates labels on-the-fly via the API

**AddTask** — fully redesigned:
- NL chips row: detected tokens show as dismissible chips below the input in real-time
- Row 1: Priority · Due date · TimePicker · Effort (hours) · Recurrence dropdown
- Row 2: LabelPicker
- Row 3: Bell icon · Reminder date · Reminder TimePicker (shows when date is set)
- NL overrides manual fields; manual fields override NL

**TaskItem / TaskEditor** — updated:
- Metadata row: due date · reminder bell · `~2h` effort pill · label pills
- Recurring tasks show a small ↺ icon
- TaskEditor has same fields as AddTask: effort, recurrence, LabelPicker, split reminder

**FilteredTaskView** (`src/components/FilteredTaskView.jsx`):
- Cross-project filtered task list (no sections)
- Groups by project when multiple projects have results
- Used for Today, Upcoming, label views

**Sidebar** — restructured:
- Top: Today (clock icon) · Upcoming (calendar icon)
- Separator → Calendar
- Separator → Labels section (collapsible, shows all labels with color dot, delete on hover)
- "No labels yet — type #tag in a task." hint when empty
- Separator → Projects (with + to add)

**App.jsx** — routing updated:
- `activeView: { type: 'today' | 'upcoming' | 'calendar' | 'label', id?, name? } | null`
- Today: `due_before=today, completed=false`
- Upcoming: `due_after=tomorrow, due_before=+7days, completed=false`
- Label: `label_id=N, completed=false`

---

## Current state

- **All features from plan confirmed working** via API and screenshots:
  - Created "work" label, tagged "Cut down the tree" task via API
  - Label shows in sidebar; clicking `#work` shows filtered `#work` view
  - Today view shows overdue tasks correctly
  - NL parser chip UI working (screenshot confirmed: `#work | Tomorrow | P1× | ~2h`)
- **6/6 backend tests passing**

---

## Backlog

**Next up:**
- **iCloud CalDAV creds** — add to `backend/.env`, restart → calendar shows events
- **Pi deployment** — systemd or docker-compose; makes reminders durable and MCP reachable

**Near-term:**
- Custom saved views (DB model done, router done, UI pending — just needs a view editor + sidebar section)
- Ntfy tap-to-complete / deep-link (needs Pi base URL)
- Today view: include tasks with no due date but high priority (currently brief does this, view doesn't)
- Label colour picker (currently defaults to `#999999` for NL-created labels)

**Tier 1 done:** Labels, NL parsing, Effort, Recurring tasks, Today/Upcoming views, Reminder in AddTask, TimePicker redesign

**Tier 2 (later):** Custom view editor UI, Drag task onto calendar day, Merge calendar into task views

**Tier 3 (skip):** Pomodoro, gamification
