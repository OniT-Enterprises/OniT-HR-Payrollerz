/**
 * React Query hooks for face recognition embeddings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import {
  faceRecognitionService,
} from '@/services/faceRecognitionService';

const faceEmbeddingKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'face_embeddings'] as const,
  detail: (tenantId: string, empId: string) =>
    ['tenants', tenantId, 'face_embeddings', empId] as const,
};

/**
 * Fetch all active face embeddings for the tenant (used during clock-in matching)
 */
export function useFaceEmbeddings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: faceEmbeddingKeys.all(tenantId),
    queryFn: () => faceRecognitionService.getAllEmbeddings(tenantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Register face embeddings mutation
 */
export function useRegisterFace() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      employeeId: string;
      employeeName: string;
      embeddings: number[][];
      photoUrls: string[];
      registeredBy: string;
    }) =>
      faceRecognitionService.registerFace(tenantId, data.employeeId, {
        employeeName: data.employeeName,
        embeddings: data.embeddings,
        photoUrls: data.photoUrls,
        registeredBy: data.registeredBy,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: faceEmbeddingKeys.all(tenantId),
      });
      queryClient.invalidateQueries({
        queryKey: faceEmbeddingKeys.detail(tenantId, variables.employeeId),
      });
    },
  });
}

