import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../api";
import { Icon } from "../lib/icons";
import { useClickOutside } from "../lib/useClickOutside";
import IconPicker from "./IconPicker";
import TaskList from "./TaskList";
import AddTask from "./AddTask";

const COLLAPSED_KEY = "collapsed-sections";

function loadCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export default function TaskView({ project }) {
  const [sections, setSections] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionIcon, setSectionIcon] = useState(null);
  const [editingSectionId, setEditingSectionId] = useState(null);
  // false = closed, null = project (no section), number = that section's id
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

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

  function toggleCollapsed(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  // Map parent task id -> its subtasks.
  const subtasksByParent = {};
  for (const t of tasks) {
    if (t.parent_id != null) (subtasksByParent[t.parent_id] ??= []).push(t);
  }

  const topLevel = tasks.filter((t) => t.parent_id == null);
  const visible = (t) => showCompleted || !t.completed;

  function sortTasks(list) {
    return [...list].sort((a, b) => {
      const aHasDate = a.due_date != null;
      const bHasDate = b.due_date != null;
      if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
      if (aHasDate && bHasDate) {
        const aKey = a.due_time ? `${a.due_date}T${a.due_time}` : `${a.due_date}T99:99`;
        const bKey = b.due_time ? `${b.due_date}T${b.due_time}` : `${b.due_date}T99:99`;
        if (aKey !== bKey) return aKey < bKey ? -1 : 1;
      }
      return a.priority - b.priority;
    });
  }

  function tasksFor(sectionId) {
    return sortTasks(topLevel.filter((t) => t.section_id === sectionId && visible(t)));
  }

  function cancelAddSection() {
    setAddingSection(false);
    setSectionName("");
    setSectionIcon(null);
  }

  async function createSection() {
    const name = sectionName.trim();
    if (!name) return;
    await api.createSection({
      project_id: project.id,
      name,
      icon: sectionIcon,
      order: sections.length,
    });
    load();
  }

  async function addSection(e) {
    e.preventDefault();
    await createSection();
    cancelAddSection();
  }

  // Click-off commits the new section (unless blank), then closes.
  const addSectionRef = useClickOutside(async () => {
    await createSection();
    cancelAddSection();
  }, addingSection);

  async function removeSection(id) {
    if (!confirm("Delete this section? Its tasks move to no section.")) return;
    await api.deleteSection(id);
    load();
  }

  function renderTaskList(list) {
    return (
      <TaskList
        tasks={list}
        subtasksByParent={subtasksByParent}
        visible={visible}
        projectId={project.id}
        onChanged={load}
      />
    );
  }

  const completedCount = topLevel.filter((t) => t.completed).length;

  return (
    <div className="mx-auto max-w-[720px] px-4 py-5 md:px-6 md:py-7">
      <div className="mb-5 flex items-center gap-3">
        {/* Project title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Icon name={project.icon} size={18} style={{ color: project.color ?? "var(--color-text-muted)" }} />
          <h2 className="truncate text-[18px] font-semibold text-text-primary">{project.name}</h2>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-3">
          {completedCount > 0 && (
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="nums text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
            >
              {showCompleted ? "Hide" : "Show"} completed ({completedCount})
            </button>
          )}
          <button
            onClick={() => setAdding(null)}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white shadow-soft transition-all duration-150 hover:-translate-y-px hover:bg-accent-hover active:translate-y-0"
            title="Add task"
          >
            <Plus size={16} /> Add task
          </button>
        </div>
      </div>

      {/* Sectionless tasks */}
      {renderTaskList(tasksFor(null))}
      {adding === null && (
        <AddTask
          projectId={project.id}
          sectionId={null}
          onAdded={load}
          onClose={() => setAdding(false)}
        />
      )}

      {/* Sections */}
      {sections.map((s) => {
        const isCollapsed = collapsed.has(s.id);
        const count = tasksFor(s.id).length;
        return (
          <section key={s.id} className="mt-5">
            {editingSectionId === s.id ? (
              <SectionEditor
                section={s}
                onDone={() => setEditingSectionId(null)}
                onSaved={load}
              />
            ) : (
              <div className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-soft transition-colors duration-150">
                <button
                  onClick={() => toggleCollapsed(s.id)}
                  className="text-text-muted transition-transform duration-150 hover:text-text-primary"
                  title={isCollapsed ? "Expand section" : "Collapse section"}
                >
                  {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                </button>
                <Icon name={s.icon} size={15} className="text-text-secondary" />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-text-secondary">
                  {s.name}
                </h2>
                <span className="nums rounded-full bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
                  {count}
                </span>
                <div className="ml-auto flex items-center gap-2 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100">
                  <button
                    onClick={() => setEditingSectionId(s.id)}
                    className="p-1 text-text-muted hover:text-text-primary"
                    title="Edit section"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => removeSection(s.id)}
                    className="p-1 text-text-muted hover:text-danger"
                    title="Delete section"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}

            {!isCollapsed && (
              <div className="mt-1 ml-3 border-l border-border/50 pl-3">
                {renderTaskList(tasksFor(s.id))}
                {adding === s.id ? (
                  <AddTask
                    projectId={project.id}
                    sectionId={s.id}
                    onAdded={load}
                    onClose={() => setAdding(false)}
                  />
                ) : (
                  <button
                    onClick={() => setAdding(s.id)}
                    className="mt-0.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-text-muted transition-colors duration-150 hover:bg-elevated/40 hover:text-text-secondary"
                  >
                    <Plus size={13} /> Add task
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* Add section */}
      <div className="mt-6">
        {addingSection ? (
          <form ref={addSectionRef} onSubmit={addSection} className="flex items-center gap-2">
            <IconPicker value={sectionIcon} onChange={setSectionIcon} color="#999999" />
            <input
              autoFocus
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && cancelAddSection()}
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

function SectionEditor({ section, onDone, onSaved }) {
  const [name, setName] = useState(section.name);
  const [icon, setIcon] = useState(section.icon);

  async function commit() {
    const trimmed = name.trim();
    if (trimmed) {
      await api.updateSection(section.id, { name: trimmed, icon });
      onSaved();
    }
    onDone();
  }

  async function save(e) {
    e.preventDefault();
    await commit();
  }

  // Click-off saves the edit (unless name was cleared), then closes.
  const ref = useClickOutside(commit);

  return (
    <form ref={ref} onSubmit={save} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2">
      <IconPicker value={icon} onChange={setIcon} color="#999999" />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
        className="w-full bg-transparent text-sm text-text-primary focus:outline-none"
      />
      <button type="submit" className="shrink-0 text-text-secondary hover:text-text-primary" title="Save">
        <Check size={15} />
      </button>
    </form>
  );
}
