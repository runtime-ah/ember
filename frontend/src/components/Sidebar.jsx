import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  Plus,
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

export default function Sidebar({
  projects,
  views,
  selectedId,
  onSelect,
  onProjectsChanged,
  onViewsChanged,
  calendarActive,
  onOpenCalendar,
  activeView,
  onOpenView,
  open,
  onClose,
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
  const [addingView, setAddingView] = useState(false);
  const [editingViewId, setEditingViewId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { kind, id, x, y }
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const longPressTimer = useRef(null);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [contextMenu]);

  useEffect(() => {
    const refresh = () => api.listLabels().then(setLabels).catch(() => {});
    refresh();
    window.addEventListener("labels:changed", refresh);
    return () => window.removeEventListener("labels:changed", refresh);
  }, []);

  useEffect(() => {
    loadArchivedProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function openContextMenu(e, kind, id) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ kind, id, x: e.clientX, y: e.clientY });
  }

  async function removeProject(id) {
    setContextMenu(null);
    if (!confirm("Delete this project and all its tasks?")) return;
    await api.deleteProject(id);
    onProjectsChanged();
  }

  async function deleteLabel(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this tag?")) return;
    await api.deleteLabel(id);
    setLabels((prev) => prev.filter((l) => l.id !== id));
    if (activeView?.type === "label" && activeView.id === id) {
      onSelect(projects[0]?.id ?? null);
    }
  }

  async function deleteView(id) {
    setContextMenu(null);
    if (!confirm("Delete this view?")) return;
    await api.deleteView(id);
    onViewsChanged();
    if (activeView?.type === "view" && activeView.id === id) {
      onSelect(projects[0]?.id ?? null);
    }
  }

  async function loadArchivedProjects() {
    const all = await api.listProjects(true);
    setArchivedProjects(all.filter((p) => p.archived));
  }

  async function archiveProject(id) {
    setContextMenu(null);
    await api.archiveProject(id);
    onProjectsChanged();
    loadArchivedProjects();
  }

  async function unarchiveProject(id) {
    setContextMenu(null);
    await api.unarchiveProject(id);
    onProjectsChanged();
    loadArchivedProjects();
  }

  function startLongPress(e, kind, id) {
    const target = e.currentTarget;
    longPressTimer.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      setContextMenu({ kind, id, x: rect.left + 4, y: rect.bottom + 2 });
    }, 500);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function isViewActive(type, id) {
    return activeView?.type === type && (id === undefined || activeView.id === id);
  }

  const navItem = (icon, label, onClick, active) => (
    <div
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[16px] transition-colors duration-150 ${
        active
          ? "bg-accent-subtle font-medium text-text-primary"
          : "text-text-secondary hover:bg-elevated/60 hover:text-text-primary"
      }`}
    >
      {icon}
      <span className={`flex-1 truncate transition-opacity duration-150 ${collapsed ? "md:opacity-0" : "opacity-100"}`}>
        {label}
      </span>
    </div>
  );

  return (
    <aside
      className={`safe-top flex shrink-0 flex-col overflow-hidden whitespace-nowrap border-r border-border bg-surface
        md:relative md:z-auto md:translate-x-0 md:transition-[width] md:duration-200 md:ease-in-out
        fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        ${collapsed ? "w-80 md:w-16" : "w-80 md:w-64"}
      `}
    >
      {/* Collapse toggle — aligned with nav items */}
      <div className="px-2 pt-3 pb-1">
        {/* Mobile: close overlay */}
        <button
          onClick={onClose}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[16px] text-text-secondary transition-colors duration-150 hover:bg-elevated/60 hover:text-text-primary md:hidden"
          title="Close menu"
        >
          <X size={16} className="shrink-0" />
          <span>Close</span>
        </button>
        {/* Desktop: collapse/expand */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[16px] text-text-secondary transition-colors duration-150 hover:bg-elevated/60 hover:text-text-primary md:flex"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <ChevronsRight size={16} className="shrink-0" />
            : <ChevronsLeft size={16} className="shrink-0" />}
          <span className={`transition-opacity duration-150 ${collapsed ? "md:opacity-0" : "opacity-100"}`}>
            Collapse
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Calendar */}
        {navItem(
          <CalendarDays size={16} className="shrink-0 text-accent" />,
          "Calendar",
          onOpenCalendar,
          calendarActive,
        )}

        <div className="my-2 border-t border-border/40" />

        {/* Projects header */}
        <div className={`mb-1 flex items-center gap-2 px-2 transition-opacity duration-150 ${collapsed ? "md:pointer-events-none md:opacity-0" : "opacity-100"}`}>
          <span className="flex-1 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
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

        {projects.map((p, idx) => {
          const active = p.id === selectedId && !activeView && !calendarActive;
          const showDivider = idx > 0 && !p.pinned && projects[idx - 1].pinned;
          const progress = !p.pinned && p.task_count > 0
            ? { done: p.completed_count, total: p.task_count }
            : null;

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
            <div key={p.id}>
              {showDivider && <div className="my-1.5 border-t border-border/30" />}
              <div
                onClick={() => onSelect(p.id)}
                onContextMenu={(e) => openContextMenu(e, "project", p.id)}
                onTouchStart={(e) => startLongPress(e, "project", p.id)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                title={p.name}
                className={`select-none flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[16px] transition-colors duration-150 ${
                  active
                    ? "bg-accent-subtle font-medium text-text-primary"
                    : "text-text-secondary hover:bg-elevated/60 hover:text-text-primary"
                }`}
              >
                <Icon name={p.icon} size={16} className="shrink-0" style={{ color: p.color }} />
                <span className={`min-w-0 flex-1 truncate transition-opacity duration-150 ${collapsed ? "md:opacity-0" : "opacity-100"}`}>
                  {p.name}
                </span>
                {progress && !collapsed && (
                  <span className="nums shrink-0 rounded-full bg-elevated px-1.5 py-0.5 text-[12px] text-text-muted">
                    {progress.done}/{progress.total}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Archived projects */}
        {!collapsed && archivedProjects.length > 0 && (
          <div className="mb-1">
            <button
              onClick={() => setArchivedOpen((v) => !v)}
              className="flex w-full items-center gap-1 px-2 py-1 text-[13px] font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary"
            >
              {archivedOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Archived
            </button>
            {archivedOpen && archivedProjects.map((p) => (
              <div
                key={p.id}
                onContextMenu={(e) => openContextMenu(e, "archived-project", p.id)}
                onTouchStart={(e) => startLongPress(e, "archived-project", p.id)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                title={p.name}
                className="select-none flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-[16px] text-text-muted hover:bg-elevated/60 hover:text-text-secondary"
              >
                <Icon name={p.icon} size={16} className="shrink-0 opacity-50" style={{ color: p.color }} />
                <span className="min-w-0 flex-1 truncate opacity-70">{p.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="my-2 border-t border-border/40" />

        {/* Tags — hidden when collapsed */}
        <div className={`mb-1 ${collapsed ? "md:hidden" : ""}`}>
          <button
            onClick={() => setLabelsOpen((v) => !v)}
            className="flex w-full items-center gap-1 px-2 py-1 text-[13px] font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary"
          >
            {labelsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Tags
          </button>
          {labelsOpen &&
            labels.map((l) => (
              <div
                key={l.id}
                className={`group relative flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[16px] transition-colors duration-150 ${
                  isViewActive("label", l.id)
                    ? "bg-accent-subtle font-medium text-text-primary"
                    : "text-text-secondary hover:bg-elevated/60 hover:text-text-primary"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setColorPickerFor(colorPickerFor === l.id ? null : l.id); }}
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-offset-1 hover:ring-2 hover:ring-border"
                  style={{ backgroundColor: l.color }}
                  title="Change color"
                />
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
                  className="min-w-0 flex-1 truncate"
                  onClick={() => onOpenView({ type: "label", id: l.id, name: l.name })}
                >
                  #{l.name}
                </span>
                <button
                  onClick={(e) => deleteLabel(e, l.id)}
                  className="opacity-0 text-text-muted hover:text-danger group-hover:opacity-100"
                  title="Delete tag"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          {labels.length === 0 && labelsOpen && (
            <p className="px-2 py-1 text-[13px] text-text-muted">
              No tags yet — type #tag in a task.
            </p>
          )}
        </div>

        {!collapsed && <div className="my-2 border-t border-border/40" />}

        {/* Views — hidden when collapsed */}
        <div className={`mb-1 ${collapsed ? "md:hidden" : ""}`}>
          <div className="mb-1 flex items-center gap-2 px-2">
            <span className="flex-1 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
              Views
            </span>
            <button
              onClick={() => setAddingView(true)}
              className="text-text-muted hover:text-text-secondary"
              title="New view"
            >
              <Plus size={14} />
            </button>
          </div>

          {addingView && (
            <ViewEditor
              labels={labels}
              projects={projects}
              order={views.length}
              onDone={() => setAddingView(false)}
              onSaved={onViewsChanged}
            />
          )}

          {views.map((v) => {
            const active = isViewActive("view", v.id);
            if (editingViewId === v.id) {
              return (
                <ViewEditor
                  key={v.id}
                  view={v}
                  labels={labels}
                  projects={projects}
                  order={v.order}
                  onDone={() => setEditingViewId(null)}
                  onSaved={onViewsChanged}
                />
              );
            }
            return (
              <div
                key={v.id}
                onClick={() => onOpenView({ type: "view", id: v.id, name: v.name, filter_json: v.filter_json })}
                onContextMenu={(e) => openContextMenu(e, "view", v.id)}
                onTouchStart={(e) => startLongPress(e, "view", v.id)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                className={`select-none flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[16px] transition-colors duration-150 ${
                  active
                    ? "bg-accent-subtle font-medium text-text-primary"
                    : "text-text-secondary hover:bg-elevated/60 hover:text-text-primary"
                }`}
              >
                <Icon name={v.icon} size={15} className="shrink-0 text-text-muted" />
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
              </div>
            );
          })}

          {views.length === 0 && !addingView && (
            <p className="px-2 py-1 text-[13px] text-text-muted">
              No views yet — click + to create one.
            </p>
          )}
        </div>
      </nav>

      {/* Right-click context menu — rendered via portal to escape aside's CSS transform */}
      {contextMenu && createPortal(
        <div
          className="fixed z-[200] min-w-[140px] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-pop"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.kind === "project" && (() => {
            const p = projects.find((x) => x.id === contextMenu.id);
            return (
              <>
                <button
                  onClick={() => { setEditingId(contextMenu.id); setContextMenu(null); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-elevated hover:text-text-primary"
                >
                  <Pencil size={13} /> Edit
                </button>
                {!p?.pinned && (
                  <button
                    onClick={() => archiveProject(contextMenu.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-elevated hover:text-text-primary"
                  >
                    <Archive size={13} /> Archive
                  </button>
                )}
                {!p?.pinned && (
                  <button
                    onClick={() => removeProject(contextMenu.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-danger hover:bg-elevated"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </>
            );
          })()}
          {contextMenu.kind === "archived-project" && (
            <button
              onClick={() => unarchiveProject(contextMenu.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-elevated hover:text-text-primary"
            >
              <ArchiveRestore size={13} /> Unarchive
            </button>
          )}
          {contextMenu.kind === "view" && (
            <>
              <button
                onClick={() => { setEditingViewId(contextMenu.id); setContextMenu(null); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-elevated hover:text-text-primary"
              >
                <Pencil size={13} /> Edit
              </button>
              <button
                onClick={() => deleteView(contextMenu.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-danger hover:bg-elevated"
              >
                <Trash2 size={13} /> Delete
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </aside>
  );
}

function ViewEditor({ view, labels, projects, order, onDone, onSaved }) {
  const existing = (() => {
    try { return JSON.parse(view?.filter_json ?? "{}"); } catch { return {}; }
  })();

  const [name, setName] = useState(view?.name ?? "");
  const [icon, setIcon] = useState(view?.icon ?? null);
  const [labelId, setLabelId] = useState(existing.label_id ?? "");
  const [projectId, setProjectId] = useState(existing.project_id ?? "");
  const [priority, setPriority] = useState(existing.priority ?? "");
  const [noDueDate, setNoDueDate] = useState(existing.no_due_date ?? false);

  function buildFilterJson() {
    const f = {};
    if (labelId) f.label_id = Number(labelId);
    if (projectId) f.project_id = Number(projectId);
    if (priority) f.priority = Number(priority);
    if (noDueDate) f.no_due_date = true;
    return JSON.stringify(f);
  }

  async function commit() {
    const trimmed = name.trim();
    if (!trimmed) { onDone(); return; }
    const payload = { name: trimmed, icon, filter_json: buildFilterJson(), order };
    if (view) await api.updateView(view.id, payload);
    else await api.createView(payload);
    onSaved();
    onDone();
  }

  async function save(e) {
    e.preventDefault();
    await commit();
  }

  const ref = useClickOutside(commit);

  return (
    <form ref={ref} onSubmit={save} className="animate-pop mb-1.5 rounded-lg border border-border bg-surface p-2 shadow-pop">
      <div className="mb-2 flex items-center gap-1">
        <IconPicker value={icon} onChange={setIcon} color="#999999" />
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onDone()}
          placeholder="View name"
          className="flex-1 rounded bg-elevated px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <button type="submit" className="shrink-0 text-text-secondary hover:text-text-primary" title="Save">
          <Check size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <select
          value={labelId}
          onChange={(e) => setLabelId(e.target.value)}
          className="rounded bg-elevated px-1.5 py-0.5 text-[13px] text-text-muted focus:outline-none"
        >
          <option value="">Any tag</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>#{l.name}</option>
          ))}
        </select>

        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded bg-elevated px-1.5 py-0.5 text-[13px] text-text-muted focus:outline-none"
        >
          <option value="">Any project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded bg-elevated px-1.5 py-0.5 text-[13px] text-text-muted focus:outline-none"
        >
          <option value="">Any priority</option>
          <option value="1">P1 only</option>
          <option value="2">P2 only</option>
          <option value="3">P3 only</option>
        </select>

        <label className="flex cursor-pointer items-center gap-1 rounded bg-elevated px-1.5 py-0.5 text-[13px] text-text-muted">
          <input
            type="checkbox"
            checked={noDueDate}
            onChange={(e) => setNoDueDate(e.target.checked)}
            className="h-3 w-3"
          />
          No date
        </label>
      </div>
    </form>
  );
}

function ProjectEditor({ project, onDone, onSaved }) {
  const [name, setName] = useState(project.name);
  const [icon, setIcon] = useState(project.icon);
  const [pinned, setPinned] = useState(project.pinned ?? false);

  async function commit() {
    const trimmed = name.trim();
    if (trimmed) {
      await api.updateProject(project.id, { name: trimmed, icon, pinned });
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
    <form ref={ref} onSubmit={save} className="rounded-lg border border-border bg-surface p-2 shadow-pop">
      <div className="mb-1.5 flex items-center gap-1">
        <IconPicker value={icon} onChange={setIcon} color={project.color} />
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onDone()}
          className="flex-1 bg-transparent text-[15px] text-text-primary focus:outline-none"
        />
        <button type="submit" className="shrink-0 text-text-secondary hover:text-text-primary" title="Save">
          <Check size={15} />
        </button>
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 px-0.5 text-[13px] text-text-muted">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
          className="h-3 w-3"
        />
        Always open — no progress tracking
      </label>
    </form>
  );
}
