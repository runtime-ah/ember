import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarOff } from "lucide-react";
import { api } from "../api";
import { priorityColor } from "../lib/priority";
import {
  ymd,
  addDays,
  sameDay,
  monthGrid,
  weekDays,
  WEEKDAY_LABELS,
  monthTitle,
  timeLabel,
} from "../lib/dates";

function EventChip({ event }) {
  return (
    <div
      className="truncate rounded bg-accent-subtle px-1.5 py-0.5 text-[11px] text-text-primary"
      title={event.summary}
    >
      {!event.all_day && (
        <span className="nums mr-1 text-text-secondary">{timeLabel(event.start)}</span>
      )}
      {event.summary}
    </div>
  );
}

function TaskChip({ task }) {
  const dot = priorityColor(task.priority);
  return (
    <div
      className="flex items-center gap-1 truncate rounded bg-elevated px-1.5 py-0.5 text-[11px] text-text-secondary"
      title={task.content}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot ?? "var(--color-text-muted)" }}
      />
      <span className="truncate">{task.content}</span>
    </div>
  );
}

export default function CalendarView() {
  const [mode, setMode] = useState("month");
  const [anchor, setAnchor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [configured, setConfigured] = useState(true);

  const days = mode === "month" ? monthGrid(anchor) : weekDays(anchor);
  const startKey = ymd(days[0]);
  const endKey = ymd(days[days.length - 1]);

  const load = useCallback(async () => {
    const [cal, allTasks] = await Promise.all([
      api.getCalendar(startKey, endKey),
      api.listTasks(),
    ]);
    setConfigured(cal.configured);
    setEvents(cal.events);
    setTasks(allTasks.filter((t) => t.due_date && !t.completed));
  }, [startKey, endKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Group events + tasks by date string.
  const byDate = {};
  const bucket = (k) => (byDate[k] ??= { events: [], tasks: [] });
  for (const e of events) bucket(e.date).events.push(e);
  for (const t of tasks) bucket(t.due_date).tasks.push(t);

  const today = new Date();

  function shift(dir) {
    if (mode === "month") {
      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    } else {
      setAnchor(addDays(anchor, dir * 7));
    }
  }

  const title =
    mode === "month"
      ? monthTitle(anchor)
      : `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="flex h-full flex-col px-6 py-7">
      <header className="mb-4 flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold text-text-primary">{title}</h1>
        <button
          onClick={() => setAnchor(new Date())}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          Today
        </button>
        <div className="flex items-center">
          <button
            onClick={() => shift(-1)}
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-elevated hover:text-text-primary"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => shift(1)}
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-elevated hover:text-text-primary"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex overflow-hidden rounded-md border border-border text-xs">
          {["week", "month"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 capitalize transition-colors duration-150 ${
                mode === m ? "bg-accent-subtle text-text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {!configured && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
          <CalendarOff size={14} />
          Calendar not connected — add iCloud CalDAV credentials in{" "}
          <code className="text-text-primary">backend/.env</code> to see events. Tasks
          with due dates still show.
        </div>
      )}

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border pb-1.5">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="px-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {w}
          </div>
        ))}
      </div>

      {mode === "month" ? (
        <div className="grid flex-1 grid-cols-7 grid-rows-6">
          {days.map((d) => {
            const key = ymd(d);
            const data = byDate[key] ?? { events: [], tasks: [] };
            const items = [
              ...data.events.map((e) => ({ kind: "event", item: e })),
              ...data.tasks.map((t) => ({ kind: "task", item: t })),
            ];
            const isToday = sameDay(d, today);
            const otherMonth = d.getMonth() !== anchor.getMonth();
            return (
              <div
                key={key}
                className="min-h-0 space-y-0.5 overflow-hidden border-b border-r border-border/60 px-1 py-1"
              >
                <div
                  className={`nums mb-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday ? "bg-accent font-medium text-white" : otherMonth ? "text-text-muted" : "text-text-secondary"
                  }`}
                >
                  {d.getDate()}
                </div>
                {items.slice(0, 3).map((it, i) =>
                  it.kind === "event" ? (
                    <EventChip key={`e${i}`} event={it.item} />
                  ) : (
                    <TaskChip key={`t${i}`} task={it.item} />
                  ),
                )}
                {items.length > 3 && (
                  <div className="px-1 text-[10px] text-text-muted">+{items.length - 3} more</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-7">
          {days.map((d) => {
            const key = ymd(d);
            const data = byDate[key] ?? { events: [], tasks: [] };
            const isToday = sameDay(d, today);
            return (
              <div key={key} className="space-y-1 overflow-y-auto border-r border-border/60 px-1.5 py-2">
                <div
                  className={`nums mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    isToday ? "bg-accent font-medium text-white" : "text-text-secondary"
                  }`}
                >
                  {d.getDate()}
                </div>
                {data.events.map((e, i) => (
                  <EventChip key={`e${i}`} event={e} />
                ))}
                {data.tasks.map((t, i) => (
                  <TaskChip key={`t${i}`} task={t} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
