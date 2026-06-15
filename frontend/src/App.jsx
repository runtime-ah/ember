import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { api } from "./api";
import Sidebar from "./components/Sidebar";
import TaskView from "./components/TaskView";
import CalendarView from "./components/CalendarView";
import FilteredTaskView from "./components/FilteredTaskView";
import EmberFlame from "./components/EmberFlame";
import ThemeToggle from "./components/ThemeToggle";

const NAV_KEY = "ember-nav";
function readNav() {
  try { return JSON.parse(localStorage.getItem(NAV_KEY) || "{}"); } catch { return {}; }
}
function writeNav(selectedId, activeView) {
  localStorage.setItem(NAV_KEY, JSON.stringify({ selectedId, activeView }));
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [views, setViews] = useState([]);
  const [selectedId, setSelectedId] = useState(() => readNav().selectedId ?? null);
  const [activeView, setActiveView] = useState(() => readNav().activeView ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function loadProjects(selectFirst = false) {
    try {
      const data = await api.listProjects();
      setProjects(data);
      // If the saved project no longer exists, fall back to first.
      const nav = readNav();
      const savedStillValid = nav.selectedId != null && data.some((p) => p.id === nav.selectedId);
      if (nav.selectedId != null && !savedStillValid) {
        setSelectedId(data[0]?.id ?? null);
      } else if (selectFirst && nav.selectedId == null && nav.activeView == null) {
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
    writeNav(id, null);
  }

  function handleOpenView(view) {
    setActiveView(view);
    setSelectedId(null);
    setSidebarOpen(false);
    writeNav(null, view);
  }

  function handleOpenCalendar() {
    const view = { type: "calendar" };
    setActiveView(view);
    setSelectedId(null);
    setSidebarOpen(false);
    writeNav(null, view);
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
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="shrink-0 text-text-secondary transition-colors duration-150 hover:text-text-primary md:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Ember brand — always */}
          <div className="flex flex-1 items-center gap-2">
            <EmberFlame size={17} className="shrink-0 text-accent" />
            <span className="text-[20px] font-semibold text-text-primary">Ember</span>
          </div>

          {/* Theme toggle */}
          <ThemeToggle />
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
