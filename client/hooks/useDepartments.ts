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
  list: (maxResults?: number) => [...departmentKeys.lists(), { maxResults }] as const,
  details: () => [...departmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...departmentKeys.details(), id] as const,
};

export function useDepartments(maxResults: number = 100) {
  return useQuery({
    queryKey: departmentKeys.list(maxResults),
    queryFn: () => departmentService.getAllDepartments(maxResults),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useAllDepartments(maxResults: number = 100) {
  return useQuery({
    queryKey: departmentKeys.list(maxResults),
    queryFn: () => departmentService.getAllDepartments(maxResults),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DepartmentInput) => departmentService.addDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DepartmentInput> }) =>
      departmentService.updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => departmentService.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}
