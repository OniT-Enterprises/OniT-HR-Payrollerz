/**
 * React Query hooks for customer data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import {
  customerService,
  type CustomerFilters,
  type PaginatedResult,
} from '@/services/customerService';
import type { Customer, CustomerFormData } from '@/types/money';
import { SEARCH_FETCH_LIMIT } from '@/lib/queryCache';

export const customerKeys = {
  all: (tenantId: string) => ['customers', tenantId] as const,
  lists: (tenantId: string) => [...customerKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: CustomerFilters) =>
    [...customerKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...customerKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...customerKeys.details(tenantId), id] as const,
};

export function useCustomers(filters: CustomerFilters = {}) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: customerKeys.list(tenantId, filters),
    queryFn: () => customerService.getCustomers(tenantId, filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAllCustomers(maxResults: number = SEARCH_FETCH_LIMIT) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: customerKeys.list(tenantId, { pageSize: maxResults }),
    queryFn: () => customerService.getCustomers(tenantId, { pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Customer>) => data.data,
  });
}

export function useActiveCustomers() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: customerKeys.list(tenantId, { isActive: true }),
    queryFn: () => customerService.getCustomers(tenantId, { isActive: true, pageSize: SEARCH_FETCH_LIMIT }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Customer>) => data.data,
  });
}

export function useCustomer(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: customerKeys.detail(tenantId, id!),
    queryFn: () => customerService.getCustomerById(tenantId, id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (data: CustomerFormData) => customerService.createCustomer(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all(tenantId) });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerFormData> }) =>
      customerService.updateCustomer(tenantId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(tenantId, id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists(tenantId) });
    },
  });
}
