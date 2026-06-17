import { useEffect, useState } from "react";
import { Bell, BellOff, Plus, Trash2, X } from "lucide-react";
import { api } from "../api";
import TimePicker from "./TimePicker";
import { currentSubscription, getPermission, isPushSupported, subscribeToPush, unsubscribeFromPush } from "../lib/push";

function fmtFireTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(iso.slice(0, 10) + "T00:00:00") - today) / 86400000);
  let datePart;
  if (diff === 0) datePart = "Today";
  else if (diff === 1) datePart = "Tomorrow";
  else if (diff === -1) datePart = "Yesterday";
  else datePart = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const h = d.getHours(), m = d.getMinutes();
  const timePart = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  return `${datePart} · ${timePart}`;
}

function ReminderRow({ reminder, onDelete, onEdit }) {
  const isPast = !reminder.recurrence_rule && reminder.sent;
  return (
    <div className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-elevated/60 ${isPast ? "opacity-50" : ""}`}>
      <Bell size={14} className="mt-0.5 shrink-0 text-text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{reminder.message}</p>
        <p className="text-[12px] text-text-muted">
          {fmtFireTime(reminder.fire_time)}
          {reminder.recurrence_rule && (
            <span className="ml-2 rounded-full bg-elevated px-1.5 py-0.5 text-[11px] capitalize text-text-muted">
              {reminder.recurrence_rule}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onEdit(reminder)}
          className="rounded p-1 text-text-muted transition-colors hover:text-text-primary"
          title="Edit"
        >
          <Plus size={13} className="rotate-45" />
        </button>
        <button
          onClick={() => onDelete(reminder.id)}
          className="rounded p-1 text-text-muted transition-colors hover:text-danger"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function AddEditForm({ initial, onSave, onCancel }) {
  const [message, setMessage] = useState(initial?.message ?? "");
  const [date, setDate] = useState(initial?.fire_time ? initial.fire_time.slice(0, 10) : "");
  const [time, setTime] = useState(initial?.fire_time ? initial.fire_time.slice(11, 16) : null);
  const [rule, setRule] = useState(initial?.recurrence_rule ?? "");

  function buildFireTime() {
    if (!date) return null;
    return `${date}T${time ?? "09:00"}:00`;
  }

  async function submit(e) {
    e.preventDefault();
    const fire_time = buildFireTime();
    if (!message.trim() || !fire_time) return;
    await onSave({ message: message.trim(), fire_time, recurrence_rule: rule || null });
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-3 shadow-pop">
      <input
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Reminder message"
        className="mb-2 w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded bg-elevated px-2 py-1 text-xs text-text-secondary focus:outline-none"
        />
        <TimePicker value={time} onChange={setTime} />
        <select
          value={rule}
          onChange={(e) => setRule(e.target.value)}
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
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded px-3 py-1 text-xs text-text-secondary hover:text-text-primary">
          Cancel
        </button>
        <button type="submit" className="rounded bg-accent px-3 py-1 text-xs text-white hover:bg-accent-hover">
          {initial ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}

function NotificationToggle() {
  const [status, setStatus] = useState("checking"); // checking | unsupported | disabled | default | granted | denied | subscribed

  useEffect(() => {
    if (!isPushSupported()) { setStatus("unsupported"); return; }
    currentSubscription().then((sub) => {
      if (sub) setStatus("subscribed");
      else setStatus(getPermission() === "denied" ? "denied" : "default");
    });
  }, []);

  async function toggle() {
    if (status === "subscribed") {
      await unsubscribeFromPush();
      setStatus("default");
    } else {
      const result = await subscribeToPush();
      setStatus(result.status === "subscribed" ? "subscribed" : result.status);
    }
  }

  if (status === "checking" || status === "unsupported") return null;

  const isOn = status === "subscribed";
  return (
    <button
      onClick={toggle}
      title={isOn ? "Notifications on — click to disable" : "Enable browser notifications"}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition-colors ${
        isOn
          ? "bg-accent/15 text-accent hover:bg-accent/25"
          : status === "denied"
          ? "bg-elevated text-text-muted cursor-not-allowed"
          : "bg-elevated text-text-secondary hover:bg-elevated/80"
      }`}
      disabled={status === "denied"}
    >
      {isOn ? <Bell size={12} /> : <BellOff size={12} />}
      {isOn ? "Notifications on" : status === "denied" ? "Blocked in browser" : "Enable notifications"}
    </button>
  );
}

export default function RemindersView({ onChanged }) {
  const [reminders, setReminders] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    try {
      const data = await api.listReminders({ include_past: true });
      setReminders(data);
    } catch { /* non-fatal */ }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(data) {
    await api.createReminder(data);
    setAdding(false);
    load();
    onChanged?.();
  }

  async function handleEdit(data) {
    await api.updateReminder(editing.id, data);
    setEditing(null);
    load();
    onChanged?.();
  }

  async function handleDelete(id) {
    await api.deleteReminder(id);
    load();
    onChanged?.();
  }

  const now = new Date();
  const upcoming = reminders.filter((r) => r.recurrence_rule || !r.sent || new Date(r.fire_time) > now);
  const past = reminders.filter((r) => !r.recurrence_rule && r.sent && new Date(r.fire_time) <= now);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Bell size={18} className="text-accent" />
        <h1 className="text-xl font-semibold text-text-primary">Reminders</h1>
        <div className="ml-auto">
          <NotificationToggle />
        </div>
      </div>

      {adding ? (
        <div className="mb-4">
          <AddEditForm onSave={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-text-muted transition-colors hover:border-border/80 hover:text-text-secondary"
        >
          <Plus size={14} />
          Add reminder
        </button>
      )}

      {upcoming.length === 0 && past.length === 0 && !adding && (
        <p className="py-8 text-center text-sm text-text-muted">No reminders yet.</p>
      )}

      {upcoming.length > 0 && (
        <section className="mb-6">
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Upcoming</p>
          <div className="rounded-lg border border-border bg-surface">
            {upcoming.map((rem) =>
              editing?.id === rem.id ? (
                <div key={rem.id} className="px-3 py-2">
                  <AddEditForm initial={editing} onSave={handleEdit} onCancel={() => setEditing(null)} />
                </div>
              ) : (
                <ReminderRow key={rem.id} reminder={rem} onDelete={handleDelete} onEdit={setEditing} />
              )
            )}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Past</p>
          <div className="rounded-lg border border-border bg-surface">
            {past.map((rem) => (
              <ReminderRow key={rem.id} reminder={rem} onDelete={handleDelete} onEdit={setEditing} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
