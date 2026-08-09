import { useEffect, useState } from "react";

export function useSlowOperation(active: boolean, delayMs = 6_000): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setSlow(false);
    if (!active) return;
    const timer = window.setTimeout(() => setSlow(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return slow;
}

