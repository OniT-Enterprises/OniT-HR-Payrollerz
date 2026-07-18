import { useEffect } from "react";

/**
 * One-time scroll-into-view reveal for public marketing pages. Elements
 * marked with `data-reveal` (and the `public-reveal` class) get `is-visible`
 * the first time they approach the viewport, then stay revealed. Falls back
 * to instantly visible when IntersectionObserver is unavailable; CSS handles
 * prefers-reduced-motion.
 */
export function useScrollReveal() {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (elements.length === 0) return;

    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
