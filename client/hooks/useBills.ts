/**
 * React Query hooks for bill data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  billService,
  type BillFilters,
  type PaginatedResult,
} from '@/services/billService';
import type { Bill, BillFormData, BillPaymentFormData } from '@/types/money';

export const billKeys = {
  all: ['bills'] as const,
  lists: () => [...billKeys.all, 'list'] as const,
  list: (filters: BillFilters) => [...billKeys.lists(), filters] as const,
  details: () => [...billKeys.all, 'detail'] as const,
  detail: (id: string) => [...billKeys.details(), id] as const,
  payments: (billId: string) => [...billKeys.all, 'payments', billId] as const,
};

export function useBills(filters: BillFilters = {}) {
  return useQuery({
    queryKey: billKeys.list(filters),
    queryFn: () => billService.getBills(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAllBills(maxResults: number = 500) {
  return useQuery({
    queryKey: billKeys.list({ pageSize: maxResults }),
    queryFn: () => billService.getBills({ pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Bill>) => data.data,
  });
}

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: billKeys.detail(id!),
    queryFn: () => billService.getBillById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBillPayments(billId: string | undefined) {
  return useQuery({
    queryKey: billKeys.payments(billId!),
    queryFn: () => billService.getPaymentsForBill(billId!),
    enabled: !!billId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BillFormData) => billService.createBill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.all });
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BillFormData> }) =>
      billService.updateBill(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: billKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: billKeys.lists() });
    },
  });
}

export function useRecordBillPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ billId, payment }: { billId: string; payment: BillPaymentFormData }) =>
      billService.recordPayment(billId, payment),
    onSuccess: (_, { billId }) => {
      queryClient.invalidateQueries({ queryKey: billKeys.detail(billId) });
      queryClient.invalidateQueries({ queryKey: billKeys.payments(billId) });
      queryClient.invalidateQueries({ queryKey: billKeys.lists() });
    },
  });
}
