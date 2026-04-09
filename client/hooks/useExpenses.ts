/**
 * React Query hooks for expense data fetching
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { DocumentSnapshot } from 'firebase/firestore';
import { useTenantId } from '@/contexts/TenantContext';
import {
  expenseService,
  type ExpenseFilters,
  type PaginatedResult,
} from '@/services/expenseService';
import type { Expense } from '@/types/money';
import { SEARCH_FETCH_LIMIT } from '@/lib/queryCache';

export const expenseKeys = {
  all: (tenantId: string) => ['expenses', tenantId] as const,
  lists: (tenantId: string) => [...expenseKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: ExpenseFilters) => [...expenseKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...expenseKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...expenseKeys.details(tenantId), id] as const,
};

function useAllExpenses(maxResults: number = SEARCH_FETCH_LIMIT, enabled: boolean = true) {
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

/**
 * Server-side paginated expenses using infinite query
 */
function usePaginatedExpenses(
  filters: Omit<ExpenseFilters, 'startAfterDoc'> = {},
  enabled: boolean = true,
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
    enabled,
  });
}

/**
 * Helper hook to flatten paginated expense results
 */
function useFlattenedPaginatedExpenses(
  filters: Omit<ExpenseFilters, 'startAfterDoc'> = {},
  enabled: boolean = true,
) {
  const query = usePaginatedExpenses(filters, enabled);
  return {
    ...query,
    expenses: query.data?.pages.flatMap(page => page.data) ?? [],
    totalLoaded: query.data?.pages.reduce((sum, page) => sum + page.data.length, 0) ?? 0,
  };
}

/**
 * Combined hook that switches between paginated browsing and full-fetch searching.
 * Only one query is active at a time (via `enabled`), preventing the memory leak
 * of keeping a 500-item cache mounted alongside an infinite query.
 */
export function useSmartExpenses(isSearching: boolean) {
  const paginatedQuery = useFlattenedPaginatedExpenses({}, !isSearching);
  const allQuery = useAllExpenses(SEARCH_FETCH_LIMIT, isSearching);

  return {
    expenses: isSearching ? (allQuery.data ?? []) : paginatedQuery.expenses,
    totalLoaded: isSearching ? (allQuery.data?.length ?? 0) : paginatedQuery.totalLoaded,
    isLoading: isSearching ? allQuery.isLoading : paginatedQuery.isLoading,
    refetch: isSearching ? allQuery.refetch : paginatedQuery.refetch,
    fetchNextPage: paginatedQuery.fetchNextPage,
    hasNextPage: isSearching ? false : (paginatedQuery.hasNextPage ?? false),
    isFetchingNextPage: isSearching ? false : paginatedQuery.isFetchingNextPage,
    searchLimitReached: isSearching && (allQuery.data?.length ?? 0) >= SEARCH_FETCH_LIMIT,
  };
}
