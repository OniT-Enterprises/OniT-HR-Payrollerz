/**
 * React Query hooks for recurring invoice data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { recurringInvoiceService } from '@/services/recurringInvoiceService';
import type { RecurringInvoiceFormData } from '@/services/recurringInvoiceService';
import { invoiceKeys } from './useInvoices';

export const recurringInvoiceKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'recurringInvoices'] as const,
  lists: (tenantId: string) => [...recurringInvoiceKeys.all(tenantId), 'list'] as const,
  details: (tenantId: string) => [...recurringInvoiceKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...recurringInvoiceKeys.details(tenantId), id] as const,
};

export function useRecurringInvoices() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: recurringInvoiceKeys.lists(tenantId),
    queryFn: () => recurringInvoiceService.getAll(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecurringInvoice(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: recurringInvoiceKeys.detail(tenantId, id!),
    queryFn: () => recurringInvoiceService.getById(tenantId, id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRecurringInvoice() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (data: RecurringInvoiceFormData) =>
      recurringInvoiceService.create(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all(tenantId) });
    },
  });
}

export function useUpdateRecurringInvoice() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RecurringInvoiceFormData> }) =>
      recurringInvoiceService.update(tenantId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all(tenantId) });
    },
  });
}

export function usePauseRecurringInvoice() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => recurringInvoiceService.pause(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all(tenantId) });
    },
  });
}

export function useResumeRecurringInvoice() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => recurringInvoiceService.resume(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all(tenantId) });
    },
  });
}

export function useDeleteRecurringInvoice() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => recurringInvoiceService.delete(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all(tenantId) });
    },
  });
}

export function useGenerateFromRecurring() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (recurringId: string) =>
      recurringInvoiceService.generateInvoice(tenantId, recurringId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all(tenantId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all(tenantId) });
    },
  });
}
