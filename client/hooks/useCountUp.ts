import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Animates a number toward `target` over a short ease-out ramp — the
 * "numbers settling in" effect on overview cards. One-time per value change;
 * renders the final value immediately under prefers-reduced-motion.
 */
export function useCountUp(target: number, durationMs = 450): number {
  const [value, setValue] = useState(() =>
    prefersReducedMotion() ? target : 0,
  );
  const fromRef = useRef(value);

  useEffect(() => {
    const skip = prefersReducedMotion() || fromRef.current === target;
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = skip ? 1 : Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress < 1) {
        setValue(from + (target - from) * eased);
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        setValue(target);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
