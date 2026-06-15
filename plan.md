# Personal Task Manager — plan.md

## Overview

A self-hosted Todoist replacement built to run on a Raspberry Pi, accessible via Tailscale.
Replaces Todoist Pro features that matter: time-based reminders and a daily brief.
Designed to be extended with an MCP server so Claude can read and write tasks directly.

---

## Goals

- Replace Todoist free tier limitations (reminders, brief)
- Own the data, self-hosted
- Desktop-primary UI with a minimal mobile capture view
- Claude-accessible via MCP in Phase 2
- Keep it simple — no over-engineering

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | FastAPI + Python | Familiar, fast to build |
| Database | SQLite | Single file, plenty for personal use |
| Frontend | React + Vite + Tailwind | Desktop-primary |
| Notifications | Ntfy (self-hosted) | Free, iOS app available |
| Scheduler | APScheduler | Reminders + daily brief cron |
| Calendar (read) | CalDAV + iCloud | App-specific password required |
| Hosting | Raspberry Pi | Accessible via Tailscale |

---

## Data Models

### Project
```
id, name, color, order, created_at
```

### Section
```
id, project_id, name, order, created_at
```

### Task
```
id, project_id, section_id, parent_id,
content, description, priority (1-4),
due_date, due_time, reminder_time,
completed, completed_at, order, created_at
```

---

## Features

### Phase 1 — Core App

**Task Management**
- Projects with sections
- Tasks with priority (p1–p4), due date, notes
- Subtasks (one level deep)
- Drag-to-reorder within sections

**Reminders**
- Per-task time-based reminder
- Fired by APScheduler
- Delivered via Ntfy push to iPhone

**Daily Brief**
- Cron job at configurable time (default 6:00 AM)
- Pushed via Ntfy
- Contents:
  - Overdue tasks
  - Tasks due today
  - P1/P2 tasks with no due date
  - Today's iCloud Calendar events (CalDAV, read-only)

**UI**
- Desktop: sidebar (projects/sections) + task list, full CRUD
- Mobile: minimal capture view — add task, set date/priority, save

### Phase 2 — MCP Server

A Python MCP server wrapping the FastAPI backend, exposing tasks as Claude tools.

**Tools**

| Tool | Description |
|---|---|
| `get_tasks` | Fetch tasks filtered by project, section, priority, due date |
| `add_task` | Create a task with full fields |
| `update_task` | Edit content, date, priority, reminder |
| `complete_task` | Mark a task complete |
| `get_projects` | List all projects and sections |
| `get_brief` | Return today's brief on demand |

**Stack:** Anthropic Python `mcp` SDK

**Connection:** Run on Pi, expose via Tailscale, add as custom connector in Claude.ai

---

## Build Order

### Phase 1
1. Data models + SQLite schema
2. FastAPI backend — CRUD endpoints for projects, sections, tasks
3. Desktop UI — project sidebar, section grouping, task list, add/edit/complete
4. Reminders engine — APScheduler + Ntfy integration
5. Daily brief — CalDAV pull + task query + Ntfy push
6. Mobile capture view

### Phase 2
7. MCP server scaffold
8. Tool definitions (get, add, update, complete)
9. Connect to Claude.ai via Tailscale

---

## Out of Scope (v1)

- Labels and saved filter views
- iCloud Calendar write access
- Multi-user
- Life Dashboard integration (future)
- Recurring tasks (future)

---

## Infrastructure Notes

- Pi already running, Tailscale connected
- Ntfy can be self-hosted on the Pi (`docker run -p 80:80 binwiederhier/ntfy`)
- iCloud CalDAV endpoint: `https://caldav.icloud.com`
- iCloud requires an app-specific password (generated at appleid.apple.com)
- APScheduler runs in-process with FastAPI — no separate worker needed for this scale

---

## UI Style Guide

Inspired by Claude.ai — calm, dark, content-forward.

### Colors

