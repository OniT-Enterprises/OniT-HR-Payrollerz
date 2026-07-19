/**
 * React Query key factory for leave requests, balances, and stats.
 *
 * Kept in its own Firebase-free module so tests (and any consumer) can import
 * the key factory without pulling in the hooks' service/context graph, which
 * eagerly evaluates client/lib/firebase-core.ts and throws when the
 * VITE_FIREBASE_* env is absent (as it is in CI's unit-test step). Mirrors the
 * resolveLeaverFinalPay extraction pattern.
 */
export const leaveKeys = {
  all: (tenantId: string) => ["tenants", tenantId, "leave"] as const,
  requests: (tenantId: string) =>
    [...leaveKeys.all(tenantId), "requests"] as const,
  requestList: (tenantId: string, filters?: Record<string, unknown>) =>
    [...leaveKeys.requests(tenantId), filters ?? {}] as const,
  employeeRequests: (tenantId: string, employeeId: string) =>
    [...leaveKeys.requests(tenantId), "employee", employeeId] as const,
  balances: (tenantId: string) =>
    [...leaveKeys.all(tenantId), "balances"] as const,
  balance: (tenantId: string, employeeId: string) =>
    [...leaveKeys.balances(tenantId), employeeId] as const,
  stats: (tenantId: string) => [...leaveKeys.all(tenantId), "stats"] as const,
};
