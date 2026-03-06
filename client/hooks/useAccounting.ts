/**
 * React Query hooks for accounting data fetching
 * Wraps accountingService (accounts, journal entries, GL, trial balance)
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DocumentSnapshot } from 'firebase/firestore';
import { useTenantId } from '@/contexts/TenantContext';
import { accountingService, journalEntryService, trialBalanceService, fiscalPeriodService } from '@/services/accountingService';
import { auditLogService } from '@/services/auditLogService';
import type {
  Account,
  AccountType,
  AccountSubType,
  BalanceSheet,
  IncomeStatement,
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
  list: (tenantId: string, filters?: { status?: JournalEntryStatus; source?: string; fiscalYear?: number; startDate?: string; endDate?: string }) =>
    [...journalEntryKeys.lists(tenantId), filters ?? {}] as const,
  paginated: (tenantId: string, filters?: { status?: JournalEntryStatus; source?: string; fiscalYear?: number; startDate?: string; endDate?: string; pageSize?: number }) =>
    [...journalEntryKeys.lists(tenantId), 'paginated', filters ?? {}] as const,
  details: (tenantId: string) => [...journalEntryKeys.all(tenantId), 'detail'] as const,
  detail: (tenantId: string, id: string) => [...journalEntryKeys.details(tenantId), id] as const,
  summary: (tenantId: string, fiscalYear: number) => [...journalEntryKeys.all(tenantId), 'summary', fiscalYear] as const,
};

export const generalLedgerKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'generalLedger'] as const,
  byAccount: (tenantId: string, accountKey: string, options?: { accountCode?: string; startDate?: string; endDate?: string; accountType?: AccountType; accountSubType?: AccountSubType }) =>
    [...generalLedgerKeys.all(tenantId), accountKey, options ?? {}] as const,
};

export const trialBalanceKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'trialBalance'] as const,
  report: (tenantId: string, asOfDate: string, fiscalYear: number, periodStart?: string) =>
    [...trialBalanceKeys.all(tenantId), asOfDate, fiscalYear, periodStart ?? null] as const,
};

export const incomeStatementKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'incomeStatement'] as const,
  report: (tenantId: string, periodStart: string, periodEnd: string, fiscalYear: number) =>
    [...incomeStatementKeys.all(tenantId), periodStart, periodEnd, fiscalYear] as const,
};

export const balanceSheetKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'balanceSheet'] as const,
  report: (tenantId: string, asOfDate: string, fiscalYear: number) =>
    [...balanceSheetKeys.all(tenantId), asOfDate, fiscalYear] as const,
};

export const balanceSnapshotKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'balanceSnapshots'] as const,
};

export const accountingDashboardKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'accountingDashboard'] as const,
  summary: (tenantId: string) => [...accountingDashboardKeys.all(tenantId), 'summary'] as const,
  health: (tenantId: string) => [...accountingDashboardKeys.all(tenantId), 'health'] as const,
};

async function invalidateAccountingDerivedData(queryClient: ReturnType<typeof useQueryClient>, tenantId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: accountingDashboardKeys.all(tenantId) }),
    queryClient.invalidateQueries({ queryKey: generalLedgerKeys.all(tenantId) }),
    queryClient.invalidateQueries({ queryKey: trialBalanceKeys.all(tenantId) }),
    queryClient.invalidateQueries({ queryKey: incomeStatementKeys.all(tenantId) }),
    queryClient.invalidateQueries({ queryKey: balanceSheetKeys.all(tenantId) }),
  ]);
}

// ─── Account hooks ───────────────────────────────────────────────

/** Fetch all accounts */
export function useAccounts(enabled: boolean = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: accountKeys.list(tenantId),
    queryFn: () => accountingService.accounts.getAllAccounts(tenantId),
    enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
}

/** Fetch accounts filtered by type */
export function useAccountsByType(type: AccountType) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: accountKeys.byType(tenantId, type),
    queryFn: () => accountingService.accounts.getAccountsByType(tenantId, type),
    staleTime: 30 * 60 * 1000,
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
    mutationFn: (params: {
      account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>;
      audit?: { userId: string; userEmail: string; userName?: string };
    }) =>
      accountingService.accounts.createAccount(tenantId, params.account, params.audit),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all(tenantId) });
      await invalidateAccountingDerivedData(queryClient, tenantId);
    },
  });
}

