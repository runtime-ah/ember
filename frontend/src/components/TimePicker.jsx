import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

// Times from 7am to 10pm in 30-min increments.
const TIMES = [];
for (let h = 7; h <= 22; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 22) TIMES.push(`${String(h).padStart(2, "0")}:30`);
}

function fmt(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export default function TimePicker({ value, onChange, placeholder = "Time" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded bg-elevated px-2 py-1 text-xs transition-colors duration-150 hover:text-text-primary ${
          value ? "text-text-secondary" : "text-text-muted"
        }`}
      >
        <Clock size={11} />
        {value ? fmt(value) : placeholder}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-28 overflow-hidden rounded-lg border border-border bg-surface shadow-pop">
          <div className="max-h-52 overflow-y-auto p-1">
            {value && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(null); setOpen(false); }}
                className="w-full rounded px-2 py-1 text-left text-[11px] text-text-muted hover:bg-elevated hover:text-danger"
              >
                Clear
              </button>
            )}
            {TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(t); setOpen(false); }}
                className={`w-full rounded px-2 py-1 text-left text-[11px] transition-colors duration-150 ${
                  value === t
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-elevated"
                }`}
              >
                {fmt(t)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
