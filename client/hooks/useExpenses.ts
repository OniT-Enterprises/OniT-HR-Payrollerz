/**
 * React Query hooks for expense data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  expenseService,
  type ExpenseFilters,
  type PaginatedResult,
} from '@/services/expenseService';
import type { Expense, ExpenseFormData } from '@/types/money';

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (filters: ExpenseFilters) => [...expenseKeys.lists(), filters] as const,
  details: () => [...expenseKeys.all, 'detail'] as const,
  detail: (id: string) => [...expenseKeys.details(), id] as const,
};

export function useExpenses(filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: expenseKeys.list(filters),
    queryFn: () => expenseService.getExpenses(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAllExpenses(maxResults: number = 500) {
  return useQuery({
    queryKey: expenseKeys.list({ pageSize: maxResults }),
    queryFn: () => expenseService.getExpenses({ pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Expense>) => data.data,
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: expenseKeys.detail(id!),
    queryFn: () => expenseService.getExpenseById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExpenseFormData & { receiptUrl?: string }) =>
      expenseService.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseFormData> & { receiptUrl?: string } }) =>
      expenseService.updateExpense(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expenseService.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}