/** Update an account */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (params: {
      id: string;
      updates: Partial<Account>;
      audit?: { userId: string; userEmail: string; userName?: string };
    }) =>
      accountingService.accounts.updateAccount(tenantId, params.id, params.updates, params.audit),
    onSuccess: async (_, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountKeys.detail(tenantId, id) }),
        queryClient.invalidateQueries({ queryKey: accountKeys.lists(tenantId) }),
      ]);
      await invalidateAccountingDerivedData(queryClient, tenantId);
    },
  });
}

/** Initialize default chart of accounts */
export function useInitializeChartOfAccounts() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (audit?: { userId: string; userEmail: string; userName?: string }) =>
      accountingService.accounts.initializeChartOfAccounts(tenantId, audit),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all(tenantId) });
      await invalidateAccountingDerivedData(queryClient, tenantId);
    },
  });
}

// ─── Journal Entry hooks ─────────────────────────────────────────

/** Fetch journal entries with optional filters */
export function useJournalEntries(
  filters?: { status?: JournalEntryStatus; source?: string; fiscalYear?: number; startDate?: string; endDate?: string },
  enabled: boolean = true,
) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: journalEntryKeys.list(tenantId, filters),
    queryFn: () => journalEntryService.getAllJournalEntries(tenantId, filters),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/** Fetch journal entries page-by-page for default browsing */
export function usePaginatedJournalEntries(
  filters?: { status?: JournalEntryStatus; source?: string; fiscalYear?: number; startDate?: string; endDate?: string; pageSize?: number },
  enabled: boolean = true,
) {
  const tenantId = useTenantId();
  const query = useInfiniteQuery({
    queryKey: journalEntryKeys.paginated(tenantId, filters),
    queryFn: async ({ pageParam }) => {
      return journalEntryService.getJournalEntriesPage(tenantId, {
        ...filters,
        startAfterDoc: pageParam as DocumentSnapshot | undefined,
      });
    },
    initialPageParam: undefined as DocumentSnapshot | undefined,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    ...query,
    entries: query.data?.pages.flatMap((page) => page.entries) ?? [],
  };
}

/** Fetch journal entry summary stats for a fiscal year */
export function useJournalEntrySummary(fiscalYear: number) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: journalEntryKeys.summary(tenantId, fiscalYear),
    queryFn: () => journalEntryService.getJournalEntrySummary(tenantId, fiscalYear),
    staleTime: 5 * 60 * 1000,
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
    mutationFn: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'entryNumber'> & { entryNumber?: string }) =>
      journalEntryService.createJournalEntry(tenantId, entry),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: journalEntryKeys.all(tenantId) });
      await invalidateAccountingDerivedData(queryClient, tenantId);
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: journalEntryKeys.all(tenantId) });
      await invalidateAccountingDerivedData(queryClient, tenantId);
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: journalEntryKeys.all(tenantId) });
      await invalidateAccountingDerivedData(queryClient, tenantId);
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
  options?: { accountCode?: string; startDate?: string; endDate?: string; accountType?: AccountType; accountSubType?: AccountSubType },
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
export function useTrialBalance(
  asOfDate: string,
  fiscalYear: number,
  enabled: boolean = false,
  periodStart?: string,
) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: trialBalanceKeys.report(tenantId, asOfDate, fiscalYear, periodStart),
    queryFn: () => trialBalanceService.generateTrialBalance(tenantId, asOfDate, fiscalYear, periodStart),
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/** Generate trial balance on demand (mutation-style for explicit trigger) */
export function useGenerateTrialBalance() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ asOfDate, fiscalYear, periodStart }: { asOfDate: string; fiscalYear: number; periodStart?: string }) =>
      trialBalanceService.generateTrialBalance(tenantId, asOfDate, fiscalYear, periodStart),
    onSuccess: (data, { asOfDate, fiscalYear, periodStart }) => {
      // Seed the query cache so useTrialBalance can read it
      queryClient.setQueryData(trialBalanceKeys.report(tenantId, asOfDate, fiscalYear, periodStart), data);
    },
  });
}

// ─── Income Statement hooks ─────────────────────────────────────

