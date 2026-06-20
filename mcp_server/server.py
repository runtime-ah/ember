"""MCP server for Ember, the self-hosted task manager.

Wraps the FastAPI backend over HTTP and exposes tasks/projects/brief as Claude
tools. Run it on the Pi and add it as a custom connector in Claude.ai via the
Tailscale address (streamable-HTTP transport, default path /mcp).

Config (env):
  TODO_MCP_BACKEND_URL  backend base URL (default http://localhost:8000)
  TODO_MCP_HOST         bind host (default 127.0.0.1; use 0.0.0.0 on the Pi)
  TODO_MCP_PORT         bind port (default 8765)
"""

import os

import httpx
from mcp.server.fastmcp import FastMCP

BACKEND = os.environ.get("TODO_MCP_BACKEND_URL", "http://localhost:8000").rstrip("/")
HOST = os.environ.get("TODO_MCP_HOST", "127.0.0.1")
PORT = int(os.environ.get("TODO_MCP_PORT", "8765"))

mcp = FastMCP("ember", host=HOST, port=PORT)


async def _request(method: str, path: str, **kwargs):
    async with httpx.AsyncClient(base_url=BACKEND, timeout=15) as client:
        resp = await client.request(method, path, **kwargs)
        resp.raise_for_status()
        return None if resp.status_code == 204 else resp.json()


