import { useState } from "react";
import { Trash2, Bell, Plus, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { api } from "../api";
import { priorityColor, formatDue } from "../lib/priority";
import { isTaskExpanded, setTaskExpanded } from "../lib/expandedTasks";
import AddTask from "./AddTask";
import TaskModal from "./TaskModal";

const RECURRENCE_LABELS = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

function fmtEffort(h) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h === Math.floor(h)) return `${h}h`;
  return `${h}h`;
}

export default function TaskItem({ task, subtasks = [], projectId, onChanged }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [expanded, setExpanded] = useState(() => isTaskExpanded(task.id));
  const hasSubtasks = subtasks.length > 0;
  const isTopLevel = task.parent_id == null;

  function setExpandedPersist(value) {
    setExpanded(value);
    setTaskExpanded(task.id, value);
  }

  async function toggle() {
    if (task.completed) await api.uncompleteTask(task.id);
    else await api.completeTask(task.id);
    onChanged();
  }

  async function remove() {
    await api.deleteTask(task.id);
    onChanged();
  }

  const due = formatDue(task.due_date, task.due_time);
  const dotColor = priorityColor(task.priority);

  return (
    <div>
      <div className="group flex items-start gap-2 border-b border-border/70 px-2 py-3 md:py-1.5 transition-colors duration-150 hover:bg-elevated/40">
        {isTopLevel &&
          (hasSubtasks ? (
            <button
              onClick={() => setExpandedPersist(!expanded)}
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-text-muted transition-colors duration-150 hover:text-text-primary"
              title={expanded ? "Collapse subtasks" : "Expand subtasks"}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="h-4 w-4 shrink-0" aria-hidden="true" />
          ))}

        <button
          onClick={toggle}
          className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150 hover:scale-110"
          style={{
            borderColor: dotColor ?? "var(--color-text-muted)",
            backgroundColor: task.completed ? "var(--color-accent)" : "transparent",
          }}
          title={task.completed ? "Mark incomplete" : "Mark complete"}
        >
          {task.completed && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setModalOpen(true)}>
          <div className="flex items-center gap-2">
            <span className={task.completed ? "text-text-muted line-through" : "text-text-primary"}>
              {task.content}
            </span>
            {dotColor && !task.completed && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: dotColor }}
                title={`P${task.priority}`}
              />
            )}
            {task.recurrence_rule && !task.completed && (
              <RefreshCw size={11} className="shrink-0 text-text-muted" title={RECURRENCE_LABELS[task.recurrence_rule]} />
            )}
            {hasSubtasks && !expanded && (
              <span className="nums shrink-0 rounded-full bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                {subtasks.length}
              </span>
            )}
          </div>

          {task.description && (
            <p className="truncate text-xs text-text-secondary">{task.description}</p>
          )}

          {/* Metadata row: due date · reminder · effort · labels */}
          {(due || (task.reminder_time && !task.completed) || task.effort || task.labels?.length > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {due && (
                <span
                  className={`nums inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                    due.overdue && !task.completed
                      ? "bg-danger/12 text-danger"
                      : "bg-elevated text-text-secondary"
                  }`}
                >
                  {due.label}
                </span>
              )}
              {task.reminder_time && !task.completed && (
                <span
                  className="inline-flex items-center rounded-md bg-elevated px-1.5 py-0.5 text-text-secondary"
                  title={`Reminder: ${new Date(task.reminder_time).toLocaleString()}`}
                >
                  <Bell size={11} />
                </span>
              )}
              {task.effort && !task.completed && (
                <span className="nums inline-flex items-center rounded-md bg-elevated px-1.5 py-0.5 text-[11px] text-text-muted">
                  ~{fmtEffort(task.effort)}
                </span>
              )}
              {task.labels?.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: l.color + "28", color: l.color }}
                >
                  #{l.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-1 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100">
          {isTopLevel && (
            <button
              onClick={() => { setExpandedPersist(true); setAddingSub(true); }}
              className="p-1 text-text-muted hover:text-text-primary"
              title="Add subtask"
            >
              <Plus size={15} />
            </button>
          )}
          <button onClick={remove} className="p-1 text-text-muted hover:text-danger" title="Delete task">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {(expanded || addingSub) && (
        <div className="ml-[19px] border-l border-border/70 pl-3">
          {subtasks.map((st) => (
            <TaskItem key={st.id} task={st} projectId={projectId} onChanged={onChanged} />
          ))}
          {addingSub && (
            <AddTask
              projectId={projectId}
              sectionId={task.section_id}
              parentId={task.id}
              placeholder="Subtask name"
              onAdded={onChanged}
              onClose={() => setAddingSub(false)}
            />
          )}
        </div>
      )}

      {/* Detail modal */}
      {modalOpen && (
        <TaskModal
          task={task}
          subtasks={subtasks}
          projectId={projectId}
          onDone={() => setModalOpen(false)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

