import os
import tempfile

# Point the app at a throwaway DB before importing it.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["TODO_DATABASE_PATH"] = _tmp.name

from fastapi.testclient import TestClient  # noqa: E402

from app.database import init_db  # noqa: E402
from app.main import app  # noqa: E402

init_db()
client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_project_section_task_flow():
    # Project
    p = client.post("/api/projects", json={"name": "Inbox"}).json()
    assert p["name"] == "Inbox"

    # Section
    s = client.post(
        "/api/sections", json={"project_id": p["id"], "name": "Today"}
    ).json()
    assert s["project_id"] == p["id"]

    # Task
    t = client.post(
        "/api/tasks",
        json={
            "project_id": p["id"],
            "section_id": s["id"],
            "content": "Buy milk",
            "priority": 2,
            "due_date": "2026-06-13",
        },
    ).json()
    assert t["content"] == "Buy milk"
    assert t["priority"] == 2
    assert t["completed"] is False

    # Subtask (one level deep)
    sub = client.post(
        "/api/tasks",
        json={"project_id": p["id"], "parent_id": t["id"], "content": "2%"},
    )
    assert sub.status_code == 201

    # Depth enforcement: subtask of a subtask must fail
    deep = client.post(
        "/api/tasks",
        json={"project_id": p["id"], "parent_id": sub.json()["id"], "content": "nope"},
    )
    assert deep.status_code == 400

    # Filter by due date
    due = client.get("/api/tasks", params={"due_date": "2026-06-13"}).json()
    assert any(x["id"] == t["id"] for x in due)

    # Update (partial) — clear the due date explicitly
    upd = client.patch(f"/api/tasks/{t['id']}", json={"due_date": None}).json()
    assert upd["due_date"] is None

    # Complete / uncomplete
    done = client.post(f"/api/tasks/{t['id']}/complete").json()
    assert done["completed"] is True and done["completed_at"] is not None
    back = client.post(f"/api/tasks/{t['id']}/uncomplete").json()
    assert back["completed"] is False and back["completed_at"] is None

    # Delete project cascades to its tasks
    assert client.delete(f"/api/projects/{p['id']}").status_code == 204
    assert client.get(f"/api/tasks/{t['id']}").status_code == 404


def test_delete_section_keeps_tasks():
    p = client.post("/api/projects", json={"name": "SecDel"}).json()
    s = client.post("/api/sections", json={"project_id": p["id"], "name": "S"}).json()
    t = client.post(
        "/api/tasks",
        json={"project_id": p["id"], "section_id": s["id"], "content": "keep me"},
    ).json()

    assert client.delete(f"/api/sections/{s['id']}").status_code == 204

    # Task survives, just orphaned to no section.
    got = client.get(f"/api/tasks/{t['id']}")
    assert got.status_code == 200
    assert got.json()["section_id"] is None


def test_reminder_scheduling():
    from app.scheduler import _reminder_job_id, scheduler

    p = client.post("/api/projects", json={"name": "Reminders"}).json()

    # Future reminder -> a job is scheduled.
    future = "2099-01-01T09:00:00"
    t = client.post(
        "/api/tasks",
        json={"project_id": p["id"], "content": "Ping me", "reminder_time": future},
    ).json()
    assert scheduler.get_job(_reminder_job_id(t["id"])) is not None

    # Completing the task cancels the reminder.
    client.post(f"/api/tasks/{t['id']}/complete")
    assert scheduler.get_job(_reminder_job_id(t["id"])) is None

    # Past reminder -> no job scheduled.
    past = client.post(
        "/api/tasks",
        json={
            "project_id": p["id"],
            "content": "Stale",
            "reminder_time": "2000-01-01T09:00:00",
        },
    ).json()
    assert scheduler.get_job(_reminder_job_id(past["id"])) is None


def test_brief_endpoint():
    from datetime import date, timedelta

    p = client.post("/api/projects", json={"name": "Brief"}).json()
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    client.post(
        "/api/tasks",
        json={"project_id": p["id"], "content": "Due today", "due_date": today},
    )
    client.post(
        "/api/tasks",
        json={"project_id": p["id"], "content": "Overdue", "due_date": yesterday},
    )
    client.post(
        "/api/tasks",
        json={"project_id": p["id"], "content": "Important", "priority": 1},
    )

    brief = client.get("/api/brief").json()
    assert any(t["content"] == "Due today" for t in brief["due_today"])
    assert any(t["content"] == "Overdue" for t in brief["overdue"])
    assert any(t["content"] == "Important" for t in brief["important_undated"])
    assert brief["events"] == []  # no CalDAV configured in tests
