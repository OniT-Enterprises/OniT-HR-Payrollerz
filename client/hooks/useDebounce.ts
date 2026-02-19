import { useState, useEffect } from 'react';

/**
 * Debounce a value by a given delay.
 * Returns the debounced value that only updates after the delay has passed
 * since the last change.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