/** Generate income statement report */
export function useIncomeStatement(periodStart: string, periodEnd: string, fiscalYear: number, enabled: boolean = false) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: incomeStatementKeys.report(tenantId, periodStart, periodEnd, fiscalYear),
    queryFn: () => trialBalanceService.generateIncomeStatement(tenantId, periodStart, periodEnd, fiscalYear),
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/** Generate income statement on demand */
export function useGenerateIncomeStatement() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ periodStart, periodEnd, fiscalYear }: { periodStart: string; periodEnd: string; fiscalYear: number }) =>
      trialBalanceService.generateIncomeStatement(tenantId, periodStart, periodEnd, fiscalYear),
    onSuccess: (data, { periodStart, periodEnd, fiscalYear }) => {
      queryClient.setQueryData(incomeStatementKeys.report(tenantId, periodStart, periodEnd, fiscalYear), data);
    },
  });
}

// ─── Balance Sheet hooks ────────────────────────────────────────

/** Generate balance sheet report */
export function useBalanceSheet(asOfDate: string, fiscalYear: number, enabled: boolean = false) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: balanceSheetKeys.report(tenantId, asOfDate, fiscalYear),
    queryFn: () => trialBalanceService.generateBalanceSheet(tenantId, asOfDate, fiscalYear),
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/** Generate balance sheet on demand */
export function useGenerateBalanceSheet() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ asOfDate, fiscalYear }: { asOfDate: string; fiscalYear: number }) =>
      trialBalanceService.generateBalanceSheet(tenantId, asOfDate, fiscalYear),
    onSuccess: (data, { asOfDate, fiscalYear }) => {
      queryClient.setQueryData(balanceSheetKeys.report(tenantId, asOfDate, fiscalYear), data);
    },
  });
}

// ─── Fiscal Period hooks ────────────────────────────────────────

export const fiscalPeriodKeys = {
  all: (tenantId: string) => ['tenants', tenantId, 'fiscalPeriods'] as const,
  year: (tenantId: string, year: number) => [...fiscalPeriodKeys.all(tenantId), year] as const,
  fiscalYear: (tenantId: string, year: number) => ['tenants', tenantId, 'fiscalYear', year] as const,
};

/** Fetch fiscal year record */
export function useFiscalYear(year: number) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: fiscalPeriodKeys.fiscalYear(tenantId, year),
    queryFn: () => fiscalPeriodService.getFiscalYear(tenantId, year),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch all periods for a fiscal year */
export function useFiscalPeriods(year: number) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: fiscalPeriodKeys.year(tenantId, year),
    queryFn: () => fiscalPeriodService.getPeriodsForYear(tenantId, year),
    staleTime: 5 * 60 * 1000,
  });
}

/** Create a fiscal year with 12 periods */
export function useCreateFiscalYear() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ year, createdBy }: { year: number; createdBy?: string }) =>
      fiscalPeriodService.createFiscalYear(tenantId, year, createdBy),
    onSuccess: (_, { year }) => {
      queryClient.invalidateQueries({ queryKey: fiscalPeriodKeys.all(tenantId) });
      queryClient.invalidateQueries({ queryKey: fiscalPeriodKeys.fiscalYear(tenantId, year) });
    },
  });
}

/** Close a fiscal period */
export function useCloseFiscalPeriod() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ periodId, closedBy }: { periodId: string; closedBy: string }) =>
      fiscalPeriodService.closePeriod(tenantId, periodId, closedBy),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: fiscalPeriodKeys.all(tenantId) }),
        queryClient.invalidateQueries({ queryKey: balanceSnapshotKeys.all(tenantId) }),
      ]);
      await invalidateAccountingDerivedData(queryClient, tenantId);
    },
  });
}

/** Reopen a fiscal period */
export function useReopenFiscalPeriod() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ periodId, reopenedBy }: { periodId: string; reopenedBy: string }) =>
      fiscalPeriodService.reopenPeriod(tenantId, periodId, reopenedBy),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: fiscalPeriodKeys.all(tenantId) }),
        queryClient.invalidateQueries({ queryKey: balanceSnapshotKeys.all(tenantId) }),
      ]);
      await invalidateAccountingDerivedData(queryClient, tenantId);
    },
  });
}

