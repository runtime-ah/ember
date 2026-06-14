import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { api } from "./api";
import Sidebar from "./components/Sidebar";
import TaskView from "./components/TaskView";
import CalendarView from "./components/CalendarView";
import FilteredTaskView from "./components/FilteredTaskView";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [views, setViews] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeView, setActiveView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function loadProjects(selectFirst = false) {
    try {
      const data = await api.listProjects();
      setProjects(data);
      if (selectFirst && data.length && selectedId === null) {
        setSelectedId(data[0].id);
      }
      if (selectedId !== null && !data.some((p) => p.id === selectedId)) {
        setSelectedId(data[0]?.id ?? null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadViews() {
    try {
      const data = await api.listViews();
      setViews(data);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    loadProjects(true);
    loadViews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  function handleSelectProject(id) {
    setActiveView(null);
    setSelectedId(id);
    setSidebarOpen(false);
  }

  function handleOpenView(view) {
    setActiveView(view);
    setSelectedId(null);
    setSidebarOpen(false);
  }

  function handleOpenCalendar() {
    setActiveView({ type: "calendar" });
    setSelectedId(null);
    setSidebarOpen(false);
  }

  function mobileTitle() {
    if (!activeView) return selected?.name ?? "Todo";
    if (activeView.type === "calendar") return "Calendar";
    if (activeView.type === "label") return `#${activeView.name ?? "tag"}`;
    if (activeView.type === "view") return activeView.name ?? "View";
    return "Todo";
  }

  function renderMain() {
    if (!activeView && selected) return <TaskView key={selected.id} project={selected} />;
    if (!activeView) return <p className="p-8 text-text-muted">No projects yet — create one in the sidebar.</p>;

    if (activeView.type === "calendar") return <CalendarView />;

    if (activeView.type === "label") {
      return (
        <FilteredTaskView
          key={activeView.id}
          title={`#${activeView.name ?? "tag"}`}
          params={{ label_id: activeView.id }}
          emptyMessage="No tasks with this tag."
        />
      );
    }

    if (activeView.type === "view") {
      let params = {};
      try { params = JSON.parse(activeView.filter_json || "{}"); } catch { /* bad json */ }
      return (
        <FilteredTaskView
          key={activeView.id}
          title={activeView.name}
          params={{ ...params, completed: false }}
          emptyMessage="Nothing matches this view."
        />
      );
    }

    return null;
  }

  return (
    <div className="flex h-full">
      <Sidebar
        projects={projects}
        views={views}
        selectedId={activeView ? null : selectedId}
        onSelect={handleSelectProject}
        onProjectsChanged={loadProjects}
        onViewsChanged={loadViews}
        calendarActive={activeView?.type === "calendar"}
        onOpenCalendar={handleOpenCalendar}
        activeView={activeView?.type !== "calendar" ? activeView : null}
        onOpenView={handleOpenView}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-text-secondary hover:text-text-primary"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-medium text-text-primary">{mobileTitle()}</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 rounded border border-danger/40 p-3 text-danger">{error}</div>
          )}
          {loading ? <p className="p-8 text-text-muted">Loading…</p> : renderMain()}
        </main>
      </div>
    </div>
  );
}
