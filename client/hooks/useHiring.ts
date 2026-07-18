/**
 * React Query hooks for hiring & onboarding/offboarding
 * Wraps candidateService, jobService, interviewService, offboardingService
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { candidateService } from '@/services/candidateService';
import { jobService } from '@/services/jobService';
import { interviewService } from '@/services/interviewService';
import { offboardingService } from '@/services/offboardingService';
import { jobApplicationService } from '@/services/jobApplicationService';
import type { Candidate } from '@/services/candidateService';
import type { Job } from '@/services/jobService';
import type { JobApplication } from '@/services/jobApplicationService';
import type { Interview, InterviewFeedback, InterviewDecision, InterviewFilters, PreInterviewCheck } from '@/services/interviewService';
import type { OffboardingCase, OffboardingChecklist, ExitInterview } from '@/services/offboardingService';

// ─── Query key factories ─────────────────────────────────────────

const candidateKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'candidates'] as const,
  lists: (tenantId: string) => [...candidateKeys.all(tenantId), 'list'] as const,
};

const jobKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'jobs'] as const,
  lists: (tenantId: string) => [...jobKeys.all(tenantId), 'list'] as const,
  details: (tenantId: string) => [...jobKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...jobKeys.details(tenantId), id] as const,
};

const applicationKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'job-applications'] as const,
  lists: (tenantId: string) => [...applicationKeys.all(tenantId), 'list'] as const,
};

const interviewKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'interviews'] as const,
  lists: (tenantId: string) => [...interviewKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters?: InterviewFilters) => [...interviewKeys.lists(tenantId), filters ?? {}] as const,
};

const offboardingKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'offboarding'] as const,
  active: (tenantId: string) => [...offboardingKeys.all(tenantId), 'active'] as const,
  completed: (tenantId: string) => [...offboardingKeys.all(tenantId), 'completed'] as const,
};

// ─── Candidate hooks ─────────────────────────────────────────────

export function useCandidates() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: candidateKeys.lists(tenantId),
    queryFn: () => candidateService.getAllCandidates(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddCandidate() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (candidate: Omit<Candidate, 'id' | 'tenantId'>) =>
      candidateService.addCandidate(tenantId, candidate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.all(tenantId) });
    },
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Candidate> }) =>
      candidateService.updateCandidate(tenantId, id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.all(tenantId) });
    },
  });
}

// ─── Job hooks ───────────────────────────────────────────────────

export function useJobs() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: jobKeys.lists(tenantId),
    queryFn: () => jobService.getAllJobs(tenantId),
    staleTime: 5 * 60 * 1000,
    enabled: !!tenantId,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (job: Omit<Job, 'id' | 'tenantId'>) =>
      jobService.createJob(tenantId, job),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.all(tenantId) });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Job> }) =>
      jobService.updateJob(tenantId, id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.all(tenantId) });
    },
  });
}

// ─── Application hooks ──────────────────────────────────────────

export function useJobApplications() {
  const tenantId = useTenantId();
  return useQuery<JobApplication[]>({
    queryKey: applicationKeys.lists(tenantId),
    queryFn: () => jobApplicationService.getAll(tenantId),
    staleTime: 2 * 60 * 1000,
    enabled: !!tenantId,
  });
}

export function useInvalidateJobApplications() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return () => queryClient.invalidateQueries({ queryKey: applicationKeys.all(tenantId) });
}

// ─── Interview hooks ─────────────────────────────────────────────

export function useInterviews(filters?: InterviewFilters) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: interviewKeys.list(tenantId, filters),
    queryFn: () => interviewService.getInterviews(tenantId, filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateInterview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (
      interview: Omit<
        Interview,
        'id' | 'tenantId' | 'status' | 'feedback' | 'createdAt' | 'updatedAt'
      >
    ) =>
      interviewService.createInterview(tenantId, interview),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useUpdateInterview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Interview> }) =>
      interviewService.updateInterview(tenantId, id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useDeleteInterview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => interviewService.deleteInterview(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useCompleteInterview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => interviewService.completeInterview(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useCancelInterview() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      interviewService.cancelInterview(tenantId, id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useMarkNoShow() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => interviewService.markNoShow(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useUpdatePreCheck() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, check, value, notes }: { id: string; check: keyof PreInterviewCheck; value: boolean; notes?: string }) =>
      interviewService.updatePreCheck(tenantId, id, check, value, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useSendInterviewInvitation() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    // Emails the candidate (when an address is on file) and marks it sent.
    // Resolves to whether an email actually went out.
    mutationFn: (input: { interview: Interview; companyName?: string; replyTo?: string }) =>
      interviewService.sendInvitation(tenantId, input.interview, {
        companyName: input.companyName,
        replyTo: input.replyTo,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useMarkFollowUpCall() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) => interviewService.markFollowUpCall(tenantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useAddFeedback() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, feedback }: { id: string; feedback: Omit<InterviewFeedback, 'submittedAt'> }) =>
      interviewService.addFeedback(tenantId, id, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

export function useMakeDecision() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ id, decision, notes, companyName, replyTo }: {
      id: string; decision: InterviewDecision; notes?: string;
      companyName?: string; replyTo?: string;
    }) =>
      interviewService.makeDecision(tenantId, id, decision, notes, { companyName, replyTo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all(tenantId) });
    },
  });
}

// ─── Offboarding hooks ───────────────────────────────────────────

export function useActiveCases() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: offboardingKeys.active(tenantId),
    queryFn: () => offboardingService.getActiveCases(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompletedCases() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: offboardingKeys.completed(tenantId),
    queryFn: () => offboardingService.getCompletedCases(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOffboardingCase() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (
      caseData: Omit<
        OffboardingCase,
        'id' | 'tenantId' | 'status' | 'checklist' | 'exitInterview' | 'createdAt' | 'updatedAt'
      >
    ) =>
      offboardingService.createCase(tenantId, caseData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offboardingKeys.all(tenantId) });
    },
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ caseId, item, value }: { caseId: string; item: keyof OffboardingChecklist; value: boolean }) =>
      offboardingService.updateChecklistItem(tenantId, caseId, item, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offboardingKeys.all(tenantId) });
    },
  });
}

export function useSaveArticle56FinalPay() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ caseId, calculatedBy }: { caseId: string; calculatedBy: string }) =>
      offboardingService.saveArticle56FinalPay(tenantId, caseId, calculatedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offboardingKeys.all(tenantId) });
    },
  });
}

export function useUpdateExitInterviewField() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: ({ caseId, field, value }: { caseId: string; field: keyof ExitInterview; value: string | boolean }) =>
      offboardingService.updateExitInterviewField(tenantId, caseId, field, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offboardingKeys.all(tenantId) });
    },
  });
}
