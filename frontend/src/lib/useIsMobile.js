import { useEffect, useState } from "react";

// True on phone-sized viewports. Drives the minimal mobile capture view.
export function useIsMobile(query = "(max-width: 640px)") {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
