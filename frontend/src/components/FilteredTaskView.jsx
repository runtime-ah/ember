import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import TaskList from "./TaskList";

// Renders a cross-project filtered task list (Today, Upcoming, by-label, custom view).
// Groups tasks by project name for context.
export default function FilteredTaskView({ title, params, emptyMessage }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        api.listTasks({ ...params, completed: false }),
        api.listProjects(),
      ]);
      setTasks(t);
      setProjects(p);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="p-8 text-text-muted">Loading…</p>;

  // Build subtask map and top-level list.
  const subtasksByParent = {};
  for (const t of tasks) {
    if (t.parent_id != null) (subtasksByParent[t.parent_id] ??= []).push(t);
  }
  const topLevel = tasks.filter((t) => t.parent_id == null);

  // Group top-level tasks by project.
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const groups = {};
  for (const t of topLevel) {
    (groups[t.project_id] ??= []).push(t);
  }
  const groupEntries = Object.entries(groups).sort(([a], [b]) => {
    const pa = projectMap[a]?.order ?? 0;
    const pb = projectMap[b]?.order ?? 0;
    return pa - pb;
  });

  return (
    <div className="mx-auto max-w-[720px] px-4 py-5 md:px-6 md:py-7">
      <h2 className="mb-5 text-[18px] font-semibold text-text-primary">{title}</h2>
      {topLevel.length === 0 ? (
        <p className="text-sm text-text-muted">{emptyMessage ?? "Nothing here."}</p>
      ) : (
        groupEntries.map(([projectId, groupTasks]) => {
          const project = projectMap[Number(projectId)];
          return (
            <div key={projectId} className="mb-5">
              {groupEntries.length > 1 && project && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {project.name}
                </p>
              )}
              <TaskList
                tasks={groupTasks}
                subtasksByParent={subtasksByParent}
                visible={() => true}
                projectId={Number(projectId)}
                onChanged={load}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
