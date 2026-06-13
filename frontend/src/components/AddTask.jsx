import { useState } from "react";
import { api } from "../api";
import { PRIORITIES } from "../lib/priority";
import { useClickOutside } from "../lib/useClickOutside";

// Controlled task composer. The parent decides when it's shown (top + button,
// a section's + , or a task's add-subtask +); this just renders the form.
export default function AddTask({
  projectId,
  sectionId = null,
  parentId = null,
  onAdded,
  onClose,
  placeholder = "Task name",
}) {
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState(4);
  const [dueDate, setDueDate] = useState("");

  async function create() {
    const trimmed = content.trim();
    if (!trimmed) return false;
    await api.createTask({
      project_id: projectId,
      section_id: sectionId,
      parent_id: parentId,
      content: trimmed,
      priority,
      due_date: dueDate || null,
    });
    onAdded();
    return true;
  }

  async function submit(e) {
    e.preventDefault();
    // Add button / Enter: create and stay open for rapid entry.
    if (await create()) {
      setContent("");
      setPriority(4);
      setDueDate("");
    }
  }

  // Clicking off commits whatever's typed (unless blank), then closes.
  const ref = useClickOutside(async () => {
    await create();
    onClose?.();
  });

  return (
    <form
      ref={ref}
      onSubmit={submit}
      className="animate-pop mt-1.5 rounded-lg border border-border bg-surface p-3 shadow-pop"
    >
      <input
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose?.()}
        placeholder={placeholder}
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
            onClick={() => onClose?.()}
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
