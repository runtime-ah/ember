import { useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import { api } from "../api";
import { PRIORITIES } from "../lib/priority";
import { parseTaskInput } from "../lib/nlParser";
import { useClickOutside } from "../lib/useClickOutside";
import LabelPicker from "./LabelPicker";
import TimePicker from "./TimePicker";

export default function AddTask({
  projectId,
  sectionId = null,
  parentId = null,
  onAdded,
  onClose,
  placeholder = "Task name",
  initialLabels = [],
}) {
  const [raw, setRaw] = useState("");

  // Manual overrides — when the user explicitly sets a field via the controls,
  // it takes precedence over the NL-parsed value.
  const [manualPriority, setManualPriority] = useState(null);
  const [manualDueDate, setManualDueDate] = useState("");
  const [manualDueTime, setManualDueTime] = useState(null);
  // Labels added via the LabelPicker (manual). NL-detected labels are separate.
  const [manualLabels, setManualLabels] = useState(initialLabels);

  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState(null);
  const [effort, setEffort] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState("");

  // Live NL parse — cheap pure function, safe to call on every keystroke.
  const parsed = useMemo(() => parseTaskInput(raw), [raw]);

  const effectivePriority = manualPriority ?? parsed.priority ?? 4;
  const effectiveDueDate = manualDueDate || parsed.dueDate || "";
  const effectiveDueTime = manualDueTime !== null ? manualDueTime : (parsed.dueTime ?? null);

  // Build reminder_time ISO string from the two reminder fields.
  function buildReminderTime() {
    if (!reminderDate) return null;
    const t = reminderTime ?? "09:00";
    return `${reminderDate}T${t}:00`;
  }

  async function resolveNlLabels() {
    if (parsed.labels.length === 0) return [];
    const all = await api.listLabels();
    const ids = [];
    for (const name of parsed.labels) {
      const existing = all.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        ids.push(existing.id);
      } else {
        try {
          const created = await api.createLabel({ name, color: "#999999" });
          ids.push(created.id);
        } catch {
          const refetch = await api.listLabels();
          const found = refetch.find((l) => l.name.toLowerCase() === name.toLowerCase());
          if (found) ids.push(found.id);
        }
      }
    }
    return ids;
  }

  async function create() {
    const content = parsed.content || raw.trim();
    if (!content) return false;

    const nlLabelIds = await resolveNlLabels();
    const manualLabelIds = manualLabels.map((l) => l.id);
    // Merge, deduplicate
    const labelIds = [...new Set([...nlLabelIds, ...manualLabelIds])];

    await api.createTask({
      project_id: projectId,
      section_id: sectionId,
      parent_id: parentId,
      content,
      priority: effectivePriority,
      due_date: effectiveDueDate || null,
      due_time: effectiveDueTime || null,
      reminder_time: buildReminderTime(),
      effort: effort ? parseFloat(effort) : null,
      recurrence_rule: recurrenceRule || null,
      label_ids: labelIds,
    });
    onAdded();
    return true;
  }

  async function submit(e) {
    e.preventDefault();
    if (await create()) {
      setRaw("");
      setManualPriority(null);
      setManualDueDate("");
      setManualDueTime(null);
      setManualLabels([]);
      setReminderDate("");
      setReminderTime(null);
      setEffort("");
      setRecurrenceRule("");
    }
  }

  const ref = useClickOutside(async () => {
    await create();
    onClose?.();
  });

  const nlChips = [
    ...parsed.labels.map((name) => ({ key: `lbl-${name}`, label: `#${name}`, onDismiss: null })),
    ...(parsed.dueDate && !manualDueDate
      ? [{ key: "date", label: fmtDate(parsed.dueDate), onDismiss: () => setManualDueDate("\0") }]
      : []),
    ...(parsed.dueTime && !manualDueTime
      ? [{ key: "time", label: fmtTime(parsed.dueTime), onDismiss: () => setManualDueTime("") }]
      : []),
    ...(parsed.priority && !manualPriority
      ? [{ key: "pri", label: `P${parsed.priority}`, onDismiss: () => setManualPriority(4) }]
      : []),
    ...(parsed.effort
      ? [{ key: "effort", label: `~${fmtEffort(parsed.effort)}`, onDismiss: null }]
      : []),
    ...(parsed.recurrenceRule
      ? [{ key: "recur", label: parsed.recurrenceRule, onDismiss: null }]
      : []),
  ];

  return (
    <form
      ref={ref}
      onSubmit={submit}
      className="animate-pop mt-1.5 rounded-lg border border-border bg-surface p-3 shadow-pop"
    >
      {/* Task name — NL tokens are parsed from this */}
      <input
        autoFocus
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose?.()}
        placeholder={placeholder}
        className="mb-2 w-full bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
      />

      {/* NL-detected chips */}
      {nlChips.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {nlChips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[11px] text-text-secondary"
            >
              {c.label}
              {c.onDismiss && (
                <button
                  type="button"
                  onClick={c.onDismiss}
                  className="opacity-50 hover:opacity-100 hover:text-danger"
                >
                  <X size={9} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Row 1: Priority · Due date · Due time · Effort */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={effectivePriority}
          onChange={(e) => setManualPriority(Number(e.target.value))}
          className="rounded bg-elevated px-2 py-1 text-xs text-text-secondary focus:outline-none"
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={effectiveDueDate === "\0" ? "" : effectiveDueDate}
          onChange={(e) => setManualDueDate(e.target.value)}
          className="rounded bg-elevated px-2 py-1 text-xs text-text-secondary focus:outline-none"
        />

        <TimePicker value={effectiveDueTime} onChange={setManualDueTime} />

        <input
          type="number"
          min="0.25"
          max="24"
          step="0.25"
          value={effort}
          onChange={(e) => setEffort(e.target.value)}
          placeholder="Effort (h)"
          className="w-24 rounded bg-elevated px-2 py-1 text-xs text-text-secondary placeholder:text-text-muted focus:outline-none"
        />

        <select
          value={recurrenceRule}
          onChange={(e) => setRecurrenceRule(e.target.value)}
          className="rounded bg-elevated px-2 py-1 text-xs text-text-secondary focus:outline-none"
        >
          <option value="">No repeat</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Row 2: Labels */}
      <div className="mt-2">
        <LabelPicker selected={manualLabels} onChange={setManualLabels} />
      </div>

      {/* Row 3: Reminder */}
      <div className="mt-2 flex items-center gap-2">
        <Bell size={12} className="shrink-0 text-text-muted" />
        <input
          type="date"
          value={reminderDate}
          onChange={(e) => setReminderDate(e.target.value)}
          placeholder="Reminder date"
          className="rounded bg-elevated px-2 py-1 text-xs text-text-secondary focus:outline-none"
        />
        {reminderDate && (
          <TimePicker
            value={reminderTime}
            onChange={setReminderTime}
            placeholder="9:00 AM"
          />
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded px-3 py-1 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded bg-accent px-3 py-1 text-xs text-white transition-colors duration-150 hover:bg-accent-hover"
        >
          Add
        </button>
      </div>
    </form>
  );
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}

function fmtEffort(h) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h === Math.floor(h)) return `${h}h`;
  return `${h}h`;
}
