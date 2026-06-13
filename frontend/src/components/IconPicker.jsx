import { useState } from "react";
import { Hash } from "lucide-react";
import { ICONS, ICON_NAMES, Icon } from "../lib/icons";
import { useClickOutside } from "../lib/useClickOutside";

// A compact popover for choosing an icon. `value` is the stored icon key (or
// null), `onChange` receives the new key (null = default hash).
export default function IconPicker({ value, onChange, color, size = 16 }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false), open);

  function pick(name) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded p-1 transition-colors duration-150 hover:bg-elevated"
        title="Choose icon"
      >
        <Icon name={value} size={size} style={{ color }} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-elevated p-2 shadow-lg">
          <div className="grid grid-cols-7 gap-1">
            <button
              type="button"
              onClick={() => pick(null)}
              title="Default"
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors duration-150 hover:bg-surface ${
                !value ? "bg-surface" : ""
              }`}
            >
              <Hash size={15} style={{ color }} />
            </button>
            {ICON_NAMES.map((name) => {
              const Cmp = ICONS[name];
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => pick(name)}
                  title={name}
                  className={`flex h-7 w-7 items-center justify-center rounded transition-colors duration-150 hover:bg-surface ${
                    value === name ? "bg-surface" : ""
                  }`}
                >
                  <Cmp size={15} style={{ color }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
