/**
 * React Query hooks for employee data fetching
 * Provides caching, background refetching, and optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  employeeService,
  type Employee,
  type EmployeeFilters,
  type PaginatedResult,
} from '@/services/employeeService';

// Query keys for cache management
export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (filters: EmployeeFilters) => [...employeeKeys.lists(), filters] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
  counts: () => [...employeeKeys.all, 'counts'] as const,
};

/**
 * Fetch all employees with optional filters
 * Uses React Query for caching and background refetching
 */
export function useEmployees(filters: EmployeeFilters = {}) {
  return useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: () => employeeService.getEmployees(filters),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

/**
 * Fetch all employees (convenience hook for components that need all data)
 * Fetches a large batch for client-side filtering
 */
export function useAllEmployees(maxResults: number = 500) {
  return useQuery({
    queryKey: employeeKeys.list({ pageSize: maxResults }),
    queryFn: () => employeeService.getEmployees({ pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Employee>) => data.data, // Return just the array
  });
}

/**
 * Fetch a single employee by ID
 */
export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(id!),
    queryFn: () => employeeService.getEmployeeById(id!),
    enabled: !!id, // Only run query if ID is provided
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch employee counts by status
 */
export function useEmployeeCounts() {
  return useQuery({
    queryKey: employeeKeys.counts(),
    queryFn: () => employeeService.getEmployeeCounts(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation for adding a new employee
 */
export function useAddEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employee: Omit<Employee, 'id'>) =>
      employeeService.addEmployee(employee),
    onSuccess: () => {
      // Invalidate all employee queries to refetch
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

/**
 * Mutation for updating an employee
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Employee> }) =>
      employeeService.updateEmployee(id, updates),
    onSuccess: (_, { id }) => {
      // Invalidate specific employee and lists
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

/**
 * Mutation for deleting an employee
 */
export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => employeeService.deleteEmployee(id),
    onSuccess: () => {
      // Invalidate all employee queries
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

/**
 * Prefetch employees (useful for preloading data)
 */
export function usePrefetchEmployees(queryClient: ReturnType<typeof useQueryClient>) {
  return (filters: EmployeeFilters = {}) => {
    queryClient.prefetchQuery({
      queryKey: employeeKeys.list(filters),
      queryFn: () => employeeService.getEmployees(filters),
      staleTime: 5 * 60 * 1000,
    });
  };
}
