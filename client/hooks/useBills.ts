/**
 * React Query hooks for bill data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useAllBills(maxResults: number = 500) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: billKeys.list(tenantId, { pageSize: maxResults }),
    queryFn: () => billService.getBills(tenantId, { pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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