/** Lock a fiscal period (permanent) */
export function useLockFiscalPeriod() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ periodId, lockedBy }: { periodId: string; lockedBy: string }) =>
      fiscalPeriodService.lockPeriod(tenantId, periodId, lockedBy),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: fiscalPeriodKeys.all(tenantId) });
      await invalidateAccountingDerivedData(queryClient, tenantId);
    },
  });
}

/** Backfill missing balance snapshots through a cutoff date */
export function useBackfillBalanceSnapshots() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: async ({ upToDate, generatedBy }: { upToDate: string; generatedBy?: string }) => {
      const { balanceSnapshotService } = await import('@/services/balanceSnapshotService');
      return balanceSnapshotService.backfillSnapshots(tenantId, upToDate, generatedBy);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: balanceSnapshotKeys.all(tenantId) });
      await invalidateAccountingDerivedData(queryClient, tenantId);
    },
  });
}

/** Post opening balances for a fiscal year */
export function usePostOpeningBalances() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: async ({ fiscalYearId, year, lines, createdBy }: {
      fiscalYearId: string;
      year: number;
      lines: { accountId: string; accountCode: string; accountName: string; debit: number; credit: number }[];
      createdBy: string;
    }) => {
      const { journalEntries: jeService, fiscalPeriods: fpService } = await import('@/services/accountingService').then(m => m.accountingService);
      const entryNumber = await jeService.getNextEntryNumber(tenantId, year);
      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

      const entryId = await jeService.createJournalEntry(tenantId, {
        entryNumber,
        date: `${year}-01-01`,
        description: `Opening Balances for ${year}`,
        source: 'opening',
        lines: lines.map((l, i) => ({
          lineNumber: i + 1,
          accountId: l.accountId,
          accountCode: l.accountCode,
          accountName: l.accountName,
          debit: l.debit,
          credit: l.credit,
        })),
        totalDebit,
        totalCredit,
        status: 'posted',
        fiscalYear: year,
        fiscalPeriod: 1,
        createdBy,
      });

      await fpService.updateFiscalYear(tenantId, fiscalYearId, {
        openingBalancesPosted: true,
        openingBalanceEntryId: entryId,
      });

      await auditLogService.log({
        userId: createdBy,
        userEmail: createdBy,
        tenantId,
        action: 'accounting.opening_balances_posted',
        entityId: fiscalYearId,
        entityType: 'fiscal_year',
        entityName: String(year),
        description: `Posted opening balances for ${year} (JE ${entryNumber})`,
        metadata: { fiscalYearId, year, entryId },
        severity: 'warning',
      }).catch(err => console.error('Audit log failed:', err));

      return { entryId, year };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: fiscalPeriodKeys.all(tenantId) }),
        queryClient.invalidateQueries({ queryKey: fiscalPeriodKeys.fiscalYear(tenantId, result.year) }),
        queryClient.invalidateQueries({ queryKey: journalEntryKeys.all(tenantId) }),
      ]);
      await invalidateAccountingDerivedData(queryClient, tenantId);
    },
  });
}

// ─── Accounting Dashboard hook ───────────────────────────────────

interface AccountingDashboardSummaryData {
  payrollPosted: boolean;
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

interface AccountingBalanceHealthData {
  trialBalanced: boolean;
  source: 'aggregate' | 'empty';
}

/** Fetch fast accounting dashboard summary data */
export function useAccountingDashboard() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: accountingDashboardKeys.summary(tenantId),
    queryFn: async (): Promise<AccountingDashboardSummaryData> => {
      const [latestPayroll, pendingEntries] = await Promise.all([
        journalEntryService.getLatestPayrollDashboardEntry(tenantId),
        journalEntryService.getEntryCountByStatus(tenantId, 'draft'),
      ]);

      return {
        payrollPosted: !!latestPayroll,
        pendingEntries,
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

/** Fetch slower balance health separately so the dashboard can render sooner */
export function useAccountingBalanceHealth() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: accountingDashboardKeys.health(tenantId),
    queryFn: async (): Promise<AccountingBalanceHealthData> => {
      const today = new Date().toISOString().split('T')[0];
      const currentYear = new Date().getFullYear();
      const health = await trialBalanceService.getBalanceHealth(tenantId, today, currentYear);

      return {
        trialBalanced: health.isBalanced,
        source: health.source,
      };
    },
    staleTime: 30 * 60 * 1000,
  });
}
