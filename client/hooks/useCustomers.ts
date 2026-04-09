/**
 * React Query hooks for customer data fetching
 */

import { useQuery } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import {
  customerService,
  type CustomerFilters,
  type PaginatedResult,
} from '@/services/customerService';
import type { Customer } from '@/types/money';
import { SEARCH_FETCH_LIMIT } from '@/lib/queryCache';

export const customerKeys = {
  all: (tenantId: string) => ['customers', tenantId] as const,
  lists: (tenantId: string) => [...customerKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: CustomerFilters) =>
    [...customerKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...customerKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...customerKeys.details(tenantId), id] as const,
};

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

