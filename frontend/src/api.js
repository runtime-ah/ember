// Thin fetch wrapper around the FastAPI backend.
// In dev: VITE_API_BASE is unset → calls /api/... (Vite proxies to localhost:8000).
// In prod: VITE_API_BASE=/ember → calls /ember/api/... (Caddy strips /ember prefix).
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Projects
  listProjects: () => request("/projects"),
  createProject: (data) => request("/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id, data) =>
    request(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: "DELETE" }),

  // Sections
  listSections: (projectId) => request(`/sections?project_id=${projectId}`),
  createSection: (data) => request("/sections", { method: "POST", body: JSON.stringify(data) }),
  updateSection: (id, data) =>
    request(`/sections/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSection: (id) => request(`/sections/${id}`, { method: "DELETE" }),

  // Labels
  listLabels: () => request("/labels"),
  createLabel: (data) => request("/labels", { method: "POST", body: JSON.stringify(data) }),
  updateLabel: (id, data) =>
    request(`/labels/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLabel: (id) => request(`/labels/${id}`, { method: "DELETE" }),

  // Views (custom saved views)
  listViews: () => request("/views"),
  createView: (data) => request("/views", { method: "POST", body: JSON.stringify(data) }),
  updateView: (id, data) =>
    request(`/views/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteView: (id) => request(`/views/${id}`, { method: "DELETE" }),

  // Calendar (read-only iCloud via CalDAV)
  getCalendar: (start, end) => request(`/calendar?start=${start}&end=${end}`),

  // Tasks
  listTasks: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)),
    ).toString();
    return request(`/tasks${qs ? `?${qs}` : ""}`);
  },
  createTask: (data) => request("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id, data) =>
    request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  completeTask: (id) => request(`/tasks/${id}/complete`, { method: "POST" }),
  uncompleteTask: (id) => request(`/tasks/${id}/uncomplete`, { method: "POST" }),
  reorderTasks: (items) =>
    request("/tasks/reorder", { method: "POST", body: JSON.stringify({ items }) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
};