| Token | Hex | Usage |
|---|---|---|
| `bg-base` | `#1a1a1a` | App background |
| `bg-surface` | `#222222` | Sidebar, cards |
| `bg-elevated` | `#2a2a2a` | Hover states, inputs |
| `border` | `#333333` | Subtle dividers |
| `text-primary` | `#ececec` | Main content |
| `text-secondary` | `#999999` | Labels, metadata |
| `text-muted` | `#666666` | Placeholders |
| `accent` | `#c96442` | Primary actions, active states |
| `accent-hover` | `#b5563a` | Accent hover |
| `danger` | `#e05c5c` | Destructive actions |

### Tailwind Config

```js
// tailwind.config.js
extend: {
  colors: {
    base: '#1a1a1a',
    surface: '#222222',
    elevated: '#2a2a2a',
    border: '#333333',
    accent: '#c96442',
    'accent-hover': '#b5563a',
    danger: '#e05c5c',
  }
}
```

### Typography

- Font: `Inter` (Google Fonts) — same family as Claude
- Base size: `14px`
- Line height: `1.6`
- Headings: medium weight (`500`), not bold
- Labels/metadata: `12px`, `text-secondary`

### Layout

- Sidebar: `240px` fixed, `bg-surface`, minimal icon + label nav
- Main content: fluid, max `720px` centered for task list
- Spacing unit: `8px` base — padding in multiples of 8

### Components

**Tasks**
- No heavy card borders — thin `1px border-border` or none
- Checkbox: custom styled, accent color on complete
- Priority dots: colored indicators (p1=red, p2=orange, p3=blue, p4=none)
- Completed tasks: `text-muted` + strikethrough, fade out

**Inputs**
- Borderless by default, `bg-elevated` on focus
- No rounded corners beyond `4px`
- Placeholder in `text-muted`

**Buttons**
- Primary: `bg-accent` + white text, no border
- Ghost: transparent + `text-secondary`, border on hover
- Destructive: `text-danger`, no background until hover

**Sidebar**
- Active project: `bg-elevated` + `text-primary` + left accent bar
- Inactive: `text-secondary`, hover to `text-primary`
- Section headers: `10px` uppercase, `text-muted`, not clickable

### Feel
- No heavy shadows
- Transitions: `150ms ease` on hover/focus — fast, not animated
- No gradients
- Minimal iconography — Lucide icons, `16px`, `text-secondary`

---

## Backlog — V2

### 🔴 Mobile Uplift
- **Long press → context menu** on projects/views (right-click is desktop-only; mobile can't edit/delete projects currently)
- **Swipe to complete/delete tasks** — standard mobile pattern, entirely missing
- **Hover-gated UI audit** — anything `opacity-0 group-hover:opacity-100` needs a touch fallback
- **Touch target sizing** — some icon buttons are 13–14px with no padding

### 🔴 Notifications (backend complete, UI missing)
- **Reminder datetime picker** in task add/edit — APScheduler + ntfy push already implemented, no frontend yet
- **Notification channel decision**: Web Push (built into PWA, best UX), ntfy (already wired), or Telegram (easiest to add)
- **Ntfy tap-through** — `send_push` already accepts a `click` param; wire it to the Pi's Tailscale URL so tapping a notification opens the app

### 🟡 Task Management
- **Move task between sections and projects**
- **Recurring task completion** — `recurrence_rule` field exists on Task model; completing should schedule the next occurrence (logic not yet implemented)
- **Links / docs attached to tasks**

### 🟡 Search
- **Cmd+K / search palette** — cross-project task search; nothing built yet

### 🟢 Later
- **Goals** — explicitly deferred to V2
- **Styling cleanup pass** — deferred throughout V1
- **MCP server** — Phase 2 plan unchanged; expose tasks as Claude tools via Tailscale

## Future Integration Points

- Life Dashboard: `/brief` endpoint can feed dashboard summary widget
- MCP server becomes shared interface for both apps
- Recurring tasks
- Location-based reminders (stretch)
