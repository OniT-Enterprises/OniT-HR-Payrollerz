/**
 * React Query hooks for admin (superadmin) operations
 * Note: No tenantId in query keys — admin scope
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService, TenantProfileInput } from '@/services/adminService';
import { PackagesConfig } from '@/types/admin';

const adminKeys = {
  console: () => ['admin', 'console'] as const,
  tenants: () => ['admin', 'tenants'] as const,
  tenant: (id: string) => ['admin', 'tenant', id] as const,
  tenantStats: (id: string) => ['admin', 'tenant', id, 'stats'] as const,
  users: () => ['admin', 'users'] as const,
  packages: () => ['admin', 'packages'] as const,
  superAdminRequests: () => ['admin', 'superAdminRequests'] as const,
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

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      createdBy,
      actorEmail,
    }: {
      input: TenantProfileInput;
      createdBy: string;
      actorEmail: string;
    }) => adminService.createTenant(input, createdBy, actorEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
    },
  });
}

export function useUpdateTenantProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, input }: { tenantId: string; input: TenantProfileInput }) =>
      adminService.updateTenantProfile(tenantId, input),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
      queryClient.invalidateQueries({ queryKey: adminKeys.tenant(tenantId) });
    },
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

export function usePackagesConfig() {
  return useQuery({
    queryKey: adminKeys.packages(),
    queryFn: () => adminService.getPackagesConfig(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavePackagesConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      config,
      actorUid,
      actorEmail,
    }: {
      config: PackagesConfig;
      actorUid: string;
      actorEmail: string;
    }) => adminService.savePackagesConfig(config, actorUid, actorEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.packages() });
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
    },
  });
}

export function useSuperAdminRequests() {
  return useQuery({
    queryKey: adminKeys.superAdminRequests(),
    queryFn: () => adminService.getSuperAdminRequests(),
    staleTime: 30 * 1000,
  });
}

export function useRequestSuperAdminChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      type: 'grant' | 'revoke';
      targetEmail: string;
      targetUid?: string;
      targetDisplayName?: string;
      requestedByUid: string;
      requestedByEmail: string;
      requestedByName?: string;
    }) => adminService.requestSuperAdminChange(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.superAdminRequests() });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
    },
  });
}

export function useApproveSuperAdminRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      requestId: string;
      approverUid: string;
      approverEmail: string;
    }) => adminService.approveSuperAdminRequest(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.superAdminRequests() });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
    },
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
