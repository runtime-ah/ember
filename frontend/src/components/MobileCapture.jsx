import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { api } from "../api";
import { Icon } from "../lib/icons";
import { PRIORITIES } from "../lib/priority";
import ThemeToggle from "./ThemeToggle";

// Minimal phone capture: pick a project, type a task, set priority/date, save.
// Optimized for one-handed quick entry rather than full task management.
export default function MobileCapture({ projects }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? null);
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState(4);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [justAdded, setJustAdded] = useState([]);

  async function submit(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || projectId == null) return;
    setSaving(true);
    try {
      const task = await api.createTask({
        project_id: projectId,
        content: trimmed,
        priority,
        due_date: dueDate || null,
      });
      setJustAdded((prev) => [task, ...prev].slice(0, 8));
      setContent("");
      setPriority(4);
      setDueDate("");
    } finally {
      setSaving(false);
    }
  }

  const project = projects.find((p) => p.id === projectId);

  return (
    <div className="flex min-h-full flex-col px-5 pb-8 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Quick add</h1>
        <ThemeToggle />
      </header>

      {/* Project picker */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {projects.map((p) => {
          const active = p.id === projectId;
          return (
            <button
              key={p.id}
              onClick={() => setProjectId(p.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 ${
                active
                  ? "border-transparent bg-accent-subtle font-medium text-text-primary"
                  : "border-border text-text-secondary"
              }`}
            >
              <Icon name={p.icon} size={14} style={{ color: p.color }} />
              {p.name}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4 shadow-soft">
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What needs doing?"
          rows={2}
          className="w-full resize-none bg-transparent text-base text-text-primary placeholder:text-text-muted focus:outline-none"
        />

        {/* Priority chips */}
        <div className="mt-3 flex gap-2">
          {PRIORITIES.map((p) => {
            const active = priority === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 ${
                  active ? "border-transparent bg-elevated text-text-primary" : "border-border text-text-secondary"
                }`}
              >
                {p.color && (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                )}
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md bg-elevated px-3 py-2 text-sm text-text-secondary focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!content.trim() || saving}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover disabled:opacity-40"
        >
          <Plus size={18} /> Add to {project?.name ?? "project"}
        </button>
      </form>

      {/* Confirmation of what was just captured */}
      {justAdded.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Just added
          </p>
          <ul className="space-y-1.5">
            {justAdded.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm text-text-secondary">
                <Check size={15} className="shrink-0 text-accent" />
                <span className="truncate">{t.content}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
