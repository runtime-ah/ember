import { useState } from "react";
import { api } from "../api";
import TaskItem from "./TaskItem";

// Renders a reorderable group of top-level tasks. Drag-to-reorder within the
// group uses native HTML5 DnD (no dependency); the backend persists the new
// order via /api/tasks/reorder. Drops from another group are ignored.
export default function TaskList({ tasks, subtasksByParent, visible, projectId, onChanged }) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  function reset() {
    setDragId(null);
    setOverId(null);
  }

  async function handleDrop(targetId) {
    const sourceId = dragId;
    reset();
    if (sourceId == null || sourceId === targetId) return;
    const ids = tasks.map((t) => t.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return; // drag came from a different group

    const arr = [...tasks];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    await api.reorderTasks(arr.map((t, i) => ({ id: t.id, order: i })));
    onChanged();
  }

  return (
    <div className="space-y-0.5">
      {tasks.map((t) => {
        const isOver = overId === t.id && dragId !== t.id;
        return (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => {
              setDragId(t.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnter={() => dragId != null && setOverId(t.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(t.id)}
            onDragEnd={reset}
            className={`cursor-grab rounded-md border-t-2 transition-colors active:cursor-grabbing ${
              isOver ? "border-accent" : "border-transparent"
            } ${dragId === t.id ? "opacity-40" : ""}`}
          >
            <TaskItem
              task={t}
              subtasks={(subtasksByParent[t.id] ?? []).filter(visible)}
              projectId={projectId}
              onChanged={onChanged}
            />
          </div>
        );
      })}
    </div>
  );
}
