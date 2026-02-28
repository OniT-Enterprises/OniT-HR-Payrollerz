/**
 * React Query hooks for bank reconciliation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { bankReconciliationService } from '@/services/bankReconciliationService';
import type { BankTransaction } from '@/services/bankReconciliationService';

export const bankReconciliationKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'bankReconciliation'] as const,
  transactions: (tenantId: string) => [...bankReconciliationKeys.all(tenantId), 'transactions'] as const,
  summary: (tenantId: string) => [...bankReconciliationKeys.all(tenantId), 'summary'] as const,
};

/** Fetch all bank transactions */
export function useBankTransactions(limit?: number) {
  const tenantId = useTenantId();
  // Service uses stateful tenantId pattern
  bankReconciliationService.setTenantId(tenantId);
  return useQuery({
    queryKey: bankReconciliationKeys.transactions(tenantId),
    queryFn: () => bankReconciliationService.getAllTransactions(limit),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch reconciliation summary */
export function useReconciliationSummary() {
  const tenantId = useTenantId();
  bankReconciliationService.setTenantId(tenantId);
  return useQuery({
    queryKey: bankReconciliationKeys.summary(tenantId),
    queryFn: () => bankReconciliationService.getReconciliationSummary(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Import transactions from CSV */
export function useImportTransactions() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  bankReconciliationService.setTenantId(tenantId);
  return useMutation({
    mutationFn: (csvContent: string) =>
      bankReconciliationService.importTransactions(csvContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all(tenantId) });
    },
  });
}

/** Match a transaction to an invoice/bill/expense */
export function useMatchTransaction() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  bankReconciliationService.setTenantId(tenantId);
  return useMutation({
    mutationFn: ({ transactionId, matchedTo }: { transactionId: string; matchedTo: BankTransaction['matchedTo'] }) =>
      bankReconciliationService.matchTransaction(transactionId, matchedTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all(tenantId) });
    },
  });
}

/** Unmatch a transaction */
export function useUnmatchTransaction() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  bankReconciliationService.setTenantId(tenantId);
  return useMutation({
    mutationFn: (transactionId: string) =>
      bankReconciliationService.unmatchTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all(tenantId) });
    },
  });
}

/** Reconcile (mark as reconciled) a batch of transactions */
export function useReconcileTransactions() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  bankReconciliationService.setTenantId(tenantId);
  return useMutation({
    mutationFn: (transactionIds: string[]) =>
      bankReconciliationService.reconcileTransactions(transactionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all(tenantId) });
    },
  });
}

/** Delete a transaction */
export function useDeleteBankTransaction() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  bankReconciliationService.setTenantId(tenantId);
  return useMutation({
    mutationFn: (transactionId: string) =>
      bankReconciliationService.deleteTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all(tenantId) });
    },
  });
}
