import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api";

// Inline label selector. `selected` is list[LabelOut], `onChange` receives the new list.
export default function LabelPicker({ selected = [], onChange }) {
  const [all, setAll] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.listLabels().then(setAll).catch(() => {});
  }, []);

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selectedIds = new Set(selected.map((l) => l.id));
  const filtered = all.filter(
    (l) => !selectedIds.has(l.id) && l.name.toLowerCase().includes(query.toLowerCase()),
  );
  const canCreate =
    query.trim().length > 0 &&
    !all.find((l) => l.name.toLowerCase() === query.trim().toLowerCase());

  function add(label) {
    onChange([...selected, label]);
    setQuery("");
    inputRef.current?.focus();
  }

  function remove(id) {
    onChange(selected.filter((l) => l.id !== id));
  }

  async function createAndAdd() {
    const name = query.trim();
    if (!name) return;
    try {
      const label = await api.createLabel({ name, color: "#999999" });
      setAll((prev) => [...prev, label]);
      add(label);
    } catch {
      // Label already exists (race) — just pick the existing one.
      const existing = all.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (existing) add(existing);
    }
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="flex min-h-[28px] flex-wrap items-center gap-1 rounded bg-elevated px-2 py-1 cursor-text"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        {selected.map((l) => (
          <span
            key={l.id}
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: l.color + "28", color: l.color }}
          >
            #{l.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(l.id); }}
              className="opacity-60 hover:opacity-100"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // Pick the first matching existing label, or create a new one.
              if (filtered.length > 0) add(filtered[0]);
              else if (canCreate) createAndAdd();
            } else if (e.key === "Escape") {
              setQuery("");
              setOpen(false);
            } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
              remove(selected[selected.length - 1].id);
            }
          }}
          placeholder={selected.length === 0 ? "Add labels…" : ""}
          className="min-w-[60px] flex-1 bg-transparent text-xs text-text-secondary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      {open && (filtered.length > 0 || canCreate) && (
        <div className="absolute top-full left-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-pop">
          {filtered.slice(0, 8).map((l) => (
            <button
              key={l.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); add(l); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-elevated"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: l.color }}
              />
              #{l.name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); createAndAdd(); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-muted hover:bg-elevated ${
                filtered.length > 0 ? "border-t border-border/40" : ""
              }`}
            >
              Create "#{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
