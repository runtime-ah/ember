// Local-date helpers for the calendar grid (no timezone libraries needed).

export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d) {
  // Sunday-start week.
  return addDays(d, -d.getDay());
}

export function sameDay(a, b) {
  return ymd(a) === ymd(b);
}

// 6×7 grid of dates covering the month that `anchor` falls in.
export function monthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekDays(anchor) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthTitle(d) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function timeLabel(iso) {
  // iso like "2026-06-13T14:30:00..." → "2:30 PM"
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
