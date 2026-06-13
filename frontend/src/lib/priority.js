// Priority metadata. p1 highest .. p4 none (no dot).
export const PRIORITIES = [
  { value: 1, label: "P1", color: "var(--color-p1)" },
  { value: 2, label: "P2", color: "var(--color-p2)" },
  { value: 3, label: "P3", color: "var(--color-p3)" },
  { value: 4, label: "P4", color: null },
];

export function priorityColor(value) {
  return PRIORITIES.find((p) => p.value === value)?.color ?? null;
}

export function formatDue(dueDate, dueTime) {
  if (!dueDate) return null;
  const d = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - today) / 86400000);

  let label;
  if (diffDays === 0) label = "Today";
  else if (diffDays === 1) label = "Tomorrow";
  else if (diffDays === -1) label = "Yesterday";
  else label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  if (dueTime) label += ` ${dueTime.slice(0, 5)}`;
  return { label, overdue: diffDays < 0 };
}
