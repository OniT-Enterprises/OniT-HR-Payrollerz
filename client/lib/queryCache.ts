/**
 * Query Cache Persistence
 * Saves React Query cache to localStorage for instant loading on page refresh
 *
 * SECURITY: Sensitive data (payroll, salary, bank info) is excluded from
 * localStorage to prevent data leakage on shared computers.
 */

import { QueryClient } from '@tanstack/react-query';

const CACHE_KEY = 'onit-query-cache';
const CACHE_VERSION = 2; // Bumped version to clear old caches with sensitive data
const MAX_AGE = 1000 * 60 * 30; // 30 minutes

/**
 * Query keys containing these patterns will NOT be persisted to localStorage.
 * This prevents sensitive payroll/financial data from being stored on the client.
 */
const SENSITIVE_PATTERNS = [
  'payroll',
  'salary',
  'salaries',
  'bank',
  'compensation',
  'deduction',
  'advance',
  'loan',
  'tax',
  'inss',
  'wit',
  'earnings',
  'netpay',
  'grosspay',
  'transfer',
  'payment',
  'ssn',
  'social-security',
  'apikey',
  'secret',
  'credential',
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
 * Check if a query key contains sensitive data patterns
 * Returns true if the key should NOT be persisted
 */
function isSensitiveQueryKey(queryKey: string): boolean {
  const lowerKey = queryKey.toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

/**
 * Save specific query data to localStorage
 * SECURITY: Skips sensitive data to prevent leakage
 */
export function persistQueryData(queryKey: string, data: unknown): void {
  // Skip sensitive data - never persist to localStorage
  if (isSensitiveQueryKey(queryKey)) {
    return;
  }

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
 * Also cleans up any sensitive entries that shouldn't be persisted
 */
function loadCacheStore(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const store = JSON.parse(raw) as CacheStore;
      if (store.version === CACHE_VERSION) {
        // Clean up expired entries AND sensitive entries that shouldn't be persisted
        const now = Date.now();
        let needsUpdate = false;
        Object.keys(store.entries).forEach((key) => {
          if (
            now - store.entries[key].timestamp > MAX_AGE ||
            isSensitiveQueryKey(key)
          ) {
            delete store.entries[key];
            needsUpdate = true;
          }
        });
        // Save cleaned store back to localStorage
        if (needsUpdate) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(store));
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
 * SECURITY: Sensitive data is automatically filtered by persistQueryData
 */
export function setupQueryPersistence(queryClient: QueryClient): () => void {
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success') {
      const { queryKey, state } = event.query;
      const keyString = JSON.stringify(queryKey);

      // Only persist list/count queries, and persistQueryData will filter sensitive ones
      if (keyString.includes('list') || keyString.includes('counts')) {
        persistQueryData(keyString, state.data);
      }
    }
  });

  return unsubscribe;
}
