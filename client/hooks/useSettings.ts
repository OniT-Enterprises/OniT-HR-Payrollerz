/**
 * React Query hooks for tenant settings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { settingsService } from '@/services/settingsService';
import type { CompanyDetails, CompanyStructure, PaymentStructure, PayrollConfig } from '@/services/settingsService';
import type { AuditContext } from '@/services/employeeService';

export const settingsKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'settings'] as const,
};

/** Fetch tenant settings */
export function useSettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: settingsKeys.all(tenantId),
    queryFn: () => settingsService.getSettings(tenantId),
    staleTime: 10 * 60 * 1000, // Settings change rarely
    gcTime: 60 * 60 * 1000,
  });
}

/** Update company details */
export function useUpdateCompanyDetails() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ companyDetails, audit }: { companyDetails: CompanyDetails; audit?: AuditContext }) =>
      settingsService.updateCompanyDetails(tenantId, companyDetails, audit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenantId) });
    },
  });
}

/** Update company structure */
export function useUpdateCompanyStructure() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (companyStructure: CompanyStructure) =>
      settingsService.updateCompanyStructure(tenantId, companyStructure),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenantId) });
    },
  });
}

/** Update payment structure */
export function useUpdatePaymentStructure() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (paymentStructure: Partial<PaymentStructure>) =>
      settingsService.updatePaymentStructure(tenantId, paymentStructure),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenantId) });
    },
  });
}

/** Update payroll config */
export function useUpdatePayrollConfig() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ payrollConfig, audit }: { payrollConfig: Partial<PayrollConfig>; audit?: AuditContext }) =>
      settingsService.updatePayrollConfig(tenantId, payrollConfig, audit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all(tenantId) });
    },
  });
}
