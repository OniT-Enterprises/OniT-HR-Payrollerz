/**
 * React Query hooks for shift scheduling data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import {
  shiftService,
  type ShiftSlot,
  type ShiftWrite,
} from '@/services/shiftService';

const shiftKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'shifts'] as const,
  byRange: (tenantId: string, start: string, end: string, departmentId?: string) =>
    [...shiftKeys.all(tenantId), 'range', start, end, departmentId ?? 'all'] as const,
  slots: (tenantId: string) => ['tenants', tenantId, 'shiftSlots'] as const,
};

/**
 * Fetch shifts for a date range (typically a week)
 */
export function useShiftsByRange(
  startDate: string,
  endDate: string,
  enabled = true,
  departmentId?: string,
) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: shiftKeys.byRange(tenantId, startDate, endDate, departmentId),
    queryFn: () => shiftService.getShiftsByDateRange(tenantId, startDate, endDate, departmentId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!tenantId && !!startDate && !!endDate && enabled,
  });
}

/**
 * Fetch the tenant's shift slot configuration (Morning/Afternoon/Night)
 */
export function useShiftSlots() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: shiftKeys.slots(tenantId),
    queryFn: () => shiftService.getShiftSlots(tenantId),
    staleTime: 5 * 60 * 1000,
    enabled: !!tenantId,
  });
}

/**
 * Persist the tenant's shift slot configuration
 */
export function useSaveShiftSlots() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slots: ShiftSlot[]) => shiftService.saveShiftSlots(tenantId, slots),
    onSuccess: (_, slots) => {
      queryClient.setQueryData(shiftKeys.slots(tenantId), slots);
    },
  });
}

/**
 * Copy a week's shifts to the following week as drafts
 */
export function useCopyWeekShifts() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ startDate, endDate, createdBy, departmentId }: { startDate: string; endDate: string; createdBy: string; departmentId?: string }) =>
      shiftService.copyWeekToNext(tenantId, startDate, endDate, createdBy, departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all(tenantId) });
    },
  });
}

/**
 * Create a new shift
 */
export function useCreateShift() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ShiftWrite) =>
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
    mutationFn: ({ shiftId, data }: { shiftId: string; data: ShiftWrite }) =>
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
    mutationFn: ({ startDate, endDate, departmentId }: { startDate: string; endDate: string; departmentId?: string }) =>
      shiftService.publishDraftShifts(tenantId, startDate, endDate, departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all(tenantId) });
    },
  });
}
