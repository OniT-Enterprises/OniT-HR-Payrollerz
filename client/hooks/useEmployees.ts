/**
 * React Query hooks for employee data fetching
 * Provides caching, background refetching, and optimistic updates
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { DocumentSnapshot } from 'firebase/firestore';
import { useTenantId } from '@/contexts/TenantContext';
import {
  employeeService,
  type Employee,
  type EmployeeFilters,
  type PaginatedResult,
} from '@/services/employeeService';
import { SEARCH_FETCH_LIMIT } from '@/lib/queryCache';

// Query keys for cache management
export const employeeKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'employees'] as const,
  lists: (tenantId: string) => [...employeeKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: EmployeeFilters) => [...employeeKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...employeeKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...employeeKeys.details(tenantId), id] as const,
  counts: (tenantId: string) => [...employeeKeys.all(tenantId), 'counts'] as const,
};

/**
 * Fetch all employees with optional filters
 * Uses React Query for caching and background refetching
 */
export function useEmployees(filters: EmployeeFilters = {}) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: employeeKeys.list(tenantId, filters),
    queryFn: () => employeeService.getEmployees(tenantId, filters),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}


/**
 * Fetch all employees (convenience hook for components that need all data)
 * Fetches a large batch for client-side filtering
 */
export function useAllEmployees(maxResults: number = SEARCH_FETCH_LIMIT, enabled: boolean = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: employeeKeys.list(tenantId, { pageSize: maxResults }),
    queryFn: () => employeeService.getEmployees(tenantId, { pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
    select: (data: PaginatedResult<Employee>) => data.data, // Return just the array
  });
}

/**
 * Fetch a single employee by ID
 */
export function useEmployee(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: employeeKeys.detail(tenantId, id!),
    queryFn: () => employeeService.getEmployeeById(tenantId, id!),
    enabled: !!id, // Only run query if ID is provided
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch employee counts by status
 */
export function useEmployeeCounts() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: employeeKeys.counts(tenantId),
    queryFn: () => employeeService.getEmployeeCounts(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation for adding a new employee
 */
export function useAddEmployee() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (employee: Omit<Employee, 'id'>) =>
      employeeService.addEmployee(tenantId, employee),
    onSuccess: () => {
      // Invalidate all employee queries to refetch
      queryClient.invalidateQueries({ queryKey: employeeKeys.all(tenantId) });
    },
  });
}

/**
 * Mutation for updating an employee
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Employee> }) =>
      employeeService.updateEmployee(tenantId, id, updates),
    onSuccess: (_, { id }) => {
      // Invalidate specific employee and lists
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(tenantId, id) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists(tenantId) });
    },
  });
}

/**
 * Mutation for terminating (soft-deleting) an employee
 * Sets status to "terminated" instead of destroying the document,
 * preserving references in payroll history, journal entries, and tax reports.
 */
export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (id: string) => employeeService.deleteEmployee(tenantId, id),
    onSuccess: () => {
      // Invalidate all employee queries
      queryClient.invalidateQueries({ queryKey: employeeKeys.all(tenantId) });
    },
  });
}

/**
 * Prefetch employees (useful for preloading data)
 */
export function usePrefetchEmployees(queryClient: ReturnType<typeof useQueryClient>) {
  const tenantId = useTenantId();
  return (filters: EmployeeFilters = {}) => {
    queryClient.prefetchQuery({
      queryKey: employeeKeys.list(tenantId, filters),
      queryFn: () => employeeService.getEmployees(tenantId, filters),
      staleTime: 5 * 60 * 1000,
    });
  };
}

/**
 * Server-side paginated employees using infinite query
 * Ideal for large datasets - only fetches data as needed
 *
 * Usage:
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaginatedEmployees({
 *   pageSize: 20,
 *   department: 'Engineering',
 *   status: 'active'
 * });
 *
 * // Flatten pages into single array
 * const employees = data?.pages.flatMap(page => page.data) ?? [];
 */
export function usePaginatedEmployees(
  filters: Omit<EmployeeFilters, 'startAfterDoc'> = {},
  enabled: boolean = true,
) {
  const tenantId = useTenantId();
  return useInfiniteQuery({
    queryKey: [...employeeKeys.lists(tenantId), 'paginated', filters] as const,
    queryFn: async ({ pageParam }) => {
      return employeeService.getEmployees(tenantId, {
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
 * Helper hook to flatten paginated results into a single array
 * Returns employees array plus pagination controls
 */
export function useFlattenedPaginatedEmployees(
  filters: Omit<EmployeeFilters, 'startAfterDoc'> = {},
  enabled: boolean = true,
) {
  const query = usePaginatedEmployees(filters, enabled);

  return {
    ...query,
    // Flatten all pages into single array
    employees: query.data?.pages.flatMap(page => page.data) ?? [],
    // Total count across all loaded pages
    totalLoaded: query.data?.pages.reduce((sum, page) => sum + page.data.length, 0) ?? 0,
  };
}

/**
 * Combined hook that switches between paginated browsing and full-fetch searching.
 * Only one query is active at a time (via `enabled`), preventing memory waste.
 */
export function useSmartEmployees(isSearching: boolean) {
  const paginatedQuery = useFlattenedPaginatedEmployees({}, !isSearching);
  const allQuery = useAllEmployees(SEARCH_FETCH_LIMIT, isSearching);

  return {
    employees: isSearching ? (allQuery.data ?? []) : paginatedQuery.employees,
    totalLoaded: isSearching ? (allQuery.data?.length ?? 0) : paginatedQuery.totalLoaded,
    isLoading: isSearching ? allQuery.isLoading : paginatedQuery.isLoading,
    error: isSearching ? allQuery.error : paginatedQuery.error,
    refetch: isSearching ? allQuery.refetch : paginatedQuery.refetch,
    fetchNextPage: paginatedQuery.fetchNextPage,
    hasNextPage: isSearching ? false : (paginatedQuery.hasNextPage ?? false),
    isFetchingNextPage: isSearching ? false : paginatedQuery.isFetchingNextPage,
    /** True when search results may be truncated at the fetch limit */
    searchLimitReached: isSearching && (allQuery.data?.length ?? 0) >= SEARCH_FETCH_LIMIT,
  };
}
