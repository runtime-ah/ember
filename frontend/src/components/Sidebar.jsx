import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  PanelLeft,
  PanelLeftClose,
  Tag,
  Trash2,
  X,
} from "lucide-react";

const LABEL_COLORS = [
  "#c96442", "#e05252", "#e07d52", "#e0c252",
  "#52a852", "#52a8e0", "#7d52e0", "#999999",
];
import { api } from "../api";
import { Icon } from "../lib/icons";
import { useClickOutside } from "../lib/useClickOutside";
import IconPicker from "./IconPicker";
import ThemeToggle from "./ThemeToggle";

export default function Sidebar({
  projects,
  selectedId,
  onSelect,
  onProjectsChanged,
  calendarActive,
  onOpenCalendar,
  activeView,       // { type: 'today' | 'upcoming' | 'label', id?: number }
  onOpenView,       // (view) => void
  open,             // mobile drawer open state
  onClose,          // close the mobile drawer
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [newIcon, setNewIcon] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "1",
  );
  const [labels, setLabels] = useState([]);
  const [labelsOpen, setLabelsOpen] = useState(true);
  const [colorPickerFor, setColorPickerFor] = useState(null);
  const colorPickerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const refresh = () => api.listLabels().then(setLabels).catch(() => {});
    refresh();
    window.addEventListener("labels:changed", refresh);
    return () => window.removeEventListener("labels:changed", refresh);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setColorPickerFor(null);
      }
    }
    if (colorPickerFor !== null) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [colorPickerFor]);

  async function updateLabelColor(id, color) {
    await api.updateLabel(id, { color });
    setLabels((prev) => prev.map((l) => (l.id === id ? { ...l, color } : l)));
    setColorPickerFor(null);
  }

  function cancelAdd() {
    setAdding(false);
    setName("");
    setNewIcon(null);
  }

  async function addProject(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await api.createProject({ name: trimmed, icon: newIcon, order: projects.length });
    cancelAdd();
    onProjectsChanged();
  }

  const addRef = useClickOutside(async () => {
    const trimmed = name.trim();
    if (trimmed) {
      await api.createProject({ name: trimmed, icon: newIcon, order: projects.length });
      onProjectsChanged();
    }
    cancelAdd();
  }, adding);

  async function removeProject(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this project and all its tasks?")) return;
    await api.deleteProject(id);
    onProjectsChanged();
  }

  async function deleteLabel(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this label?")) return;
    await api.deleteLabel(id);
    setLabels((prev) => prev.filter((l) => l.id !== id));
    // If this label is currently active, go back to first project.
    if (activeView?.type === "label" && activeView.id === id) {
      onSelect(projects[0]?.id ?? null);
    }
  }

  function isViewActive(type, id) {
    return activeView?.type === type && (id === undefined || activeView.id === id);
  }

  const navItem = (icon, label, onClick, active, extra) => (
    <div
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors duration-150 ${
        active
          ? "bg-accent-subtle font-medium text-text-primary"
          : "text-text-secondary hover:bg-elevated/60 hover:text-text-primary"
      }`}
    >
      {icon}
      <span
        className={`flex-1 truncate transition-opacity duration-150 ${
          collapsed ? "md:opacity-0" : "opacity-100"
        }`}
      >
        {label}
      </span>
      {extra}
    </div>
  );

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden whitespace-nowrap border-r border-border bg-surface
        md:relative md:z-auto md:translate-x-0 md:transition-[width] md:duration-200 md:ease-in-out
        fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        ${collapsed ? "w-64 md:w-16" : "w-64 md:w-60"}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-4">
        {/* Mobile: close drawer */}
        <button
          onClick={onClose}
          className="shrink-0 text-text-secondary transition-colors duration-150 hover:text-text-primary md:hidden"
          title="Close menu"
        >
          <X size={16} />
        </button>
        {/* Desktop: collapse/expand sidebar */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden shrink-0 text-text-secondary transition-colors duration-150 hover:text-text-primary md:block"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <span
          className={`flex-1 text-[10px] font-medium uppercase tracking-wide text-text-muted transition-opacity duration-150 ${
            collapsed ? "md:opacity-0" : "opacity-100"
          }`}
        >
          Menu
        </span>
        <div
          className={`flex items-center gap-2 transition-opacity duration-150 ${
            collapsed ? "md:pointer-events-none md:opacity-0" : "opacity-100"
          }`}
        >
          <ThemeToggle />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Built-in views */}
        <div className="mb-1">
          {navItem(
            <Clock size={15} className="shrink-0 text-accent" />,
            "Today",
            () => onOpenView({ type: "today" }),
            isViewActive("today"),
          )}
          {navItem(
            <CalendarDays size={15} className="shrink-0 text-accent" />,
            "Upcoming",
            () => onOpenView({ type: "upcoming" }),
            isViewActive("upcoming"),
          )}
        </div>

        <div className="my-2 border-t border-border/40" />

        {/* Calendar */}
        {navItem(
          <CalendarDays size={16} className="shrink-0 text-accent" />,
          "Calendar",
          onOpenCalendar,
          calendarActive,
        )}

        <div className="my-2 border-t border-border/40" />

        {/* Labels */}
        <div className={`mb-1 ${collapsed ? "md:hidden" : ""}`}>
            <button
              onClick={() => setLabelsOpen((v) => !v)}
              className="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary"
            >
              {labelsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Labels
            </button>
            {labelsOpen &&
              labels.map((l) => (
                <div
                  key={l.id}
                  className={`group relative flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
                    isViewActive("label", l.id)
                      ? "bg-accent-subtle font-medium text-text-primary"
                      : "text-text-secondary hover:bg-elevated/60 hover:text-text-primary"
                  }`}
                >
                  {/* Color dot — click to change color */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setColorPickerFor(colorPickerFor === l.id ? null : l.id); }}
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-offset-1 hover:ring-2 hover:ring-border"
                    style={{ backgroundColor: l.color }}
                    title="Change color"
                  />
                  {/* Color swatch popover */}
                  {colorPickerFor === l.id && (
                    <div
                      ref={colorPickerRef}
                      className="absolute left-6 top-0 z-50 flex gap-1 rounded-lg border border-border bg-surface p-1.5 shadow-pop"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateLabelColor(l.id, c)}
                          className="h-4 w-4 shrink-0 rounded-full transition-transform hover:scale-125"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  )}
                  <span
                    className="flex-1 truncate"
                    onClick={() => onOpenView({ type: "label", id: l.id, name: l.name })}
                  >
                    #{l.name}
                  </span>
                  <button
                    onClick={(e) => deleteLabel(e, l.id)}
                    className="opacity-0 text-text-muted hover:text-danger group-hover:opacity-100"
                    title="Delete label"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            {labels.length === 0 && labelsOpen && (
              <p className="px-2 py-1 text-[11px] text-text-muted">
                No labels yet — type #tag in a task.
              </p>
            )}
        </div>
        {collapsed && (
          <div
            title="Labels"
            className="hidden cursor-pointer items-center justify-center rounded-md px-2.5 py-2 text-text-secondary hover:bg-elevated/60 hover:text-text-primary md:flex"
          >
            <Tag size={16} />
          </div>
        )}

        <div className="my-2 border-t border-border/40" />

        {/* Projects header */}
        <div
          className={`mb-1 flex items-center gap-2 px-2 transition-opacity duration-150 ${
            collapsed ? "md:pointer-events-none md:opacity-0" : "opacity-100"
          }`}
        >
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Projects
          </span>
          <button
            onClick={() => setAdding((v) => !v)}
            className="text-text-muted hover:text-text-secondary"
            title="New project"
          >
            <Plus size={14} />
          </button>
        </div>

        {adding && (
          <form ref={addRef} onSubmit={addProject} className="mb-1 flex items-center gap-1 px-2">
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

        {projects.map((p) => {
          const active = p.id === selectedId && !activeView && !calendarActive;
          if (editingId === p.id) {
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
              className={`group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors duration-150 ${
                active
                  ? "bg-accent-subtle font-medium text-text-primary"
                  : "text-text-secondary hover:bg-elevated/60 hover:text-text-primary"
              }`}
            >
              <Icon name={p.icon} size={16} className="shrink-0" style={{ color: p.color }} />
              <span
                className={`flex-1 truncate transition-opacity duration-150 ${
                  collapsed ? "md:opacity-0" : "opacity-100"
                }`}
              >
                {p.name}
              </span>
              <div className={`flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${collapsed ? "md:hidden" : ""}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(p.id); }}
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

  async function commit() {
    const trimmed = name.trim();
    if (trimmed) {
      await api.updateProject(project.id, { name: trimmed, icon });
      onSaved();
    }
    onDone();
  }

  async function save(e) {
    e.preventDefault();
    await commit();
  }

  const ref = useClickOutside(commit);

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
