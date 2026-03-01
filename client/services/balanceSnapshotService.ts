/**
 * Balance Snapshot Service
 * Generates and manages monthly balance snapshots for scalable report generation.
 *
 * Instead of scanning the entire generalLedger collection for every report,
 * snapshots store cumulative per-account balances as of a closed period's end date.
 * Reports then: (1) load the most recent snapshot, (2) query only the GL delta
 * after the snapshot date, and (3) combine for the full result.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { addMoney, subtractMoney, sumMoney, toDecimal } from '@/lib/currency';
import type {
  AccountType,
  BalanceSnapshot,
  BalanceSnapshotEntry,
  FiscalPeriod,
  GeneralLedgerEntry,
} from '@/types/accounting';

// ────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────

/** Build a Map<accountId, {debit, credit}> from an array of GL entries. */
function buildAccountMaps(entries: GeneralLedgerEntry[]) {
  const map = new Map<string, { debit: number; credit: number; code: string; name: string; type: string }>();
  for (const e of entries) {
    const existing = map.get(e.accountId);
    if (existing) {
      existing.debit = addMoney(existing.debit, e.debit);
      existing.credit = addMoney(existing.credit, e.credit);
    } else {
      map.set(e.accountId, {
        debit: e.debit,
        credit: e.credit,
        code: e.accountCode,
        name: e.accountName,
        type: '', // Will be filled from accounts if needed
      });
    }
  }
  return map;
}

/** Convert a snapshot's accounts array into a Map<accountId, BalanceSnapshotEntry>. */
function snapshotToMap(snapshot: BalanceSnapshot): Map<string, BalanceSnapshotEntry> {
  const map = new Map<string, BalanceSnapshotEntry>();
  for (const entry of snapshot.accounts) {
    map.set(entry.accountId, entry);
  }
  return map;
}

/** Pad month to 2 digits. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Deterministic snapshot ID: "YYYY-MM" */
function snapshotId(year: number, period: number): string {
  return `${year}-${pad(period)}`;
}

// ────────────────────────────────────────────
// Public service
// ────────────────────────────────────────────

class BalanceSnapshotService {

  /**
   * Generate a balance snapshot for a closed fiscal period.
   * If a prior snapshot exists (from the previous period), we build on it
   * by only scanning GL entries for the current period. Otherwise, we fall
   * back to scanning ALL GL entries up to the period end date.
   *
   * Document ID is deterministic: `{year}-{MM}` — so calling this twice
   * for the same period is an idempotent upsert.
   */
  async generateSnapshot(
    tenantId: string,
    period: FiscalPeriod,
    generatedBy: string,
  ): Promise<BalanceSnapshot> {
    const sid = snapshotId(period.year, period.period);
    const snapshotRef = doc(db, paths.balanceSnapshot(tenantId, sid));

    // Load Chart of Accounts to enrich snapshot entries with accountType
    // Dynamic import to avoid circular dependency (accountingService imports us)
    const { accountService } = await import('@/services/accountingService');
    const allAccounts = await accountService.getAllAccounts(tenantId);
    const accountTypeMap = new Map<string, { type: AccountType; code: string }>();
    for (const acct of allAccounts) {
      if (acct.id) accountTypeMap.set(acct.id, { type: acct.type, code: acct.code });
      // Also key by code for fallback matching
      accountTypeMap.set(`code:${acct.code}`, { type: acct.type, code: acct.code });
    }

    // Try to find the prior period's snapshot for incremental build
    const priorSnapshot = await this.findPriorSnapshot(tenantId, period.year, period.period);

    let accounts: BalanceSnapshotEntry[];

    if (priorSnapshot) {
      // Incremental: prior snapshot + this period's GL entries only
      const periodEntries = await this.queryGLEntriesForPeriod(
        tenantId,
        period.startDate,
        period.endDate,
      );
      accounts = this.mergeSnapshotWithDelta(priorSnapshot, periodEntries, period.startDate, period.endDate, accountTypeMap);
    } else {
      // Full scan: all GL entries up to period end
      const allEntries = await this.queryGLDelta(tenantId, undefined, period.endDate);
      accounts = this.buildSnapshotEntries(allEntries, period.startDate, period.endDate, accountTypeMap);
    }

    const totalCumulativeDebit = sumMoney(accounts.map(a => a.cumulativeDebit));
    const totalCumulativeCredit = sumMoney(accounts.map(a => a.cumulativeCredit));
    const isBalanced = toDecimal(totalCumulativeDebit).minus(totalCumulativeCredit).abs().lessThan(0.01);

    const snapshot: BalanceSnapshot = {
      year: period.year,
      period: period.period,
      periodEndDate: period.endDate,
      fiscalPeriodId: period.id!,
      accounts,
      totalCumulativeDebit,
      totalCumulativeCredit,
      isBalanced,
      generatedAt: new Date() as unknown as BalanceSnapshot['generatedAt'],
      generatedBy,
      version: 1,
    };

    await setDoc(snapshotRef, {
      ...snapshot,
      generatedAt: serverTimestamp(),
    });

    return { ...snapshot, id: sid };
  }

