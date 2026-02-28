/**
 * React Query hooks for admin (superadmin) operations
 * Note: No tenantId in query keys — admin scope
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';

export const adminKeys = {
  tenants: () => ['admin', 'tenants'] as const,
  tenant: (id: string) => ['admin', 'tenant', id] as const,
  tenantStats: (id: string) => ['admin', 'tenant', id, 'stats'] as const,
  users: () => ['admin', 'users'] as const,
  auditLog: () => ['admin', 'auditLog'] as const,
};

// ─── Tenant hooks ────────────────────────────────────────────────

export function useAllTenants() {
  return useQuery({
    queryKey: adminKeys.tenants(),
    queryFn: () => adminService.getAllTenants(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTenantDetail(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.tenant(id!),
    queryFn: () => adminService.getTenantById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTenantStats(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.tenantStats(id!),
    queryFn: () => adminService.getTenantStats(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSuspendTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, reason, actorUid, actorEmail }: {
      tenantId: string; reason: string; actorUid: string; actorEmail: string;
    }) => adminService.suspendTenant(tenantId, reason, actorUid, actorEmail),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
      queryClient.invalidateQueries({ queryKey: adminKeys.tenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
    },
  });
}

export function useReactivateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, actorUid, actorEmail }: {
      tenantId: string; actorUid: string; actorEmail: string;
    }) => adminService.reactivateTenant(tenantId, actorUid, actorEmail),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
      queryClient.invalidateQueries({ queryKey: adminKeys.tenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
    },
  });
}

// ─── User hooks ──────────────────────────────────────────────────

export function useAllUsers(maxResults?: number) {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () => adminService.getAllUsers(maxResults),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetSuperadmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetUid, isSuperAdmin }: { targetUid: string; isSuperAdmin: boolean }) =>
      adminService.setSuperadmin(targetUid, isSuperAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
    },
  });
}

// ─── Audit log hooks ─────────────────────────────────────────────

export function useAuditLog(maxResults: number = 100) {
  return useQuery({
    queryKey: adminKeys.auditLog(),
    queryFn: () => adminService.getAuditLog(maxResults),
    staleTime: 30 * 1000, // Audit log refreshes more frequently
  });
}
