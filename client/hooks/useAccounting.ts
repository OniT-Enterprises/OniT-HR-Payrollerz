/**
 * React Query hooks for accounting data fetching
 * Wraps accountingService (accounts, journal entries, GL, trial balance)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantId } from '@/contexts/TenantContext';
import { accountingService, journalEntryService, trialBalanceService } from '@/services/accountingService';
import type {
  Account,
  AccountType,
  JournalEntry,
  JournalEntryStatus,
} from '@/types/accounting';

// Query key factories
export const accountKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'accounts'] as const,
  lists: (tenantId: string) => [...accountKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string) => [...accountKeys.lists(tenantId)] as const,
  byType: (tenantId: string, type: AccountType) => [...accountKeys.lists(tenantId), type] as const,
  details: (tenantId: string) => [...accountKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...accountKeys.details(tenantId), id] as const,
};

export const journalEntryKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'journalEntries'] as const,
  lists: (tenantId: string) => [...journalEntryKeys.all(tenantId), 'list'] as const,
  list: (tenantId: string, filters?: { status?: JournalEntryStatus; fiscalYear?: number; startDate?: string; endDate?: string }) =>
    [...journalEntryKeys.lists(tenantId), filters ?? {}] as const,
  details: (tenantId: string) => [...journalEntryKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...journalEntryKeys.details(tenantId), id] as const,
};

export const generalLedgerKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'generalLedger'] as const,
  byAccount: (tenantId: string, accountKey: string, options?: { startDate?: string; endDate?: string }) =>
    [...generalLedgerKeys.all(tenantId), accountKey, options ?? {}] as const,
};

export const trialBalanceKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'trialBalance'] as const,
  report: (tenantId: string, asOfDate: string, fiscalYear: number) =>
    [...trialBalanceKeys.all(tenantId), asOfDate, fiscalYear] as const,
};

export const accountingDashboardKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'accountingDashboard'] as const,
};

// ─── Account hooks ───────────────────────────────────────────────

/** Fetch all accounts */
export function useAccounts() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: accountKeys.list(tenantId),
    queryFn: () => accountingService.accounts.getAllAccounts(tenantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/** Fetch accounts filtered by type */
export function useAccountsByType(type: AccountType) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: accountKeys.byType(tenantId, type),
    queryFn: () => accountingService.accounts.getAccountsByType(tenantId, type),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch a single account */
export function useAccount(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: accountKeys.detail(tenantId, id!),
    queryFn: () => accountingService.accounts.getAccount(tenantId, id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/** Create an account */
export function useCreateAccount() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) =>
      accountingService.accounts.createAccount(tenantId, account),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all(tenantId) });
    },
  });
}

/** Update an account */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Account> }) =>
      accountingService.accounts.updateAccount(tenantId, id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(tenantId, id) });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists(tenantId) });
    },
  });
}

/** Initialize default chart of accounts */
export function useInitializeChartOfAccounts() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: () =>
      accountingService.accounts.initializeChartOfAccounts(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all(tenantId) });
    },
  });
}

// ─── Journal Entry hooks ─────────────────────────────────────────

/** Fetch journal entries with optional filters */
export function useJournalEntries(filters?: { status?: JournalEntryStatus; fiscalYear?: number; startDate?: string; endDate?: string }) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: journalEntryKeys.list(tenantId, filters),
    queryFn: () => journalEntryService.getAllJournalEntries(tenantId, filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/** Fetch a single journal entry */
export function useJournalEntry(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: journalEntryKeys.detail(tenantId, id!),
    queryFn: () => journalEntryService.getJournalEntry(tenantId, id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/** Create a journal entry */
export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (entry: Omit<JournalEntry, 'id' | 'createdAt'>) =>
      journalEntryService.createJournalEntry(tenantId, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalEntryKeys.all(tenantId) });
      queryClient.invalidateQueries({ queryKey: accountingDashboardKeys.all(tenantId) });
    },
  });
}

/** Post a journal entry */
export function usePostJournalEntry() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, postedBy }: { id: string; postedBy: string }) =>
      journalEntryService.postJournalEntry(tenantId, id, postedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalEntryKeys.all(tenantId) });
      queryClient.invalidateQueries({ queryKey: accountingDashboardKeys.all(tenantId) });
    },
  });
}

