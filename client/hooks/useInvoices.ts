/**
 * React Query hooks for invoice data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import {
  invoiceService,
  type InvoiceFilters,
  type PaginatedResult,
} from '@/services/invoiceService';
import type { Invoice, InvoiceFormData } from '@/types/money';

export const invoiceKeys = {
  all: (tenantId: string) => ['invoices', tenantId] as const,
  lists: (tenantId: string) => [...invoiceKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: InvoiceFilters) => [...invoiceKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...invoiceKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...invoiceKeys.details(tenantId), id] as const,
};

export function useInvoices(filters: InvoiceFilters = {}) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: invoiceKeys.list(tenantId, filters),
    queryFn: () => invoiceService.getInvoices(tenantId, filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAllInvoices(maxResults: number = 500) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: invoiceKeys.list(tenantId, { pageSize: maxResults }),
    queryFn: () => invoiceService.getInvoices(tenantId, { pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Invoice>) => data.data,
  });
}

export function useInvoice(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: invoiceKeys.detail(tenantId, id!),
    queryFn: () => invoiceService.getInvoiceById(tenantId, id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (data: InvoiceFormData) => invoiceService.createInvoice(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all(tenantId) });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InvoiceFormData> }) =>
      invoiceService.updateInvoice(tenantId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(tenantId, id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists(tenantId) });
    },
  });
}

export function useInvoiceSettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['invoiceSettings', tenantId],
    queryFn: () => invoiceService.getSettings(tenantId).catch(() => ({})),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
