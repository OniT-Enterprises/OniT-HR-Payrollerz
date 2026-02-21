/**
 * React Query hooks for vendor data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import {
  vendorService,
  type VendorFilters,
  type PaginatedResult,
} from '@/services/vendorService';
import type { Vendor, VendorFormData } from '@/types/money';

export const vendorKeys = {
  all: (tenantId: string) => ['vendors', tenantId] as const,
  lists: (tenantId: string) => [...vendorKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters: VendorFilters) => [...vendorKeys.lists(tenantId), filters] as const,
  details: (tenantId: string) => [...vendorKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...vendorKeys.details(tenantId), id] as const,
};

export function useVendors(filters: VendorFilters = {}) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: vendorKeys.list(tenantId, filters),
    queryFn: () => vendorService.getVendors(tenantId, filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

const SEARCH_FETCH_LIMIT = 2000;

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

export function useVendor(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: vendorKeys.detail(tenantId, id!),
    queryFn: () => vendorService.getVendorById(tenantId, id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (data: VendorFormData) => vendorService.createVendor(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all(tenantId) });
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VendorFormData> }) =>
      vendorService.updateVendor(tenantId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(tenantId, id) });
      queryClient.invalidateQueries({ queryKey: vendorKeys.lists(tenantId) });
    },
  });
}
