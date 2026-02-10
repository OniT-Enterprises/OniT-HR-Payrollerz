import { useCallback, useRef } from 'react';

/**
 * A hook that creates a stable callback reference that doesn't change between renders.
 * This helps prevent unnecessary re-renders in child components and ResizeObserver loops.
 *
 * Preserves exact argument and return types for full type safety.
 *
 * @param callback The callback function to stabilize
 * @returns A stable callback reference with the same type signature
 */
export function useStableCallback<Args extends unknown[], R>(
  callback: (...args: Args) => R
): (...args: Args) => R {
  const callbackRef = useRef(callback);

  // Update the ref with the latest callback
  callbackRef.current = callback;

  // Return a stable callback that calls the latest version
   
  return useCallback((...args: Args): R => {
    return callbackRef.current(...args);
  }, []);
}

export default useStableCallback;
