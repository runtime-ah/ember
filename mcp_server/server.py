"""MCP server for the self-hosted task manager.

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

mcp = FastMCP("todo", host=HOST, port=PORT)


async def _request(method: str, path: str, **kwargs):
    async with httpx.AsyncClient(base_url=BACKEND, timeout=15) as client:
        resp = await client.request(method, path, **kwargs)
        resp.raise_for_status()
        return None if resp.status_code == 204 else resp.json()


def _drop_none(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


@mcp.tool()
async def get_projects() -> list[dict]:
    """List all projects, each with its sections. Use this to discover the
    project_id / section_id values needed by the other tools."""
    projects = await _request("GET", "/api/projects")
    for p in projects:
        p["sections"] = await _request("GET", "/api/sections", params={"project_id": p["id"]})
    return projects


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
        reminder_time: ISO datetime YYYY-MM-DDTHH:MM:SS — fires an ntfy push
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
) -> dict:
    """Edit an existing task. Only the fields you pass are changed."""
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
        }
    )
    return await _request("PATCH", f"/api/tasks/{task_id}", json=body)


@mcp.tool()
async def complete_task(task_id: int) -> dict:
    """Mark a task complete."""
    return await _request("POST", f"/api/tasks/{task_id}/complete")


@mcp.tool()
async def get_brief() -> dict:
    """Today's brief: overdue tasks, tasks due today, important undated
    (P1/P2) tasks, and today's calendar events."""
    return await _request("GET", "/api/brief")


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
