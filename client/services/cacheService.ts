/**
 * Simple in-memory cache for frequently accessed data
 * Reduces Firebase round-trips on subsequent page loads
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();

  // Default TTL: 2 minutes
  private defaultTTL = 2 * 60 * 1000;

  /**
   * Get cached data if valid, otherwise return null
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Get data from cache or fetch it
   * Returns cached data immediately, then refreshes in background
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttl?: number; forceRefresh?: boolean }
  ): Promise<T> {
    const cached = this.get<T>(key);

    // If we have cached data and not forcing refresh, return it
    // but still refresh in background for next time
    if (cached && !options?.forceRefresh) {
      // Background refresh (fire and forget)
      fetcher().then((data) => {
        this.set(key, data, options?.ttl);
      }).catch(console.error);

      return cached;
    }

    // No cache or force refresh - fetch and cache
    const data = await fetcher();
    this.set(key, data, options?.ttl);
    return data;
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Cache keys for consistency
export const CACHE_KEYS = {
  EMPLOYEES: 'employees',
  DEPARTMENTS: 'departments',
  ATTENDANCE: (start: string, end: string) => `attendance:${start}:${end}`,
  LEAVE_REQUESTS: 'leave_requests',
  LEAVE_BALANCES: 'leave_balances',
  USERS: 'users',
  AUDIT_LOG: 'audit_log',
  TENANT_SETTINGS: (tenantId: string) => `settings:${tenantId}`,
} as const;

export default cacheService;
