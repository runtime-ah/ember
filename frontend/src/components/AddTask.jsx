import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../api";
import { PRIORITIES } from "../lib/priority";

export default function AddTask({ projectId, sectionId, parentId = null, onAdded }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState(4);
  const [dueDate, setDueDate] = useState("");

  function reset() {
    setContent("");
    setPriority(4);
    setDueDate("");
  }

  async function submit(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    await api.createTask({
      project_id: projectId,
      section_id: sectionId,
      parent_id: parentId,
      content: trimmed,
      priority,
      due_date: dueDate || null,
    });
    reset();
    onAdded();
    // Keep the composer open for rapid entry.
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 flex items-center gap-1 px-1 py-1 text-sm text-text-muted transition-colors duration-150 hover:text-text-secondary"
      >
        <Plus size={14} /> {parentId ? "Add subtask" : "Add task"}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-1 rounded border border-border bg-surface p-3"
    >
      <input
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Task name"
        className="mb-2 w-full bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="rounded bg-elevated px-2 py-1 text-xs text-text-secondary focus:outline-none"
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded bg-elevated px-2 py-1 text-xs text-text-secondary focus:outline-none"
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="rounded px-3 py-1 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1 text-xs text-white transition-colors duration-150 hover:bg-accent-hover"
          >
            Add
          </button>
        </div>
      </div>
    </form>
  );
}
