/**
 * React Query hooks for payroll data fetching
 * Wraps payrollService (runs, records, benefits, deductions, transfers)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { payrollService } from '@/services/payrollService';
import type {
  PayrollRun,
  PayrollRecord,
  BenefitEnrollment,
  RecurringDeduction,
  BankTransfer,
  ListPayrollRunsOptions,
} from '@/types/payroll';
import type { AuditContext } from '@/services/employeeService';

// ─── Query key factories ─────────────────────────────────────────

export const payrollRunKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'payrollRuns'] as const,
  lists: (tenantId: string) => [...payrollRunKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, options?: ListPayrollRunsOptions) =>
    [...payrollRunKeys.lists(tenantId), options ?? {}] as const,
  details: (tenantId: string) => [...payrollRunKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...payrollRunKeys.details(tenantId), id] as const,
  recent: (tenantId: string, count?: number) =>
    [...payrollRunKeys.all(tenantId), 'recent', count ?? 5] as const,
};

export const payrollRecordKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'payrollRecords'] as const,
  byRun: (tenantId: string, runId: string) =>
    [...payrollRecordKeys.all(tenantId), 'byRun', runId] as const,
  byEmployee: (tenantId: string, employeeId: string) =>
    [...payrollRecordKeys.all(tenantId), 'byEmployee', employeeId] as const,
};

export const benefitKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'benefits'] as const,
  lists: (tenantId: string) => [...benefitKeys.all(tenantId), 'list'] as const,
  byEmployee: (tenantId: string, employeeId: string) =>
    [...benefitKeys.all(tenantId), 'byEmployee', employeeId] as const,
};

export const deductionKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'deductions'] as const,
  lists: (tenantId: string) => [...deductionKeys.all(tenantId), 'list'] as const,
  byEmployee: (tenantId: string, employeeId: string) =>
    [...deductionKeys.all(tenantId), 'byEmployee', employeeId] as const,
};

export const bankTransferKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'bankTransfers'] as const,
  lists: (tenantId: string) => [...bankTransferKeys.all(tenantId), 'list'] as const,
};

// ─── Payroll Run hooks ───────────────────────────────────────────

/** Fetch all payroll runs with optional filters */
export function usePayrollRuns(options?: ListPayrollRunsOptions) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: payrollRunKeys.list(tenantId, options),
    queryFn: () => payrollService.runs.getAllPayrollRuns({ ...options, tenantId }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/** Fetch recent payroll runs */
export function useRecentPayrollRuns(count: number = 5) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: payrollRunKeys.recent(tenantId, count),
    queryFn: () => payrollService.runs.getRecentPayrollRuns(count),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch a single payroll run */
export function usePayrollRun(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: payrollRunKeys.detail(tenantId, id!),
    queryFn: () => payrollService.runs.getPayrollRunById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/** Create payroll run with records */
export function useCreatePayrollRunWithRecords() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({
      payrollRun,
      records,
      audit,
    }: {
      payrollRun: Omit<PayrollRun, 'id'>;
      records: Omit<PayrollRecord, 'id' | 'payrollRunId'>[];
      audit?: AuditContext;
    }) => payrollService.runs.createPayrollRunWithRecords(payrollRun, records, audit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollRunKeys.all(tenantId) });
      queryClient.invalidateQueries({ queryKey: payrollRecordKeys.all(tenantId) });
    },
  });
}

/** Approve a payroll run */
export function useApprovePayrollRun() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, approvedBy, audit }: { id: string; approvedBy: string; audit?: AuditContext }) =>
      payrollService.runs.approvePayrollRun(id, approvedBy, audit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollRunKeys.all(tenantId) });
    },
  });
}

/** Reject a payroll run */
export function useRejectPayrollRun() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, rejectedBy, reason, audit }: { id: string; rejectedBy: string; reason: string; audit?: AuditContext }) =>
      payrollService.runs.rejectPayrollRun(id, rejectedBy, reason, audit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollRunKeys.all(tenantId) });
    },
  });
}

