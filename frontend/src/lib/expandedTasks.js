// Persists which tasks have their subtasks expanded (default is collapsed).
// Stores the set of expanded task ids in localStorage so it survives reloads.
const KEY = "expanded-tasks";

function load() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function isTaskExpanded(id) {
  return load().has(id);
}

export function setTaskExpanded(id, value) {
  const set = load();
  if (value) set.add(id);
  else set.delete(id);
  localStorage.setItem(KEY, JSON.stringify([...set]));
}
