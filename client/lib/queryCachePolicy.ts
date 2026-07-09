/**
 * Browser-persisted query data must be harmless if a workstation is shared.
 * Business records are intentionally excluded even when they are tenant-scoped
 * in React Query: browser persistence has a different security boundary.
 */
const SAFE_TO_PERSIST_PATTERNS = [
  'departments',
  'positions',
  'locations',
  'work-locations',
  'preferences',
  'theme',
  'language',
  'countries',
  'currencies',
  'timezones',
  'features',
  'flags',
];

export function isSafeQueryCacheKey(queryKey: string): boolean {
  const lowerKey = queryKey.toLowerCase();
  return SAFE_TO_PERSIST_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}
