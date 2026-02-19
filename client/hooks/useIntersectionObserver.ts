/**
 * Reusable IntersectionObserver hook for infinite scroll
 */

import { useEffect, useRef, useState, type RefObject } from 'react';

interface UseIntersectionObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  enabled?: boolean;
}

export function useIntersectionObserver<T extends Element = HTMLDivElement>(
  options: UseIntersectionObserverOptions = {}
): { ref: RefObject<T | null>; isIntersecting: boolean } {
  const { root = null, rootMargin = '200px', threshold = 0, enabled = true } = options;
  const ref = useRef<T | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { root, rootMargin, threshold }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [root, rootMargin, threshold, enabled]);

  return { ref, isIntersecting };
}