def _drop_none(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


# --- Projects ---


@mcp.tool()
async def get_projects() -> list[dict]:
    """List all projects, each with its sections. Use this to discover the
    project_id / section_id values needed by the other tools."""
    projects = await _request("GET", "/api/projects")
    for p in projects:
        p["sections"] = await _request("GET", "/api/sections", params={"project_id": p["id"]})
    return projects


@mcp.tool()
async def create_project(
    name: str,
    color: str | None = None,
    icon: str | None = None,
    pinned: bool = False,
) -> dict:
    """Create a new project and return it.

    Args:
        name: project title (required)
        color: hex color e.g. '#c96442'
        icon: icon slug e.g. 'garden', 'tools', 'nature', 'car', 'ideas', 'list', 'shopping'
        pinned: pin to the top of the sidebar
    """
    body = _drop_none({"name": name, "color": color, "icon": icon, "pinned": pinned})
    return await _request("POST", "/api/projects", json=body)


@mcp.tool()
async def update_project(
    project_id: int,
    name: str | None = None,
    color: str | None = None,
    icon: str | None = None,
    pinned: bool | None = None,
    archived: bool | None = None,
) -> dict:
    """Edit an existing project. Only the fields you pass are changed.

    Args:
        project_id: project to update (see get_projects)
        name: new title
        color: hex color e.g. '#c96442'
        icon: icon slug
        pinned: pin/unpin from sidebar
        archived: archive or unarchive the project
    """
    body = _drop_none(
        {"name": name, "color": color, "icon": icon, "pinned": pinned, "archived": archived}
    )
    return await _request("PATCH", f"/api/projects/{project_id}", json=body)


@mcp.tool()
async def delete_project(project_id: int) -> None:
    """Permanently delete a project and all its tasks.

    Args:
        project_id: project to delete (see get_projects)
    """
    await _request("DELETE", f"/api/projects/{project_id}")


# --- Sections ---


@mcp.tool()
async def create_section(
    project_id: int,
    name: str,
    icon: str | None = None,
) -> dict:
    """Create a new section within a project.

    Args:
        project_id: project to add the section to (see get_projects)
        name: section title
        icon: optional icon slug
    """
    body = _drop_none({"project_id": project_id, "name": name, "icon": icon})
    return await _request("POST", "/api/sections", json=body)


@mcp.tool()
async def update_section(
    section_id: int,
    name: str | None = None,
    icon: str | None = None,
) -> dict:
    """Edit an existing section. Only the fields you pass are changed.

    Args:
        section_id: section to update (see get_projects)
        name: new title
        icon: new icon slug
    """
    body = _drop_none({"name": name, "icon": icon})
    return await _request("PATCH", f"/api/sections/{section_id}", json=body)


@mcp.tool()
async def delete_section(section_id: int) -> None:
    """Delete a section. Tasks in the section are moved to the project root (section unset).

    Args:
        section_id: section to delete (see get_projects)
    """
    await _request("DELETE", f"/api/sections/{section_id}")


# --- Labels ---


@mcp.tool()
async def get_labels() -> list[dict]:
    """Return all labels. Use label ids when adding/updating tasks."""
    return await _request("GET", "/api/labels")


@mcp.tool()
async def create_label(name: str, color: str | None = None) -> dict:
    """Create a new label and return it.

    Args:
        name: label name, must be unique (used as #tag identifier)
        color: optional hex color e.g. '#c96442'
    """
    body = _drop_none({"name": name, "color": color})
    return await _request("POST", "/api/labels", json=body)


@mcp.tool()
async def update_label(
    label_id: int,
    name: str | None = None,
    color: str | None = None,
) -> dict:
    """Edit an existing label. Only the fields you pass are changed.

    Args:
        label_id: label to update (see get_labels)
        name: new label name
        color: new hex color
    """
    body = _drop_none({"name": name, "color": color})
    return await _request("PATCH", f"/api/labels/{label_id}", json=body)


@mcp.tool()
async def delete_label(label_id: int) -> None:
    """Permanently delete a label and remove it from all tasks.

    Args:
        label_id: label to delete (see get_labels)
    """
    await _request("DELETE", f"/api/labels/{label_id}")


# --- Tasks ---


@mcp.tool()
async def get_tasks(
    project_id: int | None = None,
    section_id: int | None = None,
    priority: int | None = None,
    due_date: str | None = None,
    completed: bool | None = None,
) -> list[dict]:
    """Fetch tasks, optionally filtered.

    Args:
        project_id: only tasks in this project
        section_id: only tasks in this section
        priority: 1 (highest) .. 4 (none)
        due_date: ISO date YYYY-MM-DD
        completed: filter by completion state
    """
    params = _drop_none(
        {
            "project_id": project_id,
            "section_id": section_id,
            "priority": priority,
            "due_date": due_date,
            "completed": completed,
        }
    )
    return await _request("GET", "/api/tasks", params=params)


@mcp.tool()
async def add_task(
    content: str,
    project_id: int,
    section_id: int | None = None,
    description: str | None = None,
    priority: int = 4,
    due_date: str | None = None,
    due_time: str | None = None,
    reminder_time: str | None = None,
    label_ids: list[int] | None = None,
    parent_id: int | None = None,
) -> dict:
    """Create a task.

    Args:
        content: the task text (required)
        project_id: target project (see get_projects)
        section_id: optional section within the project
        description: longer notes
        priority: 1 (highest) .. 4 (none, default)
        due_date: ISO date YYYY-MM-DD
        due_time: HH:MM:SS
        reminder_time: ISO datetime YYYY-MM-DDTHH:MM:SS — fires a Web Push notification
        label_ids: list of label ids to attach (see get_labels)
        parent_id: make this a subtask of an existing task (one level deep)
    """
    body = _drop_none(
        {
            "content": content,
            "project_id": project_id,
            "section_id": section_id,
            "description": description,
            "priority": priority,
            "due_date": due_date,
            "due_time": due_time,
            "reminder_time": reminder_time,
            "label_ids": label_ids,
            "parent_id": parent_id,
        }
    )
    return await _request("POST", "/api/tasks", json=body)


@mcp.tool()
async def update_task(
    task_id: int,
    content: str | None = None,
    description: str | None = None,
    priority: int | None = None,
    due_date: str | None = None,
    due_time: str | None = None,
    reminder_time: str | None = None,
    project_id: int | None = None,
    section_id: int | None = None,
    label_ids: list[int] | None = None,
) -> dict:
    """Edit an existing task. Only the fields you pass are changed.

    Args:
        task_id: task to update
        content: new task text
        description: new notes
        priority: 1 (highest) .. 4 (none)
        due_date: ISO date YYYY-MM-DD
        due_time: HH:MM:SS
        reminder_time: ISO datetime YYYY-MM-DDTHH:MM:SS
        project_id: move task to a different project
        section_id: move task to a different section (pass 0 to clear)
        label_ids: replace the task's labels with this list (use [] to remove all)
    """
    body = _drop_none(
        {
            "content": content,
            "description": description,
            "priority": priority,
            "due_date": due_date,
            "due_time": due_time,
            "reminder_time": reminder_time,
            "project_id": project_id,
            "section_id": section_id,
            "label_ids": label_ids,
        }
    )
    return await _request("PATCH", f"/api/tasks/{task_id}", json=body)


@mcp.tool()
async def complete_task(task_id: int) -> dict:
    """Mark a task complete."""
    return await _request("POST", f"/api/tasks/{task_id}/complete")


@mcp.tool()
async def uncomplete_task(task_id: int) -> dict:
    """Mark a completed task as incomplete and re-arm its reminder.

    Args:
        task_id: task to uncomplete
    """
    return await _request("POST", f"/api/tasks/{task_id}/uncomplete")


@mcp.tool()
async def delete_task(task_id: int) -> None:
    """Permanently delete a task and its subtasks.

    Args:
        task_id: task to delete
    """
    await _request("DELETE", f"/api/tasks/{task_id}")


# --- Reminders ---


@mcp.tool()
async def get_reminders(task_id: int | None = None) -> list[dict]:
    """Return reminders, optionally filtered by task.

    Args:
        task_id: only reminders linked to this task (omit for all reminders)
    """
    params = _drop_none({"task_id": task_id})
    return await _request("GET", "/api/reminders", params=params)


@mcp.tool()
async def create_reminder(
    fire_time: str,
    message: str,
    task_id: int | None = None,
    recurrence_rule: str | None = None,
) -> dict:
    """Create a standalone reminder (not linked to a task) or a task-linked reminder.

    Args:
        fire_time: ISO datetime YYYY-MM-DDTHH:MM:SS when to fire
        message: notification text
        task_id: optionally link to a task
        recurrence_rule: 'daily', 'weekdays', 'weekly', 'biweekly', or 'monthly'
    """
    body = _drop_none(
        {
            "fire_time": fire_time,
            "message": message,
            "task_id": task_id,
            "recurrence_rule": recurrence_rule,
        }
    )
    return await _request("POST", "/api/reminders", json=body)


@mcp.tool()
async def update_reminder(
    reminder_id: int,
    fire_time: str | None = None,
    message: str | None = None,
    recurrence_rule: str | None = None,
) -> dict:
    """Edit an existing reminder. Only the fields you pass are changed.

    Args:
        reminder_id: reminder to update (see get_reminders)
        fire_time: new ISO datetime YYYY-MM-DDTHH:MM:SS
        message: new notification text
        recurrence_rule: 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', or null to clear
    """
    body = _drop_none({"fire_time": fire_time, "message": message, "recurrence_rule": recurrence_rule})
    return await _request("PATCH", f"/api/reminders/{reminder_id}", json=body)


@mcp.tool()
async def delete_reminder(reminder_id: int) -> None:
    """Permanently delete a reminder and cancel its scheduled notification.

    Args:
        reminder_id: reminder to delete (see get_reminders)
    """
    await _request("DELETE", f"/api/reminders/{reminder_id}")


# --- Brief ---


@mcp.tool()
async def get_brief() -> dict:
    """Today's brief: overdue tasks, tasks due today, important undated
    (P1/P2) tasks, and today's calendar events."""
    return await _request("GET", "/api/brief")


# --- Lists ---


@mcp.tool()
async def get_lists() -> list[dict]:
    """Return all lists with their items and progress counts.
    Each list has: id, name, list_type (checkbox/bullet/numbered),
    item_count, checked_count, and an items array."""
    return await _request("GET", "/api/lists")


@mcp.tool()
async def create_list(
    name: str,
    list_type: str = "bullet",
) -> dict:
    """Create a new list and return it.

    Args:
        name: list title
        list_type: 'checkbox' (checkable items with progress), 'bullet' (dots),
                   or 'numbered' (auto-numbered). Defaults to 'bullet'.
    """
    return await _request("POST", "/api/lists", json={"name": name, "list_type": list_type})


@mcp.tool()
async def update_list(
    list_id: int,
    name: str | None = None,
    icon: str | None = None,
    color: str | None = None,
    list_type: str | None = None,
) -> dict:
    """Edit a list's metadata. Only the fields you pass are changed.

    Args:
        list_id: list to update (see get_lists)
        name: new title
        icon: icon slug
        color: hex color e.g. '#c96442'
        list_type: 'checkbox', 'bullet', or 'numbered'
    """
    body = _drop_none({"name": name, "icon": icon, "color": color, "list_type": list_type})
    return await _request("PATCH", f"/api/lists/{list_id}", json=body)


@mcp.tool()
async def delete_list(list_id: int) -> None:
    """Permanently delete a list and all its items.

    Args:
        list_id: list to delete (see get_lists)
    """
    await _request("DELETE", f"/api/lists/{list_id}")


@mcp.tool()
async def add_list_item(list_id: int, content: str) -> dict:
    """Append an item to a list.

    Args:
        list_id: target list id (see get_lists)
        content: item text
    """
    lists = await _request("GET", "/api/lists")
    existing = next((l for l in lists if l["id"] == list_id), None)
    order = len(existing["items"]) if existing else 0
    return await _request("POST", f"/api/lists/{list_id}/items", json={"content": content, "order": order})


@mcp.tool()
async def update_list_item(
    list_id: int,
    item_id: int,
    content: str | None = None,
    checked: bool | None = None,
) -> dict:
    """Edit a list item's text or checked state.

    Args:
        list_id: the list the item belongs to
        item_id: the item to edit
        content: new text (omit to leave unchanged)
        checked: True to check, False to uncheck (omit to leave unchanged)
    """
    body = _drop_none({"content": content, "checked": checked})
    return await _request("PATCH", f"/api/lists/{list_id}/items/{item_id}", json=body)


@mcp.tool()
async def delete_list_item(list_id: int, item_id: int) -> None:
    """Remove an item from a list permanently.

    Args:
        list_id: the list the item belongs to
        item_id: the item to remove
    """
    await _request("DELETE", f"/api/lists/{list_id}/items/{item_id}")


@mcp.tool()
async def reset_list(list_id: int) -> dict:
    """Uncheck all items in a list (quick-reset for checkbox lists).

    Args:
        list_id: the list to reset
    """
    return await _request("POST", f"/api/lists/{list_id}/reset")


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
