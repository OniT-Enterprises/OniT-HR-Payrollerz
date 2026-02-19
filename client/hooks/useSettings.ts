/**
 * React Query hooks for tenant settings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { settingsService } from '@/services/settingsService';
import { holidayService, type HolidayOverride } from '@/services/holidayService';
import type {
  TenantSettings,
  CompanyDetails,
  CompanyStructure,
  PaymentStructure,
  TimeOffPolicies,
  PayrollConfig,
} from '@/types/settings';

export const settingsKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'settings'] as const,
  detail: (tenantId: string) => [...settingsKeys.all(tenantId), 'detail'] as const,
  holidays: (tenantId: string) => [...settingsKeys.all(tenantId), 'holidays'] as const,
  holidayYear: (tenantId: string, year: number) => [...settingsKeys.holidays(tenantId), year] as const,
};

/**
 * Fetch tenant settings (creates default if not found)
 */
export function useSettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: settingsKeys.detail(tenantId),
    queryFn: async () => {
      let settings = await settingsService.getSettings(tenantId);
      if (!settings) {
        settings = await settingsService.createSettings(tenantId);
      }
      return settings;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!tenantId,
  });
}

/**
 * Fetch holiday overrides for a given year
 */
export function useHolidayOverrides(year: number) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: settingsKeys.holidayYear(tenantId, year),
    queryFn: () => holidayService.listTenantHolidayOverrides(tenantId, year),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!tenantId,
  });
}

/**
 * Update company details
 */
export function useUpdateCompanyDetails() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyDetails) =>
      settingsService.updateCompanyDetails(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.detail(tenantId) });
    },
  });
}

/**
 * Update company structure
 */
export function useUpdateCompanyStructure() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyStructure) =>
      settingsService.updateCompanyStructure(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.detail(tenantId) });
    },
  });
}

/**
 * Update payment structure
 */
export function useUpdatePaymentStructure() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PaymentStructure) =>
      settingsService.updatePaymentStructure(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.detail(tenantId) });
    },
  });
}

/**
 * Update time-off policies
 */
export function useUpdateTimeOffPolicies() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TimeOffPolicies) =>
      settingsService.updateTimeOffPolicies(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.detail(tenantId) });
    },
  });
}

/**
 * Update payroll config
 */
export function useUpdatePayrollConfig() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PayrollConfig) =>
      settingsService.updatePayrollConfig(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.detail(tenantId) });
    },
  });
}

/**
 * Upsert a holiday override
 */
export function useUpsertHolidayOverride() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ override, userId }: { override: Omit<HolidayOverride, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>; userId?: string }) =>
      holidayService.upsertTenantHolidayOverride(tenantId, override, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.holidays(tenantId) });
    },
  });
}

/**
 * Delete a holiday override
 */
export function useDeleteHolidayOverride() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      holidayService.deleteTenantHolidayOverride(tenantId, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.holidays(tenantId) });
    },
  });
}
