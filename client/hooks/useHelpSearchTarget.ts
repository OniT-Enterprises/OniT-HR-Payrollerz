import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { helpHashTarget, helpSearchQuery } from "@/lib/help/navigation";

/** Scroll to a deep-linked answer and briefly call out search arrivals. */
export function useHelpSearchTarget(ready: boolean): string | null {
  const location = useLocation();
  const arrivalKey = `${location.search}|${location.hash}`;
  const [highlightedTarget, setHighlightedTarget] = useState<{
    id: string;
    arrivalKey: string;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;

    const targetId = helpHashTarget(location.hash);
    if (!targetId) return;

    let clearHighlight: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;

      target.scrollIntoView({ block: "start" });
      if (!helpSearchQuery(location.search)) return;

      setHighlightedTarget({ id: targetId, arrivalKey });
      target.focus({ preventScroll: true });
      clearHighlight = window.setTimeout(
        () => setHighlightedTarget(null),
        2400,
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (clearHighlight !== undefined) window.clearTimeout(clearHighlight);
    };
  }, [arrivalKey, location.hash, location.search, ready]);

  return ready && highlightedTarget?.arrivalKey === arrivalKey
    ? highlightedTarget.id
    : null;
}
