/**
 * React Query hooks for department data fetching
 */

import { useQuery } from '@tanstack/react-query';
import {
  departmentService,
} from '@/services/departmentService';

export const departmentKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentKeys.all, 'list'] as const,
  list: (tenantId: string, maxResults?: number) => [...departmentKeys.lists(), { tenantId, maxResults }] as const,
  details: () => [...departmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...departmentKeys.details(), id] as const,
};

export function useDepartments(tenantId: string, maxResults: number = 100) {
  return useQuery({
    queryKey: departmentKeys.list(tenantId, maxResults),
    queryFn: () => departmentService.getAllDepartments(tenantId, maxResults),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!tenantId,
  });
}

export function useAllDepartments(tenantId: string, maxResults: number = 100) {
  return useQuery({
    queryKey: departmentKeys.list(tenantId, maxResults),
    queryFn: () => departmentService.getAllDepartments(tenantId, maxResults),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!tenantId,
  });
}

