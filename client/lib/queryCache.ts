/**
 * Query Cache Persistence
 * Saves React Query cache to sessionStorage for instant loading during session.
 * Data is automatically cleared when the browser tab/window closes.
 *
 * SECURITY:
 * 1. Uses sessionStorage instead of localStorage - data cleared on tab close
 * 2. Uses ALLOW-LIST approach - only explicitly safe data is persisted
 * 3. Prevents PII/financial data leakage by secure-by-default design
 */

import { QueryClient } from '@tanstack/react-query';

const CACHE_KEY = 'onit-query-cache';
const CACHE_VERSION = 4; // Bumped: v3 allow-list, v4 switched to sessionStorage
const MAX_AGE = 1000 * 60 * 30; // 30 minutes

/**
 * ALLOW-LIST: Only these query key patterns are safe to persist to sessionStorage.
 * Everything else is excluded by default.
 *
 * This is safer than a deny-list because:
 * 1. New queries default to NOT being cached (secure by default)
 * 2. Developers must explicitly opt-in to persistence
 * 3. No risk of missing a sensitive pattern like "bonus" or "commission"
 */
const SAFE_TO_PERSIST_PATTERNS = [
  // Static configuration data
  'settings',
  'departments',
  'positions',
  'locations',
  'work-locations',
  // UI preferences
  'preferences',
  'theme',
  'language',
  // Public/static lists
  'countries',
  'currencies',
  'timezones',
  // Feature flags
  'features',
  'flags',
];

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
 * Check if a query key is explicitly safe to persist
 * Returns true ONLY if the key matches an allowed pattern
 */
function isSafeToPersist(queryKey: string): boolean {
  const lowerKey = queryKey.toLowerCase();
  return SAFE_TO_PERSIST_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

/**
 * Save specific query data to sessionStorage
 * SECURITY: Only persists data that matches the allow-list
 */
export function persistQueryData(queryKey: string, data: unknown): void {
  // Only persist if explicitly allowed - secure by default
  if (!isSafeToPersist(queryKey)) {
    return;
  }

  try {
    const store = loadCacheStore();
    store.entries[queryKey] = {
      data,
      timestamp: Date.now(),
      queryKey,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch (e) {
    // Storage full or other error - silently ignore
    console.warn('Failed to persist query cache:', e);
  }
}

/**
 * Load cache store from sessionStorage
 * Cleans up expired entries and any that no longer match the allow-list
 */
function loadCacheStore(): CacheStore {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const store = JSON.parse(raw) as CacheStore;
      if (store.version === CACHE_VERSION) {
        // Clean up expired entries AND entries no longer in allow-list
        const now = Date.now();
        let needsUpdate = false;
        Object.keys(store.entries).forEach((key) => {
          if (
            now - store.entries[key].timestamp > MAX_AGE ||
            !isSafeToPersist(key)
          ) {
            delete store.entries[key];
            needsUpdate = true;
          }
        });
        // Save cleaned store back to sessionStorage
        if (needsUpdate) {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(store));
        }
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
 * SECURITY: Only allow-listed queries are persisted (secure by default)
 */
export function setupQueryPersistence(queryClient: QueryClient): () => void {
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success') {
      const { queryKey, state } = event.query;
      const keyString = JSON.stringify(queryKey);

      // persistQueryData will only save if key matches allow-list
      persistQueryData(keyString, state.data);
    }
  });

  return unsubscribe;
}
