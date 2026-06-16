import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "../api";
import { priorityColor, formatDue } from "../lib/priority";
import { Icon } from "../lib/icons";

let cachedTasks = null;

export default function SearchPalette({ projects, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState(cachedTasks ?? []);
  const [loading, setLoading] = useState(cachedTasks === null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (cachedTasks) {
      setTasks(cachedTasks);
      setLoading(false);
    } else {
      api.listTasks().then((t) => {
        cachedTasks = t;
        setTasks(t);
        setLoading(false);
      });
    }
    inputRef.current?.focus();
  }, []);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const q = query.toLowerCase().trim();
  const topLevel = tasks.filter((t) => t.parent_id == null);
  const matched = q
    ? topLevel.filter(
        (t) =>
          t.content.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      ).slice(0, 20)
    : [];

  // Build item list: insert project headers when project changes
  const items = [];
  let prevPid = null;
  let taskCount = 0;
  for (const task of matched) {
    if (task.project_id !== prevPid) {
      items.push({ type: "header", project: projectMap[task.project_id] });
      prevPid = task.project_id;
    }
    items.push({ type: "task", task, idx: taskCount++ });
  }

  function selectAndNavigate(projectId) {
    cachedTasks = null; // invalidate on navigation so next open is fresh
    onNavigate(projectId);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, matched.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && matched[selectedIdx]) {
      selectAndNavigate(matched[selectedIdx].project_id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 mx-4 w-full max-w-lg overflow-hidden rounded-xl bg-surface shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks…"
            className="flex-1 bg-transparent text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="text-text-muted transition-colors hover:text-text-primary"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
              Esc
            </kbd>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
          {loading && (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Loading…</p>
          )}
          {!loading && !q && (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              Type to search across all tasks
            </p>
          )}
          {!loading && q && items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              No tasks match &ldquo;{query}&rdquo;
            </p>
          )}

          {items.map((item, i) => {
            if (item.type === "header") {
              return (
                <div
                  key={`h-${item.project?.id ?? i}`}
                  className="flex items-center gap-1.5 px-4 pb-1 pt-3 first:pt-2"
                >
                  <Icon
                    name={item.project?.icon}
                    size={12}
                    style={{ color: item.project?.color ?? "var(--color-text-muted)" }}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {item.project?.name ?? "Unknown"}
                  </span>
                </div>
              );
            }

            const { task, idx } = item;
            const due = formatDue(task.due_date, task.due_time);
            const dotColor = priorityColor(task.priority);
            const isSelected = idx === selectedIdx;

            return (
              <button
                key={task.id}
                onClick={() => selectAndNavigate(task.project_id)}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors duration-75 ${
                  isSelected ? "bg-accent/10" : "hover:bg-elevated/60"
                }`}
              >
                <span
                  className="mt-px h-3.5 w-3.5 shrink-0 rounded-full border"
                  style={{ borderColor: dotColor ?? "var(--color-text-muted)" }}
                />
                <span className="flex-1 truncate text-[14px] text-text-primary">
                  {task.content}
                </span>
                {due && (
                  <span
                    className={`nums shrink-0 text-[11px] ${
                      due.overdue ? "text-danger" : "text-text-muted"
                    }`}
                  >
                    {due.label}
                  </span>
                )}
                {dotColor && !due && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                )}
              </button>
            );
          })}

          {!loading && matched.length === 20 && (
            <p className="px-4 pb-2 pt-1 text-center text-[11px] text-text-muted">
              Showing first 20 results
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
