/**
 * Query Cache Persistence
 * Saves React Query cache to IndexedDB (via idb-keyval) for instant loading.
 * IndexedDB provides ~hundreds of MB vs sessionStorage's ~5MB limit.
 *
 * SECURITY:
 * 1. Uses ALLOW-LIST approach - only explicitly safe data is persisted
 * 2. Prevents PII/financial data leakage by secure-by-default design
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { get, set, del } from 'idb-keyval';

const CACHE_KEY = 'onit-query-cache';
const CACHE_VERSION = 5; // v5: migrated from sessionStorage to IndexedDB
const MAX_AGE = 1000 * 60 * 30; // 30 minutes

/**
 * ALLOW-LIST: Only these query key patterns are safe to persist.
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
 * Save specific query data to IndexedDB
 * SECURITY: Only persists data that matches the allow-list
 */
export async function persistQueryData(queryKey: string, data: unknown): Promise<void> {
  if (!isSafeToPersist(queryKey)) {
    return;
  }

  try {
    const store = await loadCacheStore();
    store.entries[queryKey] = {
      data,
      timestamp: Date.now(),
      queryKey,
    };
    await set(CACHE_KEY, store);
  } catch {
    // Storage error - silently ignore
  }
}

/**
 * Load cache store from IndexedDB
 * Cleans up expired entries and any that no longer match the allow-list
 */
async function loadCacheStore(): Promise<CacheStore> {
  try {
    const store = await get<CacheStore>(CACHE_KEY);
    if (store && store.version === CACHE_VERSION) {
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
      if (needsUpdate) {
        await set(CACHE_KEY, store);
      }
      return store;
    }
    // Version mismatch — clear old data
    if (store) {
      await del(CACHE_KEY);
    }
  } catch {
    // Corrupted cache - ignore
  }
  return { version: CACHE_VERSION, entries: {} };
}

/**
 * Get cached data for a query key
 */
export async function getCachedData<T>(queryKey: string): Promise<T | undefined> {
  const store = await loadCacheStore();
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
    queryCache: new QueryCache({
      onError: (error, query) => {
        Sentry.captureException(error, {
          tags: { queryKey: JSON.stringify(query.queryKey) },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        Sentry.captureException(error);
      },
    }),
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
 * Hydrate QueryClient with persisted cache on app load.
 * Async — call at startup but the app renders immediately; cache arrives shortly after.
 */
export async function hydrateQueryClient(queryClient: QueryClient): Promise<void> {
  const store = await loadCacheStore();

  Object.values(store.entries).forEach((entry) => {
    try {
      const queryKey = JSON.parse(entry.queryKey);
      queryClient.setQueryData(queryKey, entry.data);
    } catch {
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

      // persistQueryData will only save if key matches allow-list (fire-and-forget)
      persistQueryData(keyString, state.data);
    }
  });

  return unsubscribe;
}
