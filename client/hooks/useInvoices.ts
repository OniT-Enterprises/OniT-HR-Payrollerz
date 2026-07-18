/**
 * React Query hooks for invoice data fetching
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { DocumentSnapshot } from 'firebase/firestore';
import { useTenantId } from '@/contexts/TenantContext';
import {
  invoiceService,
  type InvoiceFilters,
  type PaginatedResult,
} from '@/services/invoiceService';
import type { Invoice, InvoiceFormData, InvoiceSettings, InvoiceTemplateId } from '@/types/money';
import { SEARCH_FETCH_LIMIT } from '@/lib/queryCache';

export const invoiceKeys = {
  all: (tenantId: string) => ['invoices', tenantId] as const,
  lists: (tenantId: string) => [...invoiceKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: InvoiceFilters) => [...invoiceKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...invoiceKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...invoiceKeys.details(tenantId), id] as const,
  topCustomers: (tenantId: string, maxResults: number) => [...invoiceKeys.all(tenantId), 'topCustomers', maxResults] as const,
};

function useAllInvoices(
  maxResults: number = SEARCH_FETCH_LIMIT,
  enabled: boolean = true,
  filters: Omit<InvoiceFilters, 'pageSize' | 'startAfterDoc'> = {},
) {
  const tenantId = useTenantId();
  const queryFilters = { ...filters, pageSize: maxResults };
  return useQuery({
    queryKey: invoiceKeys.list(tenantId, queryFilters),
    queryFn: () => invoiceService.getInvoices(tenantId, queryFilters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all(tenantId) });
    },
  });
}

/** Presentation-only template switch — allowed on sent invoices too */
export function useUpdateInvoiceTemplate() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, templateId }: { id: string; templateId: InvoiceTemplateId }) =>
      invoiceService.updateInvoiceTemplate(tenantId, id, templateId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(tenantId, id) });
    },
  });
}

/** Payments recorded against one invoice (for the view screen history) */
export function useInvoicePayments(invoiceId: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...invoiceKeys.detail(tenantId, invoiceId!), 'payments'] as const,
    queryFn: () => invoiceService.getPaymentsForInvoice(tenantId, invoiceId!),
    enabled: !!invoiceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvoiceStats(enabled: boolean = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...invoiceKeys.all(tenantId), 'stats'] as const,
    queryFn: () => invoiceService.getStats(tenantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}

export function useInvoiceTopCustomers(maxResults: number = 6, enabled: boolean = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: invoiceKeys.topCustomers(tenantId, maxResults),
    queryFn: () => invoiceService.getTopCustomersByOutstanding(tenantId, maxResults),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}

export function useInvoiceSettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['invoiceSettings', tenantId],
    queryFn: (): Promise<Partial<InvoiceSettings>> => invoiceService.getSettings(tenantId),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Server-side paginated invoices using infinite query
 */
function usePaginatedInvoices(
  filters: Omit<InvoiceFilters, 'startAfterDoc'> = {},
  enabled: boolean = true,
) {
  const tenantId = useTenantId();
  return useInfiniteQuery({
    queryKey: [...invoiceKeys.lists(tenantId), 'paginated', filters] as const,
    queryFn: async ({ pageParam }) => {
      return invoiceService.getInvoices(tenantId, {
        ...filters,
        startAfterDoc: pageParam as DocumentSnapshot | undefined,
      });
    },
    initialPageParam: undefined as DocumentSnapshot | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.lastDoc : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}

/**
 * Helper hook to flatten paginated invoice results
 */
function useFlattenedPaginatedInvoices(
  filters: Omit<InvoiceFilters, 'startAfterDoc'> = {},
  enabled: boolean = true,
) {
  const query = usePaginatedInvoices(filters, enabled);
  return {
    ...query,
    invoices: query.data?.pages.flatMap(page => page.data) ?? [],
    totalLoaded: query.data?.pages.reduce((sum, page) => sum + page.data.length, 0) ?? 0,
  };
}

/**
 * Combined hook that switches between paginated browsing and full-fetch searching.
 * Only one query is active at a time (via `enabled`), preventing the memory leak
 * of keeping a 500-item cache mounted alongside an infinite query.
 */
export function useSmartInvoices(
  isSearching: boolean,
  filters: Omit<InvoiceFilters, 'pageSize' | 'startAfterDoc'> = {},
) {
  const paginatedQuery = useFlattenedPaginatedInvoices(filters, !isSearching);
  const allQuery = useAllInvoices(SEARCH_FETCH_LIMIT, isSearching, filters);

  return {
    invoices: isSearching ? (allQuery.data ?? []) : paginatedQuery.invoices,
    totalLoaded: isSearching ? (allQuery.data?.length ?? 0) : paginatedQuery.totalLoaded,
    isLoading: isSearching ? allQuery.isLoading : paginatedQuery.isLoading,
    error: isSearching ? allQuery.error : paginatedQuery.error,
    refetch: isSearching ? allQuery.refetch : paginatedQuery.refetch,
    fetchNextPage: paginatedQuery.fetchNextPage,
    hasNextPage: isSearching ? false : (paginatedQuery.hasNextPage ?? false),
    isFetchingNextPage: isSearching ? false : paginatedQuery.isFetchingNextPage,
    searchLimitReached: isSearching && (allQuery.data?.length ?? 0) >= SEARCH_FETCH_LIMIT,
  };
}
