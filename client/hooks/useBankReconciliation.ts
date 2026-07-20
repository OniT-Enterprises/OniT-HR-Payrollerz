/**
 * React Query hooks for bank reconciliation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { bankReconciliationService } from '@/services/bankReconciliationService';
import type { BankTransaction } from '@/services/bankReconciliationService';
import { invoiceKeys } from '@/hooks/useInvoices';
import { billKeys } from '@/hooks/useBills';

const bankReconciliationKeys = {
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

/**
 * Input for settle-on-match: matching a bank line to an OUTSTANDING
 * invoice/bill records a real payment (bank_transfer, bank line's date and
 * amount) through the existing payment paths, then links the line to it.
 */
export type SettleMatchInput =
  | {
      kind: 'invoice';
      transactionId: string;
      invoiceId: string;
      amount: number;
      date: string;
      reference: string;
      matchDescription: string;
    }
  | {
      kind: 'bill';
      transactionId: string;
      billId: string;
      amount: number;
      date: string;
      reference: string;
      matchDescription: string;
    };

/** Record a payment on an outstanding invoice/bill AND match the bank line */
export function useSettleTransaction() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  bankReconciliationService.setTenantId(tenantId);
  return useMutation({
    mutationFn: (input: SettleMatchInput) =>
      input.kind === 'invoice'
        ? bankReconciliationService.settleInvoiceMatch(input)
        : bankReconciliationService.settleBillMatch(input),
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all(tenantId) });
      // The match recorded a real payment — refresh the invoice/bill caches
      // so their pages show paid/partial without a manual reload.
      queryClient.invalidateQueries({
        queryKey:
          input.kind === 'invoice'
            ? invoiceKeys.all(tenantId)
            : billKeys.all(tenantId),
      });
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
