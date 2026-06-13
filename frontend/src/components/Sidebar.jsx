import { useEffect, useState } from "react";
import { Plus, Hash, Trash2, PanelLeftClose, PanelLeft } from "lucide-react";
import { api } from "../api";
import ThemeToggle from "./ThemeToggle";

export default function Sidebar({ projects, selectedId, onSelect, onProjectsChanged }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "1",
  );

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  async function addProject(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await api.createProject({ name: trimmed, order: projects.length });
    setName("");
    setAdding(false);
    onProjectsChanged();
  }

  async function removeProject(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this project and all its tasks?")) return;
    await api.deleteProject(id);
    onProjectsChanged();
  }

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-surface py-4">
        <button
          onClick={() => setCollapsed(false)}
          className="mb-4 text-text-secondary transition-colors duration-150 hover:text-text-primary"
          title="Expand sidebar"
        >
          <PanelLeft size={16} />
        </button>
        <div className="mb-4">
          <ThemeToggle collapsed />
        </div>
        <nav className="flex flex-col items-center gap-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              title={p.name}
              className={`flex h-8 w-8 items-center justify-center rounded transition-colors duration-150 ${
                p.id === selectedId ? "bg-elevated" : "hover:bg-elevated"
              }`}
            >
              <Hash size={16} style={{ color: p.color }} />
            </button>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
          Projects
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setAdding((v) => !v)}
            className="text-text-secondary transition-colors duration-150 hover:text-text-primary"
            title="New project"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="text-text-secondary transition-colors duration-150 hover:text-text-primary"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={addProject} className="px-3 pb-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => !name && setAdding(false)}
            placeholder="Project name"
            className="w-full rounded bg-elevated px-2 py-1.5 text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </form>
      )}

      <nav className="flex-1 overflow-y-auto px-2">
        {projects.map((p) => {
          const active = p.id === selectedId;
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors duration-150 ${
                active
                  ? "border-l-2 border-accent bg-elevated text-text-primary"
                  : "border-l-2 border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Hash size={16} style={{ color: p.color }} />
              <span className="flex-1 truncate">{p.name}</span>
              <button
                onClick={(e) => removeProject(e, p.id)}
                className="text-text-muted opacity-0 transition-opacity duration-150 hover:text-danger group-hover:opacity-100"
                title="Delete project"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
