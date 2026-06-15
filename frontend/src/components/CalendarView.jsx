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

// Parse "YYYY-MM-DD" as a local date to avoid UTC-offset issues.
function parseYMD(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

// Returns the exclusive end Date for spanning calculations.
// All-day events: end field is already exclusive (iCal convention).
// Timed events: add 1 day to the end date so the bar covers the end day.
function eventEndExclusive(event) {
  if (!event.end) return addDays(parseYMD(event.date), 1);
  if (event.all_day) return parseYMD(event.end);
  return addDays(parseYMD(event.end.slice(0, 10)), 1);
}

function EventChip({ event }) {
  return (
    <div
      className="truncate rounded bg-accent-subtle px-1.5 py-0.5 text-[11px] text-accent"
      title={event.summary}
    >
      {!event.all_day && (
        <span className="nums mr-1 text-text-muted">{timeLabel(event.start)}</span>
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

function MultiDayBar({ event, weekStart, weekEnd, slot }) {
  const eStart = parseYMD(event.date);
  const eEnd = eventEndExclusive(event);

  const colStart = Math.max(0, Math.round((eStart - weekStart) / 86400000));
  const colEnd = Math.min(7, Math.round((eEnd - weekStart) / 86400000));

  const startsHere = eStart >= weekStart;
  const endsHere = eEnd <= addDays(weekEnd, 1);

  return (
    <div
      className="absolute flex items-center overflow-hidden text-[11px] font-medium leading-none"
      style={{
        top: `${slot * 20 + 2}px`,
        height: "18px",
        left: `calc(${(colStart / 7) * 100}% + ${startsHere ? 3 : 0}px)`,
        right: `calc(${((7 - colEnd) / 7) * 100}% + ${endsHere ? 3 : 0}px)`,
        backgroundColor: "rgba(201, 100, 66, 0.18)",
        color: "var(--color-accent)",
        borderRadius: startsHere
          ? endsHere ? "4px" : "4px 0 0 4px"
          : endsHere ? "0 4px 4px 0" : "0",
        paddingLeft: "6px",
        paddingRight: "4px",
      }}
      title={event.summary}
    >
      {event.summary}
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

  // Events spanning multiple calendar days get spanning bars.
  const multiDayEvents = events.filter((e) => {
    if (!e.end) return false;
    const s = parseYMD(e.date);
    const en = eventEndExclusive(e);
    return s && en && en - s > 86400000;
  });
  const multiDayKeys = new Set(multiDayEvents.map((e) => `${e.date}|${e.summary}`));

  const byDate = {};
  const bucket = (k) => (byDate[k] ??= { events: [], tasks: [] });
  for (const e of events) {
    if (!multiDayKeys.has(`${e.date}|${e.summary}`)) bucket(e.date).events.push(e);
  }
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

  // Group into 6 weeks for month view
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="flex h-full flex-col px-4 py-5 md:px-6 md:py-7">
      <header className="mb-4 flex items-center gap-2">
        <h1 className="flex-1 text-xl font-semibold text-text-primary md:text-2xl">{title}</h1>
        <button
          onClick={() => setAnchor(new Date())}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          Today
        </button>
        <div className="flex items-center">
          <button onClick={() => shift(-1)} className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-elevated hover:text-text-primary">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => shift(1)} className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-elevated hover:text-text-primary">
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
          <code className="text-text-primary">backend/.env</code> to see events.
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
        <div className="flex flex-1 flex-col overflow-hidden">
          {weeks.map((wk, wi) => {
            const wkStart = wk[0];
            const wkEnd = wk[6];

            // Multi-day events overlapping this week
            const wkMulti = multiDayEvents.filter((e) => {
              const s = parseYMD(e.date);
              const en = eventEndExclusive(e);
              return s <= wkEnd && en > wkStart;
            });

            return (
              <div key={wi} className="flex min-h-0 flex-1 flex-col border-b border-border/60 last:border-b-0">
                {/* Spanning multi-day bars */}
                {wkMulti.length > 0 && (
                  <div className="relative shrink-0" style={{ height: `${wkMulti.length * 20 + 4}px` }}>
                    {/* Column dividers behind bars */}
                    <div className="absolute inset-0 grid grid-cols-7">
                      {wk.map((d) => <div key={ymd(d)} className="border-r border-border/60 last:border-r-0" />)}
                    </div>
                    {wkMulti.map((e, slot) => (
                      <MultiDayBar
                        key={`${e.date}|${e.summary}`}
                        event={e}
                        weekStart={wkStart}
                        weekEnd={wkEnd}
                        slot={slot}
                      />
                    ))}
                  </div>
                )}

                {/* Per-day cells */}
                <div className="grid min-h-0 flex-1 grid-cols-7">
                  {wk.map((d) => {
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
                        className="min-h-0 space-y-0.5 overflow-hidden border-r border-border/60 px-1 py-1 last:border-r-0"
                      >
                        <div
                          className={`nums mb-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                            isToday
                              ? "bg-accent font-medium text-white"
                              : otherMonth
                              ? "text-text-muted"
                              : "text-text-secondary"
                          }`}
                        >
                          {d.getDate()}
                        </div>
                        {items.slice(0, 2).map((it, i) =>
                          it.kind === "event" ? (
                            <EventChip key={`e${i}`} event={it.item} />
                          ) : (
                            <TaskChip key={`t${i}`} task={it.item} />
                          )
                        )}
                        {items.length > 2 && (
                          <div className="px-1 text-[10px] text-text-muted">+{items.length - 2}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-7">
          {days.map((d) => {
            const key = ymd(d);
            const data = byDate[key] ?? { events: [], tasks: [] };
            // Also show multi-day events in week view cells
            const wkMultiForDay = multiDayEvents.filter((e) => {
              const s = parseYMD(e.date);
              const en = eventEndExclusive(e);
              return s <= d && en > d;
            });
            const isToday = sameDay(d, today);
            return (
              <div key={key} className="space-y-1 overflow-y-auto border-r border-border/60 px-1.5 py-2 last:border-r-0">
                <div
                  className={`nums mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    isToday ? "bg-accent font-medium text-white" : "text-text-secondary"
                  }`}
                >
                  {d.getDate()}
                </div>
                {wkMultiForDay.map((e, i) => (
                  <div
                    key={`m${i}`}
                    className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-accent"
                    style={{ backgroundColor: "rgba(201,100,66,0.18)" }}
                    title={e.summary}
                  >
                    {e.summary}
                  </div>
                ))}
                {data.events.map((e, i) => <EventChip key={`e${i}`} event={e} />)}
                {data.tasks.map((t, i) => <TaskChip key={`t${i}`} task={t} />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
