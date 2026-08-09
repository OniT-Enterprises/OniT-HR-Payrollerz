import { useEffect, useMemo, useState } from "react";

export function useSlowOperation(active: boolean, delayMs = 6_000): boolean {
  const [slowOperation, setSlowOperation] = useState<symbol | null>(null);
  const operation = useMemo(
    () => (active ? Symbol(`slow-operation-${delayMs}`) : null),
    [active, delayMs],
  );

  useEffect(() => {
    if (!operation) return;
    const timer = window.setTimeout(
      () => setSlowOperation(operation),
      delayMs,
    );
    return () => window.clearTimeout(timer);
  }, [delayMs, operation]);

  return operation !== null && slowOperation === operation;
}
