/**
 * React Query hooks for vendor data fetching
 */

import { useQuery } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import {
  vendorService,
  type VendorFilters,
  type PaginatedResult,
} from '@/services/vendorService';
import type { Vendor } from '@/types/money';
import { SEARCH_FETCH_LIMIT } from '@/lib/queryCache';

export const vendorKeys = {
  all: (tenantId: string) => ['vendors', tenantId] as const,
  lists: (tenantId: string) => [...vendorKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: VendorFilters) => [...vendorKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...vendorKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...vendorKeys.details(tenantId), id] as const,
};

export function useAllVendors(maxResults: number = SEARCH_FETCH_LIMIT) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: vendorKeys.list(tenantId, { pageSize: maxResults }),
    queryFn: () => vendorService.getVendors(tenantId, { pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Vendor>) => data.data,
  });
}

export function useActiveVendors() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: vendorKeys.list(tenantId, { isActive: true }),
    queryFn: () => vendorService.getVendors(tenantId, { isActive: true, pageSize: SEARCH_FETCH_LIMIT }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Vendor>) => data.data,
  });
}

