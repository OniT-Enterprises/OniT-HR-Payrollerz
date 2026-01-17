/**
 * React Query hooks for vendor data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  vendorService,
  type VendorFilters,
  type PaginatedResult,
} from '@/services/vendorService';
import type { Vendor, VendorFormData } from '@/types/money';

export const vendorKeys = {
  all: ['vendors'] as const,
  lists: () => [...vendorKeys.all, 'list'] as const,
  list: (filters: VendorFilters) => [...vendorKeys.lists(), filters] as const,
  details: () => [...vendorKeys.all, 'detail'] as const,
  detail: (id: string) => [...vendorKeys.details(), id] as const,
};

export function useVendors(filters: VendorFilters = {}) {
  return useQuery({
    queryKey: vendorKeys.list(filters),
    queryFn: () => vendorService.getVendors(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAllVendors(maxResults: number = 500) {
  return useQuery({
    queryKey: vendorKeys.list({ pageSize: maxResults }),
    queryFn: () => vendorService.getVendors({ pageSize: maxResults }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Vendor>) => data.data,
  });
}

export function useActiveVendors() {
  return useQuery({
    queryKey: vendorKeys.list({ isActive: true }),
    queryFn: () => vendorService.getVendors({ isActive: true, pageSize: 500 }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data: PaginatedResult<Vendor>) => data.data,
  });
}

export function useVendor(id: string | undefined) {
  return useQuery({
    queryKey: vendorKeys.detail(id!),
    queryFn: () => vendorService.getVendorById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VendorFormData) => vendorService.createVendor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VendorFormData> }) =>
      vendorService.updateVendor(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: vendorKeys.lists() });
    },
  });
}