/** Mark payroll run as paid */
export function useMarkPayrollRunAsPaid() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (id: string) => payrollService.runs.markPayrollRunAsPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollRunKeys.all(tenantId) });
    },
  });
}

/** Update a payroll run */
export function useUpdatePayrollRun() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PayrollRun> }) =>
      payrollService.runs.updatePayrollRun(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollRunKeys.all(tenantId) });
    },
  });
}

/** Repair a stuck payroll run */
export function useRepairStuckRun() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (runId: string) => payrollService.runs.repairStuckRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollRunKeys.all(tenantId) });
    },
  });
}

// ─── Payroll Record hooks ────────────────────────────────────────

/** Fetch payroll records for a specific run */
export function usePayrollRecordsByRun(runId: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: payrollRecordKeys.byRun(tenantId, runId!),
    queryFn: () => payrollService.records.getPayrollRecordsByRunId(runId!, tenantId),
    enabled: !!runId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch employee payroll history */
export function useEmployeePayrollHistory(employeeId: string | undefined, limitCount?: number) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: payrollRecordKeys.byEmployee(tenantId, employeeId!),
    queryFn: () => payrollService.records.getEmployeePayrollHistory(employeeId!, limitCount),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Benefit Enrollment hooks ────────────────────────────────────

/** Fetch all benefit enrollments */
export function useBenefitEnrollments() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: benefitKeys.lists(tenantId),
    queryFn: () => payrollService.benefits.getAllEnrollments(tenantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/** Create benefit enrollment */
export function useCreateBenefitEnrollment() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (enrollment: Omit<BenefitEnrollment, 'id' | 'tenantId'>) =>
      payrollService.benefits.createEnrollment(tenantId, enrollment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: benefitKeys.all(tenantId) });
    },
  });
}

/** Update benefit enrollment */
export function useUpdateBenefitEnrollment() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BenefitEnrollment> }) =>
      payrollService.benefits.updateEnrollment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: benefitKeys.all(tenantId) });
    },
  });
}

/** Terminate benefit enrollment */
export function useTerminateBenefitEnrollment() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, terminationDate }: { id: string; terminationDate: string }) =>
      payrollService.benefits.terminateEnrollment(id, terminationDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: benefitKeys.all(tenantId) });
    },
  });
}

// ─── Recurring Deduction hooks ───────────────────────────────────

/** Fetch all recurring deductions */
export function useRecurringDeductions() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: deductionKeys.lists(tenantId),
    queryFn: () => payrollService.deductions.getAllDeductions(tenantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/** Create recurring deduction */
export function useCreateDeduction() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (deduction: Omit<RecurringDeduction, 'id' | 'tenantId'>) =>
      payrollService.deductions.createDeduction(tenantId, deduction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deductionKeys.all(tenantId) });
    },
  });
}

/** Update recurring deduction */
export function useUpdateDeduction() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RecurringDeduction> }) =>
      payrollService.deductions.updateDeduction(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deductionKeys.all(tenantId) });
    },
  });
}

/** Pause a recurring deduction */
export function usePauseDeduction() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (id: string) => payrollService.deductions.pauseDeduction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deductionKeys.all(tenantId) });
    },
  });
}

/** Delete a recurring deduction */
export function useDeleteDeduction() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (id: string) => payrollService.deductions.deleteDeduction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deductionKeys.all(tenantId) });
    },
  });
}

// ─── Bank Transfer hooks ─────────────────────────────────────────

/** Fetch all bank transfers */
export function useBankTransfers() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: bankTransferKeys.lists(tenantId),
    queryFn: () => payrollService.transfers.getAllTransfers(tenantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/** Create bank transfer */
export function useCreateBankTransfer() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (transfer: Omit<BankTransfer, 'id' | 'tenantId'>) =>
      payrollService.transfers.createTransfer(tenantId, transfer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankTransferKeys.all(tenantId) });
    },
  });
}

/** Update bank transfer status */
export function useUpdateBankTransferStatus() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, status, errorMessage }: { id: string; status: BankTransfer['status']; errorMessage?: string }) =>
      payrollService.transfers.updateTransferStatus(id, status, errorMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankTransferKeys.all(tenantId) });
    },
  });
}
