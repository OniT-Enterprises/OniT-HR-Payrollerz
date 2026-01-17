/**
 * Query Cache Persistence
 * Saves React Query cache to localStorage for instant loading on page refresh
 */

import { QueryClient } from '@tanstack/react-query';

const CACHE_KEY = 'onit-query-cache';
const CACHE_VERSION = 1;
const MAX_AGE = 1000 * 60 * 30; // 30 minutes

interface CacheEntry {
  data: unknown;
  timestamp: number;
  queryKey: string;
}

interface CacheStore {
  version: number;
  entries: Record<string, CacheEntry>;
}

/**
 * Save specific query data to localStorage
 */
export function persistQueryData(queryKey: string, data: unknown): void {
  try {
    const store = loadCacheStore();
    store.entries[queryKey] = {
      data,
      timestamp: Date.now(),
      queryKey,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch (e) {
    // Storage full or other error - silently ignore
    console.warn('Failed to persist query cache:', e);
  }
}

/**
 * Load cache store from localStorage
 */
function loadCacheStore(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const store = JSON.parse(raw) as CacheStore;
      if (store.version === CACHE_VERSION) {
        // Clean up expired entries
        const now = Date.now();
        Object.keys(store.entries).forEach((key) => {
          if (now - store.entries[key].timestamp > MAX_AGE) {
            delete store.entries[key];
          }
        });
        return store;
      }
    }
  } catch (e) {
    // Corrupted cache - ignore
  }
  return { version: CACHE_VERSION, entries: {} };
}

/**
 * Get cached data for a query key
 */
export function getCachedData<T>(queryKey: string): T | undefined {
  const store = loadCacheStore();
  const entry = store.entries[queryKey];
  if (entry && Date.now() - entry.timestamp < MAX_AGE) {
    return entry.data as T;
  }
  return undefined;
}

/**
 * Create QueryClient with optimized settings for snappy UX
 */
export function createOptimizedQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh for 5 minutes - no refetch in that window
        staleTime: 1000 * 60 * 5,
        // Keep unused data in cache for 30 minutes
        gcTime: 1000 * 60 * 30,
        // Only retry once on failure
        retry: 1,
        // Show stale data immediately while refetching
        refetchOnWindowFocus: false,
        // Don't refetch on mount if data is fresh
        refetchOnMount: false,
      },
    },
  });
}

/**
 * Hydrate QueryClient with persisted cache on app load
 */
export function hydrateQueryClient(queryClient: QueryClient): void {
  const store = loadCacheStore();

  Object.values(store.entries).forEach((entry) => {
    try {
      // Parse the query key back to array format
      const queryKey = JSON.parse(entry.queryKey);
      queryClient.setQueryData(queryKey, entry.data);
    } catch (e) {
      // Invalid key format - skip
    }
  });
}

/**
 * Setup persistence for a QueryClient
 * Saves data whenever a query succeeds
 */
export function setupQueryPersistence(queryClient: QueryClient): () => void {
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success') {
      const { queryKey, state } = event.query;
      // Only persist list queries (not individual details)
      const keyString = JSON.stringify(queryKey);
      if (keyString.includes('list') || keyString.includes('counts')) {
        persistQueryData(keyString, state.data);
      }
    }
  });

  return unsubscribe;
}
