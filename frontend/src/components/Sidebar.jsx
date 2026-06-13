import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, PanelLeftClose, PanelLeft, Check } from "lucide-react";
import { api } from "../api";
import { Icon } from "../lib/icons";
import { useClickOutside } from "../lib/useClickOutside";
import IconPicker from "./IconPicker";
import ThemeToggle from "./ThemeToggle";

export default function Sidebar({ projects, selectedId, onSelect, onProjectsChanged }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [newIcon, setNewIcon] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "1",
  );

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  function cancelAdd() {
    setAdding(false);
    setName("");
    setNewIcon(null);
  }
  const addRef = useClickOutside(cancelAdd, adding);

  async function addProject(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await api.createProject({ name: trimmed, icon: newIcon, order: projects.length });
    setName("");
    setNewIcon(null);
    setAdding(false);
    onProjectsChanged();
  }

  async function removeProject(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this project and all its tasks?")) return;
    await api.deleteProject(id);
    onProjectsChanged();
  }

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden whitespace-nowrap border-r border-border bg-surface transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-4">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="shrink-0 text-text-secondary transition-colors duration-150 hover:text-text-primary"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <span
          className={`flex-1 text-[10px] font-medium uppercase tracking-wide text-text-muted transition-opacity duration-150 ${
            collapsed ? "opacity-0" : "opacity-100"
          }`}
        >
          Projects
        </span>
        <div
          className={`flex items-center gap-2 transition-opacity duration-150 ${
            collapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <ThemeToggle />
          <button
            onClick={() => setAdding((v) => !v)}
            className="text-text-secondary transition-colors duration-150 hover:text-text-primary"
            title="New project"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {adding && !collapsed && (
        <form ref={addRef} onSubmit={addProject} className="flex items-center gap-1 px-3 pb-2">
          <IconPicker value={newIcon} onChange={setNewIcon} color="#c96442" />
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && cancelAdd()}
            placeholder="Project name"
            className="w-full rounded bg-elevated px-2 py-1.5 text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </form>
      )}

      <nav className="flex-1 overflow-y-auto px-2">
        {projects.map((p) => {
          const active = p.id === selectedId;
          if (editingId === p.id && !collapsed) {
            return (
              <ProjectEditor
                key={p.id}
                project={p}
                onDone={() => setEditingId(null)}
                onSaved={onProjectsChanged}
              />
            );
          }
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              title={collapsed ? p.name : undefined}
              className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors duration-150 ${
                active
                  ? "border-l-2 border-accent bg-elevated text-text-primary"
                  : "border-l-2 border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon name={p.icon} size={16} className="shrink-0" style={{ color: p.color }} />
              <span
                className={`flex-1 truncate transition-opacity duration-150 ${
                  collapsed ? "opacity-0" : "opacity-100"
                }`}
              >
                {p.name}
              </span>
              {!collapsed && (
                <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(p.id);
                    }}
                    className="text-text-muted hover:text-text-primary"
                    title="Edit project"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={(e) => removeProject(e, p.id)}
                    className="text-text-muted hover:text-danger"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function ProjectEditor({ project, onDone, onSaved }) {
  const [name, setName] = useState(project.name);
  const [icon, setIcon] = useState(project.icon);
  const ref = useClickOutside(onDone);

  async function save(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await api.updateProject(project.id, { name: trimmed, icon });
    onSaved();
    onDone();
  }

  return (
    <form ref={ref} onSubmit={save} className="flex items-center gap-1 rounded bg-elevated px-2 py-1.5">
      <IconPicker value={icon} onChange={setIcon} color={project.color} />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
        className="w-full bg-transparent text-text-primary focus:outline-none"
      />
      <button type="submit" className="shrink-0 text-text-secondary hover:text-text-primary" title="Save">
        <Check size={15} />
      </button>
    </form>
  );
}
