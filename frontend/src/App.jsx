import { useEffect, useState } from "react";
import { api } from "./api";
import { useIsMobile } from "./lib/useIsMobile";
import Sidebar from "./components/Sidebar";
import TaskView from "./components/TaskView";
import CalendarView from "./components/CalendarView";
import MobileCapture from "./components/MobileCapture";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
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
      // If the selected project was deleted, fall back to the first one.
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

  if (isMobile) {
    if (loading) return <p className="p-8 text-text-muted">Loading…</p>;
    if (error) return <p className="p-6 text-danger">{error}</p>;
    return <MobileCapture projects={projects} />;
  }

  return (
    <div className="flex h-full">
      <Sidebar
        projects={projects}
        selectedId={showCalendar ? null : selectedId}
        onSelect={(id) => {
          setShowCalendar(false);
          setSelectedId(id);
        }}
        onProjectsChanged={loadProjects}
        calendarActive={showCalendar}
        onOpenCalendar={() => setShowCalendar(true)}
      />
      <main className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-4 rounded border border-danger/40 p-3 text-danger">
            {error}
          </div>
        )}
        {loading ? (
          <p className="p-8 text-text-muted">Loading…</p>
        ) : showCalendar ? (
          <CalendarView />
        ) : selected ? (
          <TaskView key={selected.id} project={selected} />
        ) : (
          <p className="p-8 text-text-muted">
            No projects yet — create one in the sidebar.
          </p>
        )}
      </main>
    </div>
  );
}
