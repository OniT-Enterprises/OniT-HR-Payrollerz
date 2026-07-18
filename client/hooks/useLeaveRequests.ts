/**
 * React Query hooks for leave requests and balances
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCurrentEmployeeId,
  useTenant,
  useTenantId,
} from '@/contexts/TenantContext';
import { leaveService, type NewLeaveRequest } from '@/services/leaveService';

export const leaveKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'leave'] as const,
  requests: (tenantId: string) => [...leaveKeys.all(tenantId), 'requests'] as const,
  requestList: (tenantId: string, filters?: Record<string, unknown>) =>
    [...leaveKeys.requests(tenantId), filters ?? {}] as const,
  employeeRequests: (tenantId: string, employeeId: string) =>
    [...leaveKeys.requests(tenantId), 'employee', employeeId] as const,
  balances: (tenantId: string) => [...leaveKeys.all(tenantId), 'balances'] as const,
  balance: (tenantId: string, employeeId: string) =>
    [...leaveKeys.balances(tenantId), employeeId] as const,
};

/**
 * Fetch all leave requests (admin/manager view)
 */
export function useLeaveRequests(
  filters?: { departmentId?: string },
  enabled: boolean = true,
) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: leaveKeys.requestList(tenantId, filters as Record<string, unknown>),
    queryFn: () => leaveService.getLeaveRequests(tenantId, filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!tenantId && enabled,
  });
}

/**
 * Fetch leave requests for a specific employee
 */
export function useEmployeeLeaveRequests(employeeId: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: leaveKeys.employeeRequests(tenantId, employeeId!),
    queryFn: () => leaveService.getEmployeeRequests(tenantId, employeeId!),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!tenantId && !!employeeId,
  });
}

/**
 * Fetch all leave balances
 */
export function useAllLeaveBalances(enabled: boolean = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: leaveKeys.balances(tenantId),
    queryFn: () => leaveService.getAllBalances(tenantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!tenantId && enabled,
  });
}

/**
 * Fetch leave balance for a single employee
 */
export function useLeaveBalance(
  employeeId: string | undefined,
  departmentId?: string,
) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...leaveKeys.balance(tenantId, employeeId!), departmentId ?? 'self'] as const,
    queryFn: () => leaveService.getLeaveBalance(tenantId, employeeId!, undefined, departmentId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!tenantId && !!employeeId,
  });
}

/**
 * Create a leave request
 */
export function useCreateLeaveRequest() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: NewLeaveRequest) =>
      leaveService.createLeaveRequest(tenantId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests(tenantId) });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances(tenantId) });
    },
  });
}

/**
 * Approve a leave request
 */
export function useApproveLeaveRequest() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, approverId, approverName }: { requestId: string; approverId: string; approverName: string }) =>
      leaveService.approveLeaveRequest(tenantId, requestId, approverId, approverName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests(tenantId) });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances(tenantId) });
    },
  });
}

/**
 * Reject a leave request
 */
/**
 * Fetch leave stats (pending, on leave today, etc.)
 */
export function useLeaveStats(
  enabled: boolean = true,
  filters?: { employeeId?: string; departmentId?: string },
) {
  const tenantId = useTenantId();
  const { session } = useTenant();
  const currentEmployeeId = useCurrentEmployeeId() ?? undefined;
  const role = session?.role;
  const effectiveFilters = (() => {
    if (role === 'owner' || role === 'hr-admin' || role === 'accountant') {
      return filters;
    }
    if (role === 'manager') {
      return session?.member.departmentId
        ? { departmentId: session.member.departmentId }
        : currentEmployeeId
          ? { employeeId: currentEmployeeId }
          : undefined;
    }
    return currentEmployeeId ? { employeeId: currentEmployeeId } : undefined;
  })();
  const hasReadableScope =
    role === 'owner' ||
    role === 'hr-admin' ||
    role === 'accountant' ||
    Boolean(effectiveFilters?.employeeId || effectiveFilters?.departmentId);

  return useQuery({
    queryKey: [...leaveKeys.all(tenantId), 'stats', effectiveFilters ?? {}] as const,
    queryFn: () => leaveService.getLeaveStats(tenantId, effectiveFilters),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!tenantId && enabled && hasReadableScope,
  });
}

export function useRejectLeaveRequest() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, approverId, approverName, reason }: { requestId: string; approverId: string; approverName: string; reason: string }) =>
      leaveService.rejectLeaveRequest(tenantId, requestId, approverId, approverName, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests(tenantId) });
    },
  });
}

export function useCancelLeaveRequest() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => leaveService.cancelLeaveRequest(tenantId, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests(tenantId) });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances(tenantId) });
    },
  });
}
