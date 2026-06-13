import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../api";
import TaskItem from "./TaskItem";
import AddTask from "./AddTask";

export default function TaskView({ project }) {
  const [sections, setSections] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState("");

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([
      api.listSections(project.id),
      api.listTasks({ project_id: project.id }),
    ]);
    setSections(s);
    setTasks(t);
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Map parent task id -> its subtasks.
  const subtasksByParent = {};
  for (const t of tasks) {
    if (t.parent_id != null) (subtasksByParent[t.parent_id] ??= []).push(t);
  }

  const topLevel = tasks.filter((t) => t.parent_id == null);
  const visible = (t) => showCompleted || !t.completed;

  function tasksFor(sectionId) {
    return topLevel.filter((t) => t.section_id === sectionId && visible(t));
  }

  async function addSection(e) {
    e.preventDefault();
    const name = sectionName.trim();
    if (!name) return;
    await api.createSection({ project_id: project.id, name, order: sections.length });
    setSectionName("");
    setAddingSection(false);
    load();
  }

  function renderTaskList(list) {
    return list.map((t) => (
      <TaskItem
        key={t.id}
        task={t}
        subtasks={(subtasksByParent[t.id] ?? []).filter(visible)}
        projectId={project.id}
        onChanged={load}
      />
    ));
  }

  const completedCount = topLevel.filter((t) => t.completed).length;

  return (
    <div className="mx-auto max-w-[720px] px-8 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-medium" style={{ color: "var(--color-text-primary)" }}>
          {project.name}
        </h1>
        {completedCount > 0 && (
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
          >
            {showCompleted ? "Hide" : "Show"} completed ({completedCount})
          </button>
        )}
      </header>

      {/* Sectionless tasks */}
      <div className="space-y-0.5">{renderTaskList(tasksFor(null))}</div>
      <AddTask projectId={project.id} sectionId={null} onAdded={load} />

      {/* Sections */}
      {sections.map((s) => (
        <section key={s.id} className="mt-8">
          <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
            {s.name}
          </h2>
          <div className="space-y-0.5">{renderTaskList(tasksFor(s.id))}</div>
          <AddTask projectId={project.id} sectionId={s.id} onAdded={load} />
        </section>
      ))}

      {/* Add section */}
      <div className="mt-8">
        {addingSection ? (
          <form onSubmit={addSection}>
            <input
              autoFocus
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              onBlur={() => !sectionName && setAddingSection(false)}
              placeholder="Section name"
              className="w-full rounded bg-elevated px-3 py-2 placeholder:text-text-muted focus:outline-none"
            />
          </form>
        ) : (
          <button
            onClick={() => setAddingSection(true)}
            className="flex items-center gap-1 text-sm text-text-muted transition-colors duration-150 hover:text-text-secondary"
          >
            <Plus size={14} /> Add section
          </button>
        )}
      </div>
    </div>
  );
}