  /** Fetch a single snapshot by its deterministic ID. */
  async getSnapshot(tenantId: string, sid: string): Promise<BalanceSnapshot | null> {
    const docSnap = await getDoc(doc(db, paths.balanceSnapshot(tenantId, sid)));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as BalanceSnapshot;
  }

  /**
   * Find the most recent snapshot strictly before `beforeDate`.
   * Walks backward from the month of beforeDate using deterministic IDs (O(1) per check).
   * Returns null if no snapshot exists.
   */
  async findLatestSnapshotBefore(
    tenantId: string,
    beforeDate: string,
  ): Promise<BalanceSnapshot | null> {
    // Parse beforeDate to determine starting year/month
    const [yearStr, monthStr] = beforeDate.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);

    // The snapshot for a month covers through that month's end.
    // We need a snapshot whose periodEndDate < beforeDate.
    // Start checking from the month before the beforeDate's month.
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }

    // Walk backward up to 36 months (3 years max)
    for (let i = 0; i < 36; i++) {
      const sid = snapshotId(year, month);
      const snapshot = await this.getSnapshot(tenantId, sid);
      if (snapshot && snapshot.periodEndDate < beforeDate) {
        return snapshot;
      }
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
    }

    return null;
  }

  /** Delete a snapshot (called when a period is reopened). */
  async deleteSnapshot(tenantId: string, sid: string): Promise<void> {
    await deleteDoc(doc(db, paths.balanceSnapshot(tenantId, sid)));
  }

  /**
   * Query GL entries in a date range: (afterDate, upToDate].
   * If afterDate is undefined, queries all entries up to upToDate.
   */
  async queryGLDelta(
    tenantId: string,
    afterDate: string | undefined,
    upToDate: string,
  ): Promise<GeneralLedgerEntry[]> {
    const glRef = collection(db, paths.generalLedger(tenantId));

    let q;
    if (afterDate) {
      q = query(
        glRef,
        where('entryDate', '>', afterDate),
        where('entryDate', '<=', upToDate),
        orderBy('entryDate', 'asc'),
      );
    } else {
      q = query(
        glRef,
        where('entryDate', '<=', upToDate),
        orderBy('entryDate', 'asc'),
      );
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as GeneralLedgerEntry));
  }

  // ────────────────────────────────────────────
  // Private methods
  // ────────────────────────────────────────────

  /** Find the snapshot for the period immediately before (year, period). */
  private async findPriorSnapshot(
    tenantId: string,
    year: number,
    period: number,
  ): Promise<BalanceSnapshot | null> {
    let priorYear = year;
    let priorPeriod = period - 1;
    if (priorPeriod < 1) {
      priorPeriod = 12;
      priorYear -= 1;
    }
    return this.getSnapshot(tenantId, snapshotId(priorYear, priorPeriod));
  }

  /** Query GL entries for a specific date range [startDate, endDate]. */
  private async queryGLEntriesForPeriod(
    tenantId: string,
    startDate: string,
    endDate: string,
  ): Promise<GeneralLedgerEntry[]> {
    const glRef = collection(db, paths.generalLedger(tenantId));
    const q = query(
      glRef,
      where('entryDate', '>=', startDate),
      where('entryDate', '<=', endDate),
      orderBy('entryDate', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as GeneralLedgerEntry));
  }

  /**
   * Merge a prior snapshot with new GL entries to produce updated snapshot entries.
   * Prior snapshot gives cumulative totals; new entries add period activity.
   */
  private mergeSnapshotWithDelta(
    priorSnapshot: BalanceSnapshot,
    periodEntries: GeneralLedgerEntry[],
    _periodStart: string,
    _periodEnd: string,
    accountTypeMap: Map<string, { type: AccountType; code: string }>,
  ): BalanceSnapshotEntry[] {
    const priorMap = snapshotToMap(priorSnapshot);
    const deltaMap = buildAccountMaps(periodEntries);

    // Start with all accounts from prior snapshot
    const resultMap = new Map<string, BalanceSnapshotEntry>();

    for (const [accountId, prior] of priorMap) {
      const delta = deltaMap.get(accountId);
      const periodDebit = delta?.debit ?? 0;
      const periodCredit = delta?.credit ?? 0;
      const periodNet = subtractMoney(periodDebit, periodCredit);

      resultMap.set(accountId, {
        accountId,
        accountCode: prior.accountCode,
        accountName: prior.accountName,
        accountType: prior.accountType,
        cumulativeDebit: addMoney(prior.cumulativeDebit, periodDebit),
        cumulativeCredit: addMoney(prior.cumulativeCredit, periodCredit),
        cumulativeNet: addMoney(prior.cumulativeNet, periodNet),
        periodDebit,
        periodCredit,
        periodNet,
      });
    }

    // Add any new accounts that weren't in the prior snapshot
    for (const [accountId, delta] of deltaMap) {
      if (resultMap.has(accountId)) continue;
      const periodNet = subtractMoney(delta.debit, delta.credit);
      const acctInfo = accountTypeMap.get(accountId) ?? accountTypeMap.get(`code:${delta.code}`);
      resultMap.set(accountId, {
        accountId,
        accountCode: delta.code,
        accountName: delta.name,
        accountType: (acctInfo?.type ?? '') as BalanceSnapshotEntry['accountType'],
        cumulativeDebit: delta.debit,
        cumulativeCredit: delta.credit,
        cumulativeNet: periodNet,
        periodDebit: delta.debit,
        periodCredit: delta.credit,
        periodNet,
      });
    }

    return Array.from(resultMap.values());
  }

  /**
   * Build snapshot entries from a full GL scan (no prior snapshot).
   * Entries before periodStart contribute to cumulative only (period = 0).
   * Entries within [periodStart, periodEnd] contribute to both.
   */
  private buildSnapshotEntries(
    allEntries: GeneralLedgerEntry[],
    periodStart: string,
    periodEnd: string,
    accountTypeMap: Map<string, { type: AccountType; code: string }>,
  ): BalanceSnapshotEntry[] {
    const map = new Map<string, BalanceSnapshotEntry>();

    for (const e of allEntries) {
      const isInPeriod = e.entryDate >= periodStart && e.entryDate <= periodEnd;

      const existing = map.get(e.accountId);
      if (existing) {
        existing.cumulativeDebit = addMoney(existing.cumulativeDebit, e.debit);
        existing.cumulativeCredit = addMoney(existing.cumulativeCredit, e.credit);
        existing.cumulativeNet = addMoney(existing.cumulativeNet, subtractMoney(e.debit, e.credit));
        if (isInPeriod) {
          existing.periodDebit = addMoney(existing.periodDebit, e.debit);
          existing.periodCredit = addMoney(existing.periodCredit, e.credit);
          existing.periodNet = addMoney(existing.periodNet, subtractMoney(e.debit, e.credit));
        }
      } else {
        const net = subtractMoney(e.debit, e.credit);
        const acctInfo = accountTypeMap.get(e.accountId) ?? accountTypeMap.get(`code:${e.accountCode}`);
        map.set(e.accountId, {
          accountId: e.accountId,
          accountCode: e.accountCode,
          accountName: e.accountName,
          accountType: (acctInfo?.type ?? '') as BalanceSnapshotEntry['accountType'],
          cumulativeDebit: e.debit,
          cumulativeCredit: e.credit,
          cumulativeNet: net,
          periodDebit: isInPeriod ? e.debit : 0,
          periodCredit: isInPeriod ? e.credit : 0,
          periodNet: isInPeriod ? net : 0,
        });
      }
    }

    return Array.from(map.values());
  }
}

export const balanceSnapshotService = new BalanceSnapshotService();
