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
import { get, set, del, keys } from 'idb-keyval';
import { isSafeQueryCacheKey } from '@/lib/queryCachePolicy';

declare const __BUILD_TIMESTAMP__: string;

/**
 * Max records fetched for client-side search.
 * Firestore has no native full-text search, so we fetch up to this many
 * records and filter locally. Keep this low to control Firestore read costs.
 * V2: Replace with server-side search (Algolia/Typesense/Meilisearch).
 */
export const SEARCH_FETCH_LIMIT = 300;

const CACHE_KEY_PREFIX = 'onit-query-cache:';
const LEGACY_CACHE_KEY = 'onit-query-cache';
// Cache version tied to build — each deploy auto-invalidates stale data
const CACHE_VERSION = __BUILD_TIMESTAMP__ || '5';
const MAX_AGE = 1000 * 60 * 30; // 30 minutes

interface CacheEntry {
  data: unknown;
  timestamp: number;
  queryKey: string;
}

interface CacheStore {
  version: string | number;
  entries: Record<string, CacheEntry>;
}

function cacheKeyForUser(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

/**
 * Save specific query data to IndexedDB
 * SECURITY: Only persists data that matches the allow-list
 */
async function persistQueryData(userId: string, queryKey: string, data: unknown): Promise<void> {
  if (!isSafeQueryCacheKey(queryKey)) {
    return;
  }

  try {
    const store = await loadCacheStore(userId);
    store.entries[queryKey] = {
      data,
      timestamp: Date.now(),
      queryKey,
    };
    await set(cacheKeyForUser(userId), store);
  } catch {
    // Storage error - silently ignore
  }
}

/**
 * Load cache store from IndexedDB
 * Cleans up expired entries and any that no longer match the allow-list
 */
async function loadCacheStore(userId: string): Promise<CacheStore> {
  try {
    const cacheKey = cacheKeyForUser(userId);
    const store = await get<CacheStore>(cacheKey);
    if (store && store.version === CACHE_VERSION) {
      const now = Date.now();
      let needsUpdate = false;
      Object.keys(store.entries).forEach((key) => {
        if (
          now - store.entries[key].timestamp > MAX_AGE ||
          !isSafeQueryCacheKey(key)
        ) {
          delete store.entries[key];
          needsUpdate = true;
        }
      });
      if (needsUpdate) {
        await set(cacheKey, store);
      }
      return store;
    }
    // Version mismatch — clear old data
    if (store) {
      await del(cacheKey);
    }
  } catch {
    // Corrupted cache - ignore
  }
  return { version: CACHE_VERSION, entries: {} };
}

/**
 * Remove persisted query data from this browser. A shared workstation must
 * not retain another account's HR or finance data after logout.
 */
export async function clearPersistedQueryCache(userId?: string): Promise<void> {
  try {
    if (userId) {
      await del(cacheKeyForUser(userId));
    } else {
      const cacheKeys = await keys();
      await Promise.all(
        cacheKeys
          .filter((key): key is string => typeof key === 'string' && key.startsWith(CACHE_KEY_PREFIX))
          .map((key) => del(key)),
      );
    }
    // Clean data written by pre-user-scoping releases too.
    await del(LEGACY_CACHE_KEY);
  } catch {
    // Storage unavailable/corrupted — there is no application-level recovery needed.
  }
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
export async function hydrateQueryClient(queryClient: QueryClient, userId: string): Promise<void> {
  const store = await loadCacheStore(userId);

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
export function setupQueryPersistence(queryClient: QueryClient, userId: string): () => void {
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success') {
      const { queryKey, state } = event.query;
      const keyString = JSON.stringify(queryKey);

      // persistQueryData will only save if key matches allow-list (fire-and-forget)
      persistQueryData(userId, keyString, state.data);
    }
  });

  return unsubscribe;
}
