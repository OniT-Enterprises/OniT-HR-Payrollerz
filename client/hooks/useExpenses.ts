/**
 * React Query hooks for expense data fetching
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { DocumentSnapshot } from 'firebase/firestore';
import { useTenantId } from '@/contexts/TenantContext';
import {
  expenseService,
  type ExpenseFilters,
  type PaginatedResult,
} from '@/services/expenseService';
import type { Expense, ExpenseFormData } from '@/types/money';

export const expenseKeys = {
  all: (tenantId: string) => ['expenses', tenantId] as const,
  lists: (tenantId: string) => [...expenseKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: ExpenseFilters) => [...expenseKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...expenseKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...expenseKeys.details(tenantId), id] as const,
};

export function useExpenses(filters: ExpenseFilters = {}) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: expenseKeys.list(tenantId, filters),
    queryFn: () => expenseService.getExpenses(tenantId, filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAllExpenses(maxResults: number = 500, enabled: boolean = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: expenseKeys.list(tenantId, { pageSize: maxResults }),
    queryFn: () => expenseService.getExpenses(tenantId, { pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
    select: (data: PaginatedResult<Expense>) => data.data,
  });
}

export function useExpense(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: expenseKeys.detail(tenantId, id!),
    queryFn: () => expenseService.getExpenseById(tenantId, id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (data: ExpenseFormData & { receiptUrl?: string }) =>
      expenseService.createExpense(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all(tenantId) });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseFormData> & { receiptUrl?: string } }) =>
      expenseService.updateExpense(tenantId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(tenantId, id) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists(tenantId) });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (id: string) => expenseService.deleteExpense(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all(tenantId) });
    },
  });
}

/**
 * Server-side paginated expenses using infinite query
 */
export function usePaginatedExpenses(
  filters: Omit<ExpenseFilters, 'startAfterDoc'> = {}
) {
  const tenantId = useTenantId();
  return useInfiniteQuery({
    queryKey: [...expenseKeys.lists(tenantId), 'paginated', filters] as const,
    queryFn: async ({ pageParam }) => {
      return expenseService.getExpenses(tenantId, {
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
 * Helper hook to flatten paginated expense results
 */
export function useFlattenedPaginatedExpenses(
  filters: Omit<ExpenseFilters, 'startAfterDoc'> = {}
) {
  const query = usePaginatedExpenses(filters);
  return {
    ...query,
    expenses: query.data?.pages.flatMap(page => page.data) ?? [],
    totalLoaded: query.data?.pages.reduce((sum, page) => sum + page.data.length, 0) ?? 0,
  };
}
