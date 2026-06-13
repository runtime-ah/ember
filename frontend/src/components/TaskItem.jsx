import { useState } from "react";
import { Trash2, Bell, Plus } from "lucide-react";
import { api } from "../api";
import { PRIORITIES, priorityColor, formatDue } from "../lib/priority";
import { useClickOutside } from "../lib/useClickOutside";
import AddTask from "./AddTask";

export default function TaskItem({ task, subtasks = [], projectId, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [addingSub, setAddingSub] = useState(false);

  async function toggle() {
    if (task.completed) await api.uncompleteTask(task.id);
    else await api.completeTask(task.id);
    onChanged();
  }

  async function remove() {
    await api.deleteTask(task.id);
    onChanged();
  }

  if (editing) {
    return <TaskEditor task={task} onDone={() => setEditing(false)} onChanged={onChanged} />;
  }

  const due = formatDue(task.due_date, task.due_time);
  const dotColor = priorityColor(task.priority);

  return (
    <div>
      <div className="group flex items-start gap-2 rounded px-1 py-1.5 transition-colors duration-150 hover:bg-elevated/50">
        <button
          onClick={toggle}
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150"
          style={{
            borderColor: dotColor ?? "var(--color-text-muted)",
            backgroundColor: task.completed ? "var(--color-accent)" : "transparent",
          }}
          title={task.completed ? "Mark incomplete" : "Mark complete"}
        >
          {task.completed && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing(true)}>
          <div className="flex items-center gap-2">
            <span
              className={
                task.completed
                  ? "text-text-muted line-through"
                  : "text-text-primary"
              }
            >
              {task.content}
            </span>
            {dotColor && !task.completed && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: dotColor }}
                title={`P${task.priority}`}
              />
            )}
          </div>
          {task.description && (
            <p className="truncate text-xs text-text-secondary">{task.description}</p>
          )}
          <div className="flex items-center gap-3">
            {due && (
              <span
                className={`text-xs ${due.overdue && !task.completed ? "text-danger" : "text-text-secondary"}`}
              >
                {due.label}
              </span>
            )}
            {task.reminder_time && !task.completed && (
              <span
                className="flex items-center gap-1 text-xs text-text-secondary"
                title={`Reminder: ${new Date(task.reminder_time).toLocaleString()}`}
              >
                <Bell size={11} />
              </span>
            )}
          </div>
        </div>

        <div className="mt-0.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {task.parent_id == null && (
            <button
              onClick={() => setAddingSub(true)}
              className="text-text-muted hover:text-text-primary"
              title="Add subtask"
            >
              <Plus size={15} />
            </button>
          )}
          <button
            onClick={remove}
            className="text-text-muted hover:text-danger"
            title="Delete task"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Subtasks (one level deep) */}
      <div className="ml-6">
        {subtasks.map((st) => (
          <TaskItem
            key={st.id}
            task={st}
            projectId={projectId}
            onChanged={onChanged}
          />
        ))}
        {addingSub && (
          <AddTask
            projectId={projectId}
            sectionId={task.section_id}
            parentId={task.id}
            placeholder="Subtask name"
            onAdded={onChanged}
            onClose={() => setAddingSub(false)}
          />
        )}
      </div>
    </div>
  );
}

function TaskEditor({ task, onDone, onChanged }) {
  const [content, setContent] = useState(task.content);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  // datetime-local wants "YYYY-MM-DDTHH:MM"; the API returns full ISO seconds.
  const [reminder, setReminder] = useState(
    task.reminder_time ? task.reminder_time.slice(0, 16) : "",
  );
  const ref = useClickOutside(onDone);

  async function save(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    await api.updateTask(task.id, {
      content: trimmed,
      description: description.trim() || null,
      priority,
      due_date: dueDate || null,
      reminder_time: reminder || null,
    });
    onChanged();
    onDone();
  }

  return (
    <form ref={ref} onSubmit={save} className="my-1 rounded border border-border bg-surface p-3">
      <input
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="mb-2 w-full bg-transparent text-text-primary focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        className="mb-2 w-full resize-none rounded bg-elevated px-2 py-1 text-xs text-text-secondary placeholder:text-text-muted focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
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
        <label className="flex items-center gap-1 text-xs text-text-muted">
          <Bell size={12} />
          <input
            type="datetime-local"
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            className="rounded bg-elevated px-2 py-1 text-xs text-text-secondary focus:outline-none"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded px-3 py-1 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1 text-xs text-white transition-colors duration-150 hover:bg-accent-hover"
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
