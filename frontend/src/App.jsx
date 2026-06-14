import { useEffect, useState } from "react";
import { api } from "./api";
import { useIsMobile } from "./lib/useIsMobile";
import Sidebar from "./components/Sidebar";
import TaskView from "./components/TaskView";
import CalendarView from "./components/CalendarView";
import FilteredTaskView from "./components/FilteredTaskView";
import MobileCapture from "./components/MobileCapture";

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
  const isMobile = useIsMobile();

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
  }

  function handleOpenView(view) {
    setActiveView(view);
    setSelectedId(null);
  }

  function handleOpenCalendar() {
    setActiveView({ type: "calendar" });
    setSelectedId(null);
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

  if (isMobile) {
    if (loading) return <p className="p-8 text-text-muted">Loading…</p>;
    if (error) return <p className="p-6 text-danger">{error}</p>;
    return <MobileCapture projects={projects} />;
  }

  return (
    <div className="flex h-full">
      <Sidebar
        projects={projects}
        selectedId={activeView ? null : selectedId}
        onSelect={handleSelectProject}
        onProjectsChanged={loadProjects}
        calendarActive={activeView?.type === "calendar"}
        onOpenCalendar={handleOpenCalendar}
        activeView={activeView?.type !== "calendar" ? activeView : null}
        onOpenView={handleOpenView}
      />
      <main className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-4 rounded border border-danger/40 p-3 text-danger">{error}</div>
        )}
        {loading ? <p className="p-8 text-text-muted">Loading…</p> : renderMain()}
      </main>
    </div>
  );
}