/** Void a journal entry */
export function useVoidJournalEntry() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ id, voidedBy, reason }: { id: string; voidedBy: string; reason: string }) =>
      journalEntryService.voidJournalEntry(tenantId, id, voidedBy, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalEntryKeys.all(tenantId) });
      queryClient.invalidateQueries({ queryKey: accountingDashboardKeys.all(tenantId) });
    },
  });
}

/** Get next journal entry number */
export function useNextEntryNumber(year: number, enabled: boolean = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...journalEntryKeys.all(tenantId), 'nextNumber', year] as const,
    queryFn: () => journalEntryService.getNextEntryNumber(tenantId, year),
    enabled,
    staleTime: 0, // Always fetch fresh — number increments
  });
}

// ─── General Ledger hooks ────────────────────────────────────────

/** Fetch GL entries for a specific account */
export function useGeneralLedgerEntries(
  accountKey: string | undefined,
  options?: { startDate?: string; endDate?: string },
) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: generalLedgerKeys.byAccount(tenantId, accountKey!, options),
    queryFn: () => accountingService.generalLedger.getEntriesByAccount(tenantId, accountKey!, options),
    enabled: !!accountKey,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Trial Balance hooks ─────────────────────────────────────────

/** Generate trial balance report */
export function useTrialBalance(asOfDate: string, fiscalYear: number, enabled: boolean = false) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: trialBalanceKeys.report(tenantId, asOfDate, fiscalYear),
    queryFn: () => trialBalanceService.generateTrialBalance(tenantId, asOfDate, fiscalYear),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Generate trial balance on demand (mutation-style for explicit trigger) */
export function useGenerateTrialBalance() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ asOfDate, fiscalYear }: { asOfDate: string; fiscalYear: number }) =>
      trialBalanceService.generateTrialBalance(tenantId, asOfDate, fiscalYear),
    onSuccess: (data, { asOfDate, fiscalYear }) => {
      // Seed the query cache so useTrialBalance can read it
      queryClient.setQueryData(trialBalanceKeys.report(tenantId, asOfDate, fiscalYear), data);
    },
  });
}

// ─── Accounting Dashboard hook ───────────────────────────────────

interface AccountingDashboardData {
  payrollPosted: boolean;
  trialBalanced: boolean;
  pendingEntries: number;
  lastPayrollAmount: number;
  lastPayrollDate: string | null;
  lastPayrollEntry: {
    payrollRun: string;
    date: string;
    totalAmount: number;
    entries: { account: string; type: 'debit' | 'credit'; amount: number }[];
  } | null;
}

/** Fetch aggregated accounting dashboard data */
export function useAccountingDashboard() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: accountingDashboardKeys.all(tenantId),
    queryFn: async (): Promise<AccountingDashboardData> => {
      const today = new Date().toISOString().split('T')[0];
      const currentYear = new Date().getFullYear();

      const [postedEntries, draftEntries, trialBalance] = await Promise.all([
        journalEntryService.getAllJournalEntries(tenantId, { status: 'posted' }),
        journalEntryService.getAllJournalEntries(tenantId, { status: 'draft' }),
        trialBalanceService.generateTrialBalance(tenantId, today, currentYear),
      ]);

      // Find most recent payroll journal entry
      const payrollEntries = postedEntries.filter(e => e.source === 'payroll');
      const latestPayroll = payrollEntries.sort((a, b) =>
        (b.date || '').localeCompare(a.date || '')
      )[0] || null;

      const trialBalanced = trialBalance.isBalanced;

      return {
        payrollPosted: payrollEntries.length > 0,
        trialBalanced,
        pendingEntries: draftEntries.length,
        lastPayrollAmount: latestPayroll?.totalDebit || 0,
        lastPayrollDate: latestPayroll?.date || null,
        lastPayrollEntry: latestPayroll ? {
          payrollRun: latestPayroll.description || '',
          date: latestPayroll.date,
          totalAmount: latestPayroll.totalDebit,
          entries: latestPayroll.lines.map(l => ({
            account: l.accountName || l.accountCode,
            type: l.debit > 0 ? 'debit' as const : 'credit' as const,
            amount: l.debit > 0 ? l.debit : l.credit,
          })),
        } : null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
