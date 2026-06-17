import { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { api } from "./api";
import Sidebar from "./components/Sidebar";
import TaskView from "./components/TaskView";
import CalendarView from "./components/CalendarView";
import FilteredTaskView from "./components/FilteredTaskView";
import ListDetail from "./components/ListDetail";
import RemindersView from "./components/RemindersView";
import EmberFlame from "./components/EmberFlame";
import ThemeToggle from "./components/ThemeToggle";
import SearchPalette from "./components/SearchPalette";

const NAV_KEY = "ember-nav";
function readNav() {
  try { return JSON.parse(localStorage.getItem(NAV_KEY) || "{}"); } catch { return {}; }
}
function writeNav(selectedId, activeView) {
  localStorage.setItem(NAV_KEY, JSON.stringify({ selectedId, activeView }));
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [lists, setLists] = useState([]);
  const [views, setViews] = useState([]);
  const [upcomingReminderCount, setUpcomingReminderCount] = useState(0);
  const [selectedId, setSelectedId] = useState(() => readNav().selectedId ?? null);
  const [activeView, setActiveView] = useState(() => readNav().activeView ?? null);
  const [activeList, setActiveList] = useState(null); // full list object with items
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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

  async function loadLists() {
    try {
      const data = await api.listLists();
      setLists(data);
      // Keep activeList in sync if one is open
      setActiveList((prev) => {
        if (!prev) return prev;
        return data.find((l) => l.id === prev.id) ?? prev;
      });
    } catch {
      // non-fatal
    }
  }

  async function loadReminders() {
    try {
      const data = await api.listReminders();
      setUpcomingReminderCount(data.length);
    } catch {
      // non-fatal
    }
  }

  async function openList(nav) {
    try {
      const lst = await api.getList(nav.id);
      setActiveList(lst);
      setActiveView({ type: "list", id: nav.id, name: nav.name });
      setSelectedId(null);
      setSidebarOpen(false);
      writeNav(null, { type: "list", id: nav.id, name: nav.name });
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    loadProjects(true);
    loadViews();
    loadLists();
    loadReminders();
    // Restore list view if that's what was saved
    const savedNav = readNav();
    if (savedNav.activeView?.type === "list") {
      openList(savedNav.activeView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  function handleSelectProject(id) {
    setActiveView(null);
    setActiveList(null);
    setSelectedId(id);
    setSidebarOpen(false);
    writeNav(id, null);
  }

  function handleOpenView(view) {
    setActiveView(view);
    setActiveList(null);
    setSelectedId(null);
    setSidebarOpen(false);
    writeNav(null, view);
  }

  function handleOpenCalendar() {
    const view = { type: "calendar" };
    setActiveView(view);
    setSelectedId(null);
    setActiveList(null);
    setSidebarOpen(false);
    writeNav(null, view);
  }

  function handleOpenReminders() {
    const view = { type: "reminders" };
    setActiveView(view);
    setSelectedId(null);
    setActiveList(null);
    setSidebarOpen(false);
    writeNav(null, view);
  }

  function renderMain() {
    if (!activeView && selected) return <TaskView key={selected.id} project={selected} />;
    if (!activeView) return <p className="p-8 text-text-muted">No projects yet — create one in the sidebar.</p>;

    if (activeView.type === "calendar") return <CalendarView />;

    if (activeView.type === "reminders") return <RemindersView onChanged={loadReminders} />;

    if (activeView.type === "list" && activeList) {
      const leaveList = () => {
        setActiveView(null);
        setActiveList(null);
        setSelectedId(projects[0]?.id ?? null);
        writeNav(projects[0]?.id ?? null, null);
        loadLists();
      };
      return (
        <ListDetail
          key={activeList.id}
          list={activeList}
          onChanged={() => loadLists()}
          onArchive={async () => {
            await api.archiveList(activeList.id);
            leaveList();
          }}
          onDelete={async () => {
            await api.deleteList(activeList.id);
            leaveList();
          }}
        />
      );
    }

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
        lists={lists}
        views={views}
        selectedId={activeView ? null : selectedId}
        onSelect={handleSelectProject}
        onProjectsChanged={loadProjects}
        onListsChanged={loadLists}
        onViewsChanged={loadViews}
        calendarActive={activeView?.type === "calendar"}
        onOpenCalendar={handleOpenCalendar}
        remindersActive={activeView?.type === "reminders"}
        onOpenReminders={handleOpenReminders}
        upcomingReminderCount={upcomingReminderCount}
        activeView={activeView?.type !== "calendar" && activeView?.type !== "reminders" ? activeView : null}
        onOpenView={handleOpenView}
        onOpenList={openList}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {searchOpen && (
        <SearchPalette
          projects={projects}
          onClose={() => setSearchOpen(false)}
          onNavigate={(id) => {
            setSelectedId(id);
            setActiveView(null);
            setSidebarOpen(false);
            setSearchOpen(false);
            writeNav(id, null);
          }}
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

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="shrink-0 text-text-secondary transition-colors duration-150 hover:text-text-primary"
            aria-label="Search tasks"
            title="Search (⌘K)"
          >
            <Search size={17} />
          </button>

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
