import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { api } from "./api";
import Sidebar from "./components/Sidebar";
import TaskView from "./components/TaskView";
import CalendarView from "./components/CalendarView";
import FilteredTaskView from "./components/FilteredTaskView";

// activeView is null (project selected) or { type: 'today' | 'upcoming' | 'calendar' | 'label', id?: number }

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function futureDateIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [projects, setProjects] = useState([]);
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

  useEffect(() => {
    loadProjects(true);
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
    if (activeView.type === "today") return "Today";
    if (activeView.type === "upcoming") return "Upcoming";
    if (activeView.type === "calendar") return "Calendar";
    if (activeView.type === "label") return `#${activeView.name ?? "label"}`;
    return "Todo";
  }

  function renderMain() {
    if (!activeView && selected) return <TaskView key={selected.id} project={selected} />;
    if (!activeView) return <p className="p-8 text-text-muted">No projects yet — create one in the sidebar.</p>;

    if (activeView.type === "calendar") return <CalendarView />;

    if (activeView.type === "today") {
      const today = todayIso();
      return (
        <FilteredTaskView
          title="Today"
          params={{ due_before: today }}
          emptyMessage="Nothing due today."
        />
      );
    }

    if (activeView.type === "upcoming") {
      const tomorrow = futureDateIso(1);
      const weekOut = futureDateIso(7);
      return (
        <FilteredTaskView
          title="Upcoming"
          params={{ due_after: tomorrow, due_before: weekOut }}
          emptyMessage="Nothing coming up in the next 7 days."
        />
      );
    }

    if (activeView.type === "label") {
      return (
        <FilteredTaskView
          key={activeView.id}
          title={`#${activeView.name ?? "label"}`}
          params={{ label_id: activeView.id }}
          emptyMessage="No tasks with this label."
        />
      );
    }

    return null;
  }

  return (
    <div className="flex h-full">
      {/* Sidebar — overlay drawer on mobile, fixed column on desktop */}
      <Sidebar
        projects={projects}
        selectedId={activeView ? null : selectedId}
        onSelect={handleSelectProject}
        onProjectsChanged={loadProjects}
        calendarActive={activeView?.type === "calendar"}
        onOpenCalendar={handleOpenCalendar}
        activeView={activeView?.type !== "calendar" ? activeView : null}
        onOpenView={handleOpenView}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Backdrop — tapping it closes the drawer on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar */}
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
