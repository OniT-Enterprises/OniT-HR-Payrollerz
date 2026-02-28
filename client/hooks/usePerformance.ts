/**
 * React Query hooks for performance management
 * Wraps reviewService, goalsService, disciplinaryService, trainingService
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { reviewService, type PerformanceReview, type ReviewFilters } from '@/services/reviewService';
import { goalsService, type OKR, type Goal, type OKRFilters, type GoalFilters } from '@/services/goalsService';
import { disciplinaryService, type DisciplinaryRecord } from '@/services/disciplinaryService';
import { trainingService, type TrainingRecord } from '@/services/trainingService';

// ─── Query key factories ─────────────────────────────────────────

export const reviewKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'reviews'] as const,
  lists: (tenantId: string) => [...reviewKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters?: ReviewFilters) => [...reviewKeys.lists(tenantId), filters ?? {}] as const,
  details: (tenantId: string) => [...reviewKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...reviewKeys.details(tenantId), id] as const,
  stats: (tenantId: string, year?: number) => [...reviewKeys.all(tenantId), 'stats', year] as const,
};

export const okrKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'okrs'] as const,
  lists: (tenantId: string) => [...okrKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters?: OKRFilters) => [...okrKeys.lists(tenantId), filters ?? {}] as const,
  stats: (tenantId: string, quarter?: string, year?: number) => [...okrKeys.all(tenantId), 'stats', quarter, year] as const,
};

export const goalKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'goals'] as const,
  lists: (tenantId: string) => [...goalKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters?: GoalFilters) => [...goalKeys.lists(tenantId), filters ?? {}] as const,
  stats: (tenantId: string, year?: number) => [...goalKeys.all(tenantId), 'stats', year] as const,
};

export const disciplinaryKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'disciplinary'] as const,
  lists: (tenantId: string) => [...disciplinaryKeys.all(tenantId), 'list'] as const,
};

export const trainingKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'training'] as const,
  lists: (tenantId: string) => [...trainingKeys.all(tenantId), 'list'] as const,
};

// ─── Review hooks ────────────────────────────────────────────────

export function useReviews(filters?: ReviewFilters) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: reviewKeys.list(tenantId, filters),
    queryFn: () => reviewService.getReviews(tenantId, filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useReviewStats(year?: number) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: reviewKeys.stats(tenantId, year),
    queryFn: () => reviewService.getStats(tenantId, year),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (review: Omit<PerformanceReview, 'id' | 'tenantId' | 'status' | 'createdAt' | 'updatedAt'>) =>
      reviewService.createReview(tenantId, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all(tenantId) });
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PerformanceReview> }) =>
      reviewService.updateReview(tenantId, id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all(tenantId) });
    },
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => reviewService.submitReview(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all(tenantId) });
    },
  });
}

export function useAcknowledgeReview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) =>
      reviewService.acknowledgeReview(tenantId, id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all(tenantId) });
    },
  });
}

export function useCompleteReview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => reviewService.completeReview(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all(tenantId) });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => reviewService.deleteReview(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all(tenantId) });
    },
  });
}

// ─── OKR hooks ───────────────────────────────────────────────────

export function useOKRs(filters?: OKRFilters) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: okrKeys.list(tenantId, filters),
    queryFn: () => goalsService.getOKRs(tenantId, filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOKRStats(quarter?: string, year?: number) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: okrKeys.stats(tenantId, quarter, year),
    queryFn: () => goalsService.getOKRStats(tenantId, quarter, year),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOKR() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (
      okr: Omit<OKR, 'id' | 'tenantId' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>
    ) =>
      goalsService.createOKR(tenantId, okr),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: okrKeys.all(tenantId) });
    },
  });
}

export function useUpdateOKR() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<OKR> }) =>
      goalsService.updateOKR(tenantId, id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: okrKeys.all(tenantId) });
    },
  });
}

export function useDeleteOKR() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => goalsService.deleteOKR(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: okrKeys.all(tenantId) });
    },
  });
}

// ─── Goal hooks ──────────────────────────────────────────────────

export function useGoals(filters?: GoalFilters) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: goalKeys.list(tenantId, filters),
    queryFn: () => goalsService.getGoals(tenantId, filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGoalStats(year?: number) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: goalKeys.stats(tenantId, year),
    queryFn: () => goalsService.getGoalStats(tenantId, year),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (
      goal: Omit<Goal, 'id' | 'tenantId' | 'status' | 'progress' | 'createdAt' | 'updatedAt'>
    ) =>
      goalsService.createGoal(tenantId, goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all(tenantId) });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Goal> }) =>
      goalsService.updateGoal(tenantId, id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all(tenantId) });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => goalsService.deleteGoal(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all(tenantId) });
    },
  });
}

// ─── Disciplinary hooks ──────────────────────────────────────────

export function useDisciplinaryRecords() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: disciplinaryKeys.lists(tenantId),
    queryFn: () => disciplinaryService.getRecords(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDisciplinaryRecord() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ record, evidenceFile }: {
      record: Omit<DisciplinaryRecord, 'id' | 'tenantId' | 'status' | 'createdAt' | 'updatedAt'>;
      evidenceFile?: File;
    }) => disciplinaryService.createRecord(tenantId, record, evidenceFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: disciplinaryKeys.all(tenantId) });
    },
  });
}

export function useUpdateDisciplinaryRecord() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, updates, evidenceFile }: {
      id: string;
      updates: Partial<DisciplinaryRecord>;
      evidenceFile?: File;
    }) => disciplinaryService.updateRecord(tenantId, id, updates, evidenceFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: disciplinaryKeys.all(tenantId) });
    },
  });
}

export function useDeleteDisciplinaryRecord() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => disciplinaryService.deleteRecord(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: disciplinaryKeys.all(tenantId) });
    },
  });
}

export function useCloseDisciplinaryCase() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, closedBy, actionTaken }: { id: string; closedBy: string; actionTaken?: string }) =>
      disciplinaryService.closeCase(tenantId, id, closedBy, actionTaken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: disciplinaryKeys.all(tenantId) });
    },
  });
}

// ─── Training hooks ──────────────────────────────────────────────

export function useTrainingRecords() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: trainingKeys.lists(tenantId),
    queryFn: () => trainingService.getTrainingRecords(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTrainingRecord() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ record, certificateFile, createdBy }: {
      record: Omit<TrainingRecord, 'id' | 'tenantId' | 'status' | 'createdAt' | 'updatedAt'>;
      certificateFile?: File;
      createdBy?: string;
    }) => trainingService.createTrainingRecord(tenantId, record, certificateFile, createdBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.all(tenantId) });
    },
  });
}

export function useUpdateTrainingRecord() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, updates, certificateFile }: {
      id: string;
      updates: Partial<TrainingRecord>;
      certificateFile?: File;
    }) => trainingService.updateTrainingRecord(tenantId, id, updates, certificateFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.all(tenantId) });
    },
  });
}

export function useDeleteTrainingRecord() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => trainingService.deleteTrainingRecord(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.all(tenantId) });
    },
  });
}

export function useRefreshTrainingStatuses() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: () => trainingService.refreshStatuses(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.all(tenantId) });
    },
  });
}
