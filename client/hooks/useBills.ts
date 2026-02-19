/**
 * React Query hooks for bill data fetching
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { DocumentSnapshot } from 'firebase/firestore';
import { useTenantId } from '@/contexts/TenantContext';
import {
  billService,
  type BillFilters,
  type PaginatedResult,
} from '@/services/billService';
import type { Bill, BillFormData, BillPaymentFormData } from '@/types/money';

export const billKeys = {
  all: (tenantId: string) => ['bills', tenantId] as const,
  lists: (tenantId: string) => [...billKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: BillFilters) => [...billKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...billKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...billKeys.details(tenantId), id] as const,
  payments: (tenantId: string, billId: string) => [...billKeys.all(tenantId), 'payments', billId] as const,
};

export function useBills(filters: BillFilters = {}) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billKeys.list(tenantId, filters),
    queryFn: () => billService.getBills(tenantId, filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAllBills(maxResults: number = 500, enabled: boolean = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billKeys.list(tenantId, { pageSize: maxResults }),
    queryFn: () => billService.getBills(tenantId, { pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
    select: (data: PaginatedResult<Bill>) => data.data,
  });
}

export function useBill(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billKeys.detail(tenantId, id!),
    queryFn: () => billService.getBillById(tenantId, id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBillPayments(billId: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billKeys.payments(tenantId, billId!),
    queryFn: () => billService.getPaymentsForBill(tenantId, billId!),
    enabled: !!billId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (data: BillFormData) => billService.createBill(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all(tenantId) });
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BillFormData> }) =>
      billService.updateBill(tenantId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: billKeys.detail(tenantId, id) });
      queryClient.invalidateQueries({ queryKey: billKeys.lists(tenantId) });
    },
  });
}

export function useRecordBillPayment() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ billId, payment }: { billId: string; payment: BillPaymentFormData }) =>
      billService.recordPayment(tenantId, billId, payment),
    onSuccess: (_, { billId }) => {
      queryClient.invalidateQueries({ queryKey: billKeys.detail(tenantId, billId) });
      queryClient.invalidateQueries({ queryKey: billKeys.payments(tenantId, billId) });
      queryClient.invalidateQueries({ queryKey: billKeys.lists(tenantId) });
    },
  });
}

/**
 * Server-side paginated bills using infinite query
 */
export function usePaginatedBills(
  filters: Omit<BillFilters, 'startAfterDoc'> = {}
) {
  const tenantId = useTenantId();
  return useInfiniteQuery({
    queryKey: [...billKeys.lists(tenantId), 'paginated', filters] as const,
    queryFn: async ({ pageParam }) => {
      return billService.getBills(tenantId, {
        ...filters,
        startAfterDoc: pageParam as DocumentSnapshot | undefined,
      });
    },
    initialPageParam: undefined as DocumentSnapshot | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.lastDoc : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Helper hook to flatten paginated bill results
 */
export function useFlattenedPaginatedBills(
  filters: Omit<BillFilters, 'startAfterDoc'> = {}
) {
  const query = usePaginatedBills(filters);
  return {
    ...query,
    bills: query.data?.pages.flatMap(page => page.data) ?? [],
    totalLoaded: query.data?.pages.reduce((sum, page) => sum + page.data.length, 0) ?? 0,
  };
}
