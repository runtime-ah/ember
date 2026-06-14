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
