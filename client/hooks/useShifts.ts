/**
 * React Query hooks for shift scheduling data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { shiftService, type ShiftRecord } from '@/services/shiftService';

export const shiftKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'shifts'] as const,
  byRange: (tenantId: string, start: string, end: string) =>
    [...shiftKeys.all(tenantId), 'range', start, end] as const,
  templates: (tenantId: string) => ['tenants', tenantId, 'shiftTemplates'] as const,
};

/**
 * Fetch shifts for a date range (typically a week)
 */
export function useShiftsByRange(startDate: string, endDate: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: shiftKeys.byRange(tenantId, startDate, endDate),
    queryFn: () => shiftService.getShiftsByDateRange(tenantId, startDate, endDate),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!tenantId && !!startDate && !!endDate,
  });
}

/**
 * Fetch shift templates
 */
export function useShiftTemplates() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: shiftKeys.templates(tenantId),
    queryFn: () => shiftService.getTemplates(tenantId),
    staleTime: 5 * 60 * 1000,
    enabled: !!tenantId,
  });
}

/**
 * Create a new shift
 */
export function useCreateShift() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ShiftRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) =>
      shiftService.createShift(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all(tenantId) });
    },
  });
}

/**
 * Update a shift
 */
export function useUpdateShift() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, data }: { shiftId: string; data: Partial<ShiftRecord> }) =>
      shiftService.updateShift(tenantId, shiftId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all(tenantId) });
    },
  });
}

/**
 * Delete a shift
 */
export function useDeleteShift() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shiftId: string) => shiftService.deleteShift(tenantId, shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all(tenantId) });
    },
  });
}

/**
 * Publish all draft shifts for a week
 */
export function usePublishDraftShifts() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ startDate, endDate }: { startDate: string; endDate: string }) =>
      shiftService.publishDraftShifts(tenantId, startDate, endDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all(tenantId) });
    },
  });
}
