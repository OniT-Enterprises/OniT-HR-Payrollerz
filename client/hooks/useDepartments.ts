/**
 * React Query hooks for department data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  departmentService,
  type Department,
  type DepartmentInput,
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

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tenantId, data }: { tenantId: string; data: DepartmentInput }) =>
      departmentService.addDepartment(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tenantId, id, data }: { tenantId: string; id: string; data: Partial<DepartmentInput> }) =>
      departmentService.updateDepartment(tenantId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tenantId, id }: { tenantId: string; id: string }) =>
      departmentService.deleteDepartment(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}
