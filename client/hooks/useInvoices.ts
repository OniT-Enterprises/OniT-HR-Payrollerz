/**
 * React Query hooks for invoice data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invoiceService,
  type InvoiceFilters,
  type PaginatedResult,
} from '@/services/invoiceService';
import type { Invoice, InvoiceFormData, InvoiceStatus } from '@/types/money';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
};

export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => invoiceService.getInvoices(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAllInvoices(maxResults: number = 500) {
  return useQuery({
    queryKey: invoiceKeys.list({ pageSize: maxResults }),
    queryFn: () => invoiceService.getInvoices({ pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Invoice>) => data.data,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: invoiceKeys.detail(id!),
    queryFn: () => invoiceService.getInvoiceById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InvoiceFormData) => invoiceService.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InvoiceFormData> }) =>
      invoiceService.updateInvoice(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}
