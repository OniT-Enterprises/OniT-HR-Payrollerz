/**
 * React Query hooks for admin (superadmin) operations
 * Note: No tenantId in query keys — admin scope
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService, TenantProfileInput } from '@/services/adminService';
import {
  contractTemplateService,
  ContractTemplate,
  ContractTemplateInput,
} from '@/services/contractTemplateService';
import { PackagesConfig } from '@/types/admin';
import { ModulePermission, TenantRole } from '@/types/tenant';

const adminKeys = {
  console: () => ['admin', 'console'] as const,
  tenants: () => ['admin', 'tenants'] as const,
  tenant: (id: string) => ['admin', 'tenant', id] as const,
  tenantStats: (id: string) => ['admin', 'tenant', id, 'stats'] as const,
  tenantMembers: (id: string) => ['admin', 'tenant', id, 'members'] as const,
  users: () => ['admin', 'users'] as const,
  packages: () => ['admin', 'packages'] as const,
  superAdminRequests: () => ['admin', 'superAdminRequests'] as const,
  auditLog: () => ['admin', 'auditLog'] as const,
  contractTemplates: () => ['admin', 'contractTemplates'] as const,
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

export function useRecordManualSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, months, monthlyAmount, actorUid, actorEmail }: {
      tenantId: string; months: number; monthlyAmount: number; actorUid: string; actorEmail: string;
    }) => adminService.recordManualSubscription(tenantId, { months, monthlyAmount }, actorUid, actorEmail),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
      queryClient.invalidateQueries({ queryKey: adminKeys.tenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
      queryClient.invalidateQueries({ queryKey: ["tenant-billing", tenantId] });
    },
  });
}

export function useCancelManualSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, actorUid, actorEmail }: {
      tenantId: string; actorUid: string; actorEmail: string;
    }) => adminService.cancelManualSubscription(tenantId, actorUid, actorEmail),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
      queryClient.invalidateQueries({ queryKey: adminKeys.tenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
      queryClient.invalidateQueries({ queryKey: ["tenant-billing", tenantId] });
    },
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

export function useDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, actorUid, actorEmail }: {
      tenantId: string; actorUid: string; actorEmail: string;
    }) => adminService.deleteTenant(tenantId, actorUid, actorEmail),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tenants() });
      queryClient.removeQueries({ queryKey: adminKeys.tenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
    },
  });
}

// ─── Tenant member hooks ─────────────────────────────────────────

export function useTenantMembers(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.tenantMembers(id!),
    queryFn: () => adminService.getTenantMembers(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

function useInvalidateTenantMembers() {
  const queryClient = useQueryClient();
  return (tenantId: string) => {
    queryClient.invalidateQueries({ queryKey: adminKeys.tenantMembers(tenantId) });
    queryClient.invalidateQueries({ queryKey: adminKeys.tenantStats(tenantId) });
    queryClient.invalidateQueries({ queryKey: adminKeys.auditLog() });
  };
}

export function useAddTenantMember() {
  const invalidate = useInvalidateTenantMembers();
  return useMutation({
    mutationFn: (params: {
      tenantId: string;
      tenantName: string;
      userEmail: string;
      role: TenantRole;
      modules?: ModulePermission[];
    }) => adminService.addTenantMember(params),
    onSuccess: (_, { tenantId }) => invalidate(tenantId),
  });
}

export function useUpdateTenantMember() {
  const invalidate = useInvalidateTenantMembers();
  return useMutation({
    mutationFn: (params: {
      tenantId: string;
      memberUid: string;
      role?: TenantRole;
      modules?: ModulePermission[];
    }) => adminService.updateTenantMember(params),
    onSuccess: (_, { tenantId }) => invalidate(tenantId),
  });
}

export function useRemoveTenantMember() {
  const invalidate = useInvalidateTenantMembers();
  return useMutation({
    mutationFn: (params: { tenantId: string; memberUid: string }) =>
      adminService.removeTenantMember(params),
    onSuccess: (_, { tenantId }) => invalidate(tenantId),
  });
}

export function useSendMemberPasswordReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { tenantId: string; memberUid: string }) =>
      adminService.sendTenantMemberPasswordReset(params),
    onSuccess: () => {
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

// ─── Contract template hooks ─────────────────────────────────────

export function useContractTemplates() {
  return useQuery({
    queryKey: adminKeys.contractTemplates(),
    queryFn: () => contractTemplateService.getAllTemplates(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateContractTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ContractTemplateInput) =>
      contractTemplateService.createTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.contractTemplates() });
    },
  });
}

export function useUpdateContractTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      updates,
    }: {
      templateId: string;
      updates: Partial<
        Pick<ContractTemplate, 'name' | 'description' | 'language' | 'bodyText' | 'active'>
      >;
    }) => contractTemplateService.updateTemplate(templateId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.contractTemplates() });
    },
  });
}

export function useDeleteContractTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (template: ContractTemplate) =>
      contractTemplateService.deleteTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.contractTemplates() });
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
