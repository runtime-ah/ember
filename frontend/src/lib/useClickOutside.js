import { useEffect, useRef } from "react";

// Returns a ref to attach to an element; calls `handler` when a mousedown
// happens outside it. Used to dismiss inline editors/composers on click-off.
// `active` lets callers gate it (e.g. only while a form is open).
export function useClickOutside(handler, active = true) {
  const ref = useRef(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) handlerRef.current();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [active]);

  return ref;
}
