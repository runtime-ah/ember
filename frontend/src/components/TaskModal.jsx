import { useEffect, useState } from "react";
import { X, ChevronRight, Flag, Calendar, Bell, Tag, Clock, Folder, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { PRIORITIES } from "../lib/priority";
import LabelPicker from "./LabelPicker";
import TimePicker from "./TimePicker";
import AddTask from "./AddTask";

function fmtDateTime(date, time) {
  if (!date) return null;
  const d = new Date(date + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  let label;
  if (diff === 0) label = "Today";
  else if (diff === 1) label = "Tomorrow";
  else label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (time) {
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    label += ` ${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
  }
  return label;
}

function PropRow({ icon: Icon, label, summary, open, onToggle, children }) {
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded px-1 py-2.5 text-left transition-colors duration-150 hover:bg-elevated/40"
      >
        <Icon size={14} className="shrink-0 text-text-muted" />
        <span className="flex-1 text-[13px] font-medium text-text-secondary">{label}</span>
        {summary ? (
          <span className="text-[12px] text-text-primary">{summary}</span>
        ) : (
          <Plus size={12} className="text-text-muted" />
        )}
      </button>
      {open && <div className="pb-3 pl-6">{children}</div>}
    </div>
  );
}

export default function TaskModal({ task, subtasks: initialSubtasks = [], projectId, onDone, onChanged }) {
  const [content, setContent] = useState(task.content);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [dueTime, setDueTime] = useState(task.due_time ? task.due_time.slice(0, 5) : null);
  const [labels, setLabels] = useState(task.labels ?? []);
  const [effort, setEffort] = useState(task.effort != null ? String(task.effort) : "");
  const [recurrenceRule, setRecurrenceRule] = useState(task.recurrence_rule ?? "");
  const [taskReminders, setTaskReminders] = useState([]);
  const [addingReminder, setAddingReminder] = useState(false);
  const [newReminderDate, setNewReminderDate] = useState("");
  const [newReminderTime, setNewReminderTime] = useState(null);
  const [moveProjectId, setMoveProjectId] = useState(task.project_id);
  const [moveSectionId, setMoveSectionId] = useState(task.section_id ?? "");
  const [allProjects, setAllProjects] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [addingSub, setAddingSub] = useState(false);
  const [localSubtasks, setLocalSubtasks] = useState(initialSubtasks);

  useEffect(() => {
    api.listProjects().then(setAllProjects);
    api.listSections(task.project_id).then(setAllSections);
    api.listReminders({ task_id: task.id, include_past: true }).then(setTaskReminders).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleField(name) {
    setActiveField((f) => (f === name ? null : name));
  }

  function handleMoveProject(e) {
    const id = Number(e.target.value);
    setMoveProjectId(id);
    setMoveSectionId("");
    api.listSections(id).then(setAllSections);
  }

  async function save() {
    const trimmed = content.trim();
    if (trimmed) {
      await api.updateTask(task.id, {
        content: trimmed,
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        due_time: dueTime || null,
        effort: effort ? parseFloat(effort) : null,
        recurrence_rule: recurrenceRule || null,
        label_ids: labels.map((l) => l.id),
        project_id: moveProjectId,
        section_id: moveSectionId || null,
      });
      onChanged();
    }
    onDone();
  }

  async function addReminder() {
    if (!newReminderDate) return;
    const fire_time = `${newReminderDate}T${newReminderTime ?? "09:00"}:00`;
    await api.createReminder({ task_id: task.id, message: content.trim() || task.content, fire_time });
    const updated = await api.listReminders({ task_id: task.id, include_past: true });
    setTaskReminders(updated);
    setAddingReminder(false);
    setNewReminderDate("");
    setNewReminderTime(null);
  }

  async function deleteReminder(id) {
    await api.deleteReminder(id);
    setTaskReminders((prev) => prev.filter((r) => r.id !== id));
  }

  async function refreshSubtasks() {
    const tasks = await api.listTasks({ project_id: projectId });
    setLocalSubtasks(tasks.filter((t) => t.parent_id === task.id));
    onChanged();
  }

  async function toggleSubtask(st) {
    if (st.completed) await api.uncompleteTask(st.id);
    else await api.completeTask(st.id);
    await refreshSubtasks();
  }

  const currentProject = allProjects.find((p) => p.id === moveProjectId);
  const currentSection = allSections.find((s) => s.id === Number(moveSectionId));

  const properties = (
    <div className="px-1">
      <PropRow
        icon={Folder}
        label="Project"
        summary={
          currentProject
            ? `${currentProject.name}${currentSection ? ` › ${currentSection.name}` : ""}`
            : null
        }
        open={activeField === "project"}
        onToggle={() => toggleField("project")}
      >
        <div className="flex flex-col gap-1.5">
          <select
            value={moveProjectId}
            onChange={handleMoveProject}
            className="w-full rounded bg-elevated px-2 py-1.5 text-xs text-text-secondary focus:outline-none"
          >
            {allProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={moveSectionId}
            onChange={(e) => setMoveSectionId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded bg-elevated px-2 py-1.5 text-xs text-text-secondary focus:outline-none"
          >
            <option value="">No section</option>
            {allSections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </PropRow>

      <PropRow
        icon={Calendar}
        label="Due date"
        summary={fmtDateTime(dueDate, dueTime)}
        open={activeField === "due"}
        onToggle={() => toggleField("due")}
      >
        <div className="flex flex-col gap-1.5">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded bg-elevated px-2 py-1.5 text-xs text-text-secondary focus:outline-none"
          />
          <TimePicker value={dueTime} onChange={setDueTime} />
          {dueDate && (
            <button
              type="button"
              onClick={() => { setDueDate(""); setDueTime(null); }}
              className="text-left text-xs text-text-muted transition-colors hover:text-danger"
            >
              Clear date
            </button>
          )}
        </div>
      </PropRow>

      <PropRow
        icon={Flag}
        label="Priority"
        summary={priority < 4 ? `P${priority}` : null}
        open={activeField === "priority"}
        onToggle={() => toggleField("priority")}
      >
        <div className="flex gap-1.5">
          {PRIORITIES.slice(0, 3).map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => { setPriority(p.value); setActiveField(null); }}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                priority === p.value ? "ring-1 ring-inset" : "bg-elevated"
              }`}
              style={
                priority === p.value
                  ? { color: p.color, backgroundColor: p.color + "20", ringColor: p.color }
                  : { color: p.color }
              }
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setPriority(4); setActiveField(null); }}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              priority === 4
                ? "bg-elevated text-text-primary ring-1 ring-inset ring-border"
                : "bg-elevated text-text-muted"
            }`}
          >
            None
          </button>
        </div>
      </PropRow>

      <PropRow
        icon={Tag}
        label="Labels"
        summary={labels.length > 0 ? labels.map((l) => `#${l.name}`).join(", ") : null}
        open={activeField === "labels"}
        onToggle={() => toggleField("labels")}
      >
        <LabelPicker selected={labels} onChange={setLabels} />
      </PropRow>

      <PropRow
        icon={Bell}
        label="Reminders"
        summary={taskReminders.length > 0 ? `${taskReminders.length} set` : null}
        open={activeField === "reminder"}
        onToggle={() => toggleField("reminder")}
      >
        <div className="flex flex-col gap-1.5">
          {taskReminders.map((rem) => (
            <div key={rem.id} className="flex items-center gap-2 rounded bg-elevated px-2 py-1.5">
              <Bell size={11} className="shrink-0 text-text-muted" />
              <span className="flex-1 text-[11px] text-text-secondary">
                {fmtDateTime(rem.fire_time.slice(0, 10), rem.fire_time.slice(11, 16))}
              </span>
              <button
                type="button"
                onClick={() => deleteReminder(rem.id)}
                className="text-text-muted transition-colors hover:text-danger"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {addingReminder ? (
            <div className="flex flex-col gap-1.5 rounded border border-border p-2">
              <input
                type="date"
                value={newReminderDate}
                onChange={(e) => setNewReminderDate(e.target.value)}
                className="w-full rounded bg-elevated px-2 py-1.5 text-xs text-text-secondary focus:outline-none"
              />
              {newReminderDate && <TimePicker value={newReminderTime} onChange={setNewReminderTime} />}
              <div className="flex gap-2">
                <button type="button" onClick={addReminder} className="rounded bg-accent px-2 py-1 text-[11px] text-white hover:bg-accent-hover">
                  Add
                </button>
                <button type="button" onClick={() => { setAddingReminder(false); setNewReminderDate(""); setNewReminderTime(null); }} className="text-[11px] text-text-muted hover:text-text-primary">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingReminder(true)}
              className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-text-secondary"
            >
              <Plus size={11} /> Add reminder
            </button>
          )}
        </div>
      </PropRow>

      <PropRow
        icon={Clock}
        label="Effort & repeat"
        summary={effort ? `${effort}h` : recurrenceRule || null}
        open={activeField === "more"}
        onToggle={() => toggleField("more")}
      >
        <div className="flex flex-col gap-1.5">
          <input
            type="number"
            min="0.25"
            max="24"
            step="0.25"
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            placeholder="Effort (hours)"
            className="w-full rounded bg-elevated px-2 py-1.5 text-xs text-text-secondary placeholder:text-text-muted focus:outline-none"
          />
          <select
            value={recurrenceRule}
            onChange={(e) => setRecurrenceRule(e.target.value)}
            className="w-full rounded bg-elevated px-2 py-1.5 text-xs text-text-secondary focus:outline-none"
          >
            <option value="">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </PropRow>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onDone} />

      {/* Panel */}
      <div className="relative z-10 flex w-full max-h-[85vh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl md:h-[580px] md:w-[760px] md:rounded-xl">

        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-1 text-[13px] text-text-muted">
            <Folder size={13} className="shrink-0" />
            <span>{currentProject?.name ?? "…"}</span>
            {currentSection && (
              <>
                <ChevronRight size={11} />
                <span>{currentSection.name}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onDone}
            className="ml-auto rounded p-1 text-text-muted transition-colors hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body: single column on mobile, two-column on desktop */}
        <div className="min-h-0 flex-1 overflow-y-auto md:flex md:overflow-hidden">

          {/* Main content */}
          <div className="px-5 py-4 md:flex-1 md:overflow-y-auto">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Task name"
              className="mb-2 w-full bg-transparent text-[18px] font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-text-secondary placeholder:text-text-muted focus:outline-none"
            />

            {/* Subtasks */}
            <div className="mt-4 border-t border-border/50 pt-3">
              {localSubtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleSubtask(st)}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-150"
                    style={{
                      borderColor: "var(--color-text-muted)",
                      backgroundColor: st.completed ? "var(--color-accent)" : "transparent",
                    }}
                  >
                    {st.completed && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-6"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`text-sm ${
                      st.completed ? "text-text-muted line-through" : "text-text-primary"
                    }`}
                  >
                    {st.content}
                  </span>
                </div>
              ))}
              {addingSub ? (
                <AddTask
                  projectId={projectId}
                  sectionId={task.section_id}
                  parentId={task.id}
                  placeholder="Sub-task name"
                  onAdded={async () => {
                    await refreshSubtasks();
                    setAddingSub(false);
                  }}
                  onClose={() => setAddingSub(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingSub(true)}
                  className="mt-1 flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-secondary"
                >
                  <Plus size={14} /> Add sub-task
                </button>
              )}
            </div>

            {/* Properties — visible only on mobile (below subtasks) */}
            <div className="mt-5 border-t border-border/50 pt-3 md:hidden">
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Properties
              </p>
              {properties}
            </div>
          </div>

          {/* Sidebar — desktop only */}
          <div className="hidden w-56 shrink-0 overflow-y-auto border-l border-border px-3 py-4 md:block">
            {properties}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onDone}
            className="rounded px-4 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
