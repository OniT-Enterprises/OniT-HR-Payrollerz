/**
 * Accounting Service
 * Firebase Firestore operations for the accounting module
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
  runTransaction,
  Transaction,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { addMoney, roundMoney, subtractMoney, sumMoney, toDecimal, toMoney } from '@/lib/currency';
import { auditLogService } from '@/services/auditLogService';
import type {
  Account,
  AccountType,
  AccountSubType,
  JournalEntry,
  JournalEntryLine,
  FiscalYear,
  FiscalPeriod,
  AccountingSettings,
  TrialBalance,
  TrialBalanceRow,
  GeneralLedgerEntry,
  IncomeStatement,
  IncomeStatementRow,
  BalanceSheet,
  BalanceSheetRow,
} from '@/types/accounting';
import {
  getDefaultAccounts,
  EXPENSE_CATEGORY_TO_ACCOUNT,
  MONEY_JOURNAL_MAPPINGS,
} from '@/lib/accounting/chart-of-accounts';
import { getTodayTL } from '@/lib/dateUtils';
import {
  addToMoneyMap,
  calculateBillPaymentPostingAmounts,
  getAccountNet,
  getFiscalDateParts,
  normalizeJournalAmounts,
} from '@/lib/accounting/calculations';
import type { TLPayrollRun, TLPayrollRecord } from '@/types/payroll-tl';
import type { Invoice, Expense, Bill, PaymentMethod } from '@/types/money';
import { summarizePayrollForAccounting } from '@/lib/payroll/accounting-summary';

// ============================================
// ACCOUNTS SERVICE
// ============================================

class AccountService {
  private readonly cacheTtlMs = 5 * 60 * 1000;
  private readonly accountCache = new Map<string, { accounts: Account[]; fetchedAt: number }>();

  private collectionRef(tenantId: string) {
    return collection(db, paths.accounts(tenantId));
  }

  private isCacheFresh(tenantId: string): boolean {
    const cached = this.accountCache.get(tenantId);
    return !!cached && (Date.now() - cached.fetchedAt) < this.cacheTtlMs;
  }

  private async getCachedAccounts(tenantId: string, forceRefresh: boolean = false): Promise<Account[]> {
    if (!forceRefresh && this.isCacheFresh(tenantId)) {
      return this.accountCache.get(tenantId)!.accounts;
    }

    const q = query(this.collectionRef(tenantId), orderBy('code'));
    const snapshot = await getDocs(q);
    const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
    this.accountCache.set(tenantId, {
      accounts,
      fetchedAt: Date.now(),
    });
    return accounts;
  }

  invalidateCache(tenantId: string): void {
    this.accountCache.delete(tenantId);
  }

  async createAccount(
    tenantId: string,
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>,
    audit?: { userId: string; userEmail: string; userName?: string }
  ): Promise<string> {
    const docRef = await addDoc(this.collectionRef(tenantId), {
      ...account,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.invalidateCache(tenantId);

    if (audit) {
      await auditLogService.log({
        ...audit,
        tenantId,
        action: 'accounting.account_create',
        entityId: docRef.id,
        entityType: 'account',
        entityName: `${account.code} - ${account.name}`,
        description: `Created account ${account.code} - ${account.name}`,
        newValue: account as unknown as Record<string, unknown>,
      }).catch(err => console.error('Audit log failed:', err));
    }
    return docRef.id;
  }

  async updateAccount(
    tenantId: string,
    id: string,
    updates: Partial<Account>,
    audit?: { userId: string; userEmail: string; userName?: string }
  ): Promise<void> {
    const docRef = doc(db, paths.account(tenantId, id));
    const before = audit ? await getDoc(docRef).catch(() => null) : null;
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    this.invalidateCache(tenantId);

    if (audit) {
      const oldValue = before?.exists() ? (before.data() as Record<string, unknown>) : undefined;
      await auditLogService.log({
        ...audit,
        tenantId,
        action: 'accounting.account_update',
        entityId: id,
        entityType: 'account',
        entityName: typeof updates.code === 'string' && typeof updates.name === 'string'
          ? `${updates.code} - ${updates.name}`
          : id,
        description: `Updated account ${typeof updates.code === 'string' ? updates.code : id}`,
        oldValue,
        newValue: updates as unknown as Record<string, unknown>,
      }).catch(err => console.error('Audit log failed:', err));
    }
  }

  async getAccount(tenantId: string, id: string): Promise<Account | null> {
    if (this.isCacheFresh(tenantId)) {
      return this.accountCache.get(tenantId)!.accounts.find((account) => account.id === id) ?? null;
    }

    const docRef = doc(db, paths.account(tenantId, id));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Account;
    }
    return null;
  }

  async getAccountByCode(tenantId: string, code: string): Promise<Account | null> {
    const accounts = await this.getCachedAccounts(tenantId);
    return accounts.find((account) => account.code === code) ?? null;
  }

  /**
   * Add a newly introduced system account to an existing tenant chart.
   * Uses a deterministic document ID so concurrent first use is idempotent.
   */
  async ensureSystemAccountByCode(tenantId: string, code: string): Promise<Account> {
    const existing = (await this.getAllAccounts(tenantId, true))
      .find((account) => account.code === code) ?? null;
    if (existing) {
      if (!existing.isActive) {
        throw new Error(`Required system account ${code} is inactive. Reactivate it before posting.`);
      }
      return existing;
    }

    const definition = getDefaultAccounts().find(
      (account) => account.code === code && account.isSystem,
    );
    if (!definition) {
      throw new Error(`No system account definition exists for code ${code}.`);
    }

    const accountRef = doc(this.collectionRef(tenantId), `system-${code}`);
    const deterministicDoc = await getDoc(accountRef);
    if (deterministicDoc.exists()) {
      const data = deterministicDoc.data() as Partial<Account>;
      if (data.code !== code) {
        throw new Error(`Account document system-${code} is already used by code ${data.code || 'unknown'}.`);
      }
      if (data.isActive === false) {
        throw new Error(`Required system account ${code} is inactive. Reactivate it before posting.`);
      }
      this.invalidateCache(tenantId);
      return { id: deterministicDoc.id, ...data } as Account;
    }

    await setDoc(accountRef, {
      ...definition,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.invalidateCache(tenantId);
    return {
      id: accountRef.id,
      ...definition,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getAllAccounts(tenantId: string, forceRefresh: boolean = false): Promise<Account[]> {
    return this.getCachedAccounts(tenantId, forceRefresh);
  }

  async getAccountsByType(tenantId: string, type: Account['type']): Promise<Account[]> {
    const accounts = await this.getCachedAccounts(tenantId);
    return accounts.filter((account) => account.type === type && account.isActive);
  }

  async deleteAccount(tenantId: string, id: string): Promise<void> {
    const docRef = doc(db, paths.account(tenantId, id));
    // Soft delete - just deactivate
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    this.invalidateCache(tenantId);
  }

  /**
   * Initialize chart of accounts with defaults
   */
  async initializeChartOfAccounts(
    tenantId: string,
    audit?: { userId: string; userEmail: string; userName?: string }
  ): Promise<void> {
    const existingAccounts = await this.getAllAccounts(tenantId, true);
    if (existingAccounts.length > 0) {
      return;
    }

    const batch = writeBatch(db);
    const defaultAccounts = getDefaultAccounts();

    for (const account of defaultAccounts) {
      const docRef = doc(this.collectionRef(tenantId));
      batch.set(docRef, {
        ...account,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    this.invalidateCache(tenantId);

    if (audit) {
      await auditLogService.log({
        ...audit,
        tenantId,
        action: 'accounting.coa_initialize',
        entityId: tenantId,
        entityType: 'chart_of_accounts',
        description: 'Initialized chart of accounts',
        metadata: { count: defaultAccounts.length },
      }).catch(err => console.error('Audit log failed:', err));
    }
  }
}

// ============================================
// JOURNAL ENTRY SERVICE
// ============================================

class JournalEntryService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.journalEntries(tenantId));
  }

  private async assertFiscalPeriodAllowsPosting(
    tenantId: string,
    fiscalYear: number,
    fiscalPeriod: number
  ): Promise<void> {
    const period = await fiscalPeriodService.getPeriodByYearAndPeriod(tenantId, fiscalYear, fiscalPeriod);
    if (!period) {
      // Backwards-compatible: if fiscal periods are not configured yet, allow posting.
      return;
    }
    if (period.status !== 'open') {
      throw new Error(
        `Fiscal period ${fiscalYear}-${String(fiscalPeriod).padStart(2, '0')} is ${period.status}. ` +
        'Reopen the period to post/void entries.'
      );
    }
  }

  async getJournalEntryBySource(
    tenantId: string,
    source: JournalEntry['source'],
    sourceId: string
  ): Promise<JournalEntry | null> {
    const q = query(
      this.collectionRef(tenantId),
      where('source', '==', source),
      where('sourceId', '==', sourceId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    // Edits replace a posted source entry by voiding the old journal and
    // posting a new one. Always return the active entry, not an arbitrary
    // Firestore result left behind by that history.
    const statusRank: Record<JournalEntry['status'], number> = {
      posted: 0,
      draft: 1,
      void: 2,
    };
    const entries = snapshot.docs.map((entryDoc) => ({
      id: entryDoc.id,
      ...entryDoc.data(),
    } as JournalEntry));
    entries.sort((a, b) => {
      const rank = statusRank[a.status] - statusRank[b.status];
      if (rank !== 0) return rank;
      const numberOrder = (b.entryNumber || '').localeCompare(a.entryNumber || '');
      return numberOrder || (b.id || '').localeCompare(a.id || '');
    });
    return entries[0];
  }

  async createJournalEntry(
    tenantId: string,
    entry: Omit<JournalEntry, 'id' | 'createdAt' | 'entryNumber'> & { entryNumber?: string },
    txn?: Transaction
  ): Promise<string> {
    const normalized = normalizeJournalAmounts(
      entry.lines,
      entry.totalDebit,
      entry.totalCredit,
    );
    const normalizedEntry = {
      ...entry,
      lines: normalized.lines,
      totalDebit: normalized.totalDebit,
      totalCredit: normalized.totalCredit,
    };

    // Enforce fiscal period controls (posted entries only).
    if (normalizedEntry.status === 'posted') {
      await this.assertFiscalPeriodAllowsPosting(
        tenantId,
        normalizedEntry.fiscalYear,
        normalizedEntry.fiscalPeriod,
      );
    }

    const journalDocRef = doc(this.collectionRef(tenantId));

    // Write journal + GL entries atomically so books cannot drift.
    const doWrite = async (transaction: Transaction) => {
      const finalEntry = normalizedEntry.entryNumber
        ? normalizedEntry
        : {
            ...normalizedEntry,
            entryNumber: await this.getNextEntryNumber(
              tenantId,
              normalizedEntry.fiscalYear,
              transaction,
            ),
          };
      const journalPayload: Record<string, unknown> = {
        ...finalEntry,
        createdAt: serverTimestamp(),
      };

      if (finalEntry.status === 'posted') {
        // Ensure posted metadata is present for posted-on-create entries.
        if (!('postedAt' in journalPayload) || journalPayload.postedAt === undefined) {
          journalPayload.postedAt = serverTimestamp();
        }
        if (!('postedBy' in journalPayload) || journalPayload.postedBy === undefined) {
          journalPayload.postedBy = finalEntry.postedBy || finalEntry.createdBy || 'system';
        }
      }

      transaction.set(journalDocRef, journalPayload);

      if (finalEntry.status === 'posted') {
        for (const line of finalEntry.lines) {
          const glDocRef = doc(collection(db, paths.generalLedger(tenantId)));
          transaction.set(glDocRef, {
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            journalEntryId: journalDocRef.id,
            entryNumber: finalEntry.entryNumber,
            entryDate: finalEntry.date,
            description: line.description || finalEntry.description,
            debit: line.debit,
            credit: line.credit,
            balance: 0,
            fiscalYear: finalEntry.fiscalYear,
            fiscalPeriod: finalEntry.fiscalPeriod,
            createdAt: serverTimestamp(),
          });
        }

        // Audit trail: posted journal entry (includes auto-generated postings)
        const actor = finalEntry.postedBy || finalEntry.createdBy || 'system';
        const auditDocRef = doc(db, paths.auditLogs(tenantId), `acct_${journalDocRef.id}_post`);
        transaction.set(auditDocRef, {
          userId: actor,
          userEmail: actor,
          action: 'accounting.journal_post',
          module: 'accounting',
          description: `Posted journal entry ${finalEntry.entryNumber}`,
          timestamp: serverTimestamp(),
          tenantId,
          entityId: journalDocRef.id,
          entityType: 'journal_entry',
          entityName: finalEntry.entryNumber,
          metadata: {
            source: finalEntry.source,
            sourceId: finalEntry.sourceId || null,
            totalDebit: finalEntry.totalDebit,
            totalCredit: finalEntry.totalCredit,
            date: finalEntry.date,
          },
          severity: 'info',
        });
      }
    };

    if (txn) {
      await doWrite(txn);
    } else {
      await runTransaction(db, async (transaction) => doWrite(transaction));
    }

    return journalDocRef.id;
  }

  async getJournalEntry(tenantId: string, id: string): Promise<JournalEntry | null> {
    const docRef = doc(db, paths.journalEntry(tenantId, id));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as JournalEntry;
    }
    return null;
  }

  async getAllJournalEntries(tenantId: string, options?: {
    status?: JournalEntry['status'];
    source?: string;
    startDate?: string;
    endDate?: string;
    fiscalYear?: number;
    maxResults?: number;
  }): Promise<JournalEntry[]> {
    const { queryConstraints } = this.buildJournalEntryQueryConstraints(options);
    if (options?.maxResults) {
      queryConstraints.push(limit(options.maxResults));
    }
    const q = query(this.collectionRef(tenantId), ...queryConstraints);

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
  }

  async getJournalEntriesPage(tenantId: string, options?: {
    status?: JournalEntry['status'];
    source?: string;
    startDate?: string;
    endDate?: string;
    fiscalYear?: number;
    pageSize?: number;
    startAfterDoc?: DocumentSnapshot;
  }): Promise<{
    entries: JournalEntry[];
    lastDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    const pageSize = options?.pageSize ?? 100;
    const { queryConstraints } = this.buildJournalEntryQueryConstraints(options);
    queryConstraints.push(limit(pageSize + 1));

    if (options?.startAfterDoc) {
      queryConstraints.push(startAfter(options.startAfterDoc));
    }

    const pagedQuery = query(this.collectionRef(tenantId), ...queryConstraints);
    const snapshot = await getDocs(pagedQuery);

    const docs = snapshot.docs.slice(0, pageSize);
    return {
      entries: docs.map((doc) => ({ id: doc.id, ...doc.data() } as JournalEntry)),
      lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
      hasMore: snapshot.docs.length > pageSize,
    };
  }

  private buildJournalEntryQueryConstraints(options?: {
    status?: JournalEntry['status'];
    source?: string;
    startDate?: string;
    endDate?: string;
    fiscalYear?: number;
    maxResults?: number;
  }) {
    const constraints: Parameters<typeof query>[1][] = [];

    if (options?.status) {
      constraints.push(where('status', '==', options.status));
    }
    if (options?.source) {
      constraints.push(where('source', '==', options.source));
    }
    if (options?.fiscalYear) {
      constraints.push(where('fiscalYear', '==', options.fiscalYear));
    }
    if (options?.startDate) {
      constraints.push(where('date', '>=', options.startDate));
    }
    if (options?.endDate) {
      constraints.push(where('date', '<=', options.endDate));
    }

    constraints.push(orderBy('date', 'desc'));

    return { queryConstraints: constraints };
  }

  async getJournalEntrySummary(
    tenantId: string,
    fiscalYear: number,
  ): Promise<{
    total: number;
    posted: number;
    drafts: number;
    totalDebit: number;
  }> {
    const baseQuery = query(this.collectionRef(tenantId), where('fiscalYear', '==', fiscalYear));
    const snapshot = await getDocs(baseQuery);

    let total = 0;
    let posted = 0;
    let drafts = 0;
    let totalDebit = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      total++;
      if (data.status === 'posted') {
        posted++;
        totalDebit = addMoney(totalDebit, Number(data.totalDebit) || 0);
      } else if (data.status === 'draft') {
        drafts++;
      }
    }

    return { total, posted, drafts, totalDebit };
  }

  async getEntryCountByStatus(
    tenantId: string,
    status: JournalEntry['status'],
  ): Promise<number> {
    const snapshot = await getDocs(query(this.collectionRef(tenantId), where('status', '==', status)));
    return snapshot.size;
  }

  async getLatestPayrollDashboardEntry(tenantId: string): Promise<JournalEntry | null> {
    const payrollQuery = query(
      this.collectionRef(tenantId),
      where('status', '==', 'posted'),
      where('source', '==', 'payroll'),
      orderBy('date', 'desc'),
      limit(1),
    );
    const payrollSnapshot = await getDocs(payrollQuery);
    if (payrollSnapshot.empty) {
      return null;
    }

    const latestPayrollDoc = payrollSnapshot.docs[0];
    return { id: latestPayrollDoc.id, ...latestPayrollDoc.data() } as JournalEntry;
  }

  async postJournalEntry(tenantId: string, id: string, postedBy: string): Promise<void> {
    const journalDocRef = doc(db, paths.journalEntry(tenantId, id));

    // Pre-check fiscal period status (query not transaction-safe)
    const preSnap = await getDoc(journalDocRef);
    if (!preSnap.exists()) {
      throw new Error('Journal entry not found');
    }
    const preEntry = { id: preSnap.id, ...preSnap.data() } as JournalEntry;
    if (preEntry.status === 'draft') {
      await this.assertFiscalPeriodAllowsPosting(tenantId, preEntry.fiscalYear, preEntry.fiscalPeriod);
    }

    // Use transaction to ensure atomicity: journal status update + GL entries creation
    await runTransaction(db, async (transaction) => {
      // Read the journal entry within the transaction
      const journalDoc = await transaction.get(journalDocRef);
      if (!journalDoc.exists()) {
        throw new Error('Journal entry not found');
      }

      const entry = { id: journalDoc.id, ...journalDoc.data() } as JournalEntry;
      if (entry.status === 'posted') {
        throw new Error('Journal entry is already posted');
      }
      if (entry.status !== 'draft') {
        throw new Error(`Only draft journal entries can be posted (current: ${entry.status})`);
      }

      // Update journal entry status
      transaction.update(journalDocRef, {
        status: 'posted',
        postedAt: serverTimestamp(),
        postedBy,
      });

      // Create general ledger entries within the same transaction
      for (const line of entry.lines) {
        const glDocRef = doc(collection(db, paths.generalLedger(tenantId)));
        transaction.set(glDocRef, {
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: entry.id,
          entryNumber: entry.entryNumber,
          entryDate: entry.date,
          description: line.description || entry.description,
          debit: line.debit,
          credit: line.credit,
          balance: 0, // Will be calculated when retrieved
          fiscalYear: entry.fiscalYear,
          fiscalPeriod: entry.fiscalPeriod,
          createdAt: serverTimestamp(),
        });
      }

      // Audit trail: posted journal entry
      const auditDocRef = doc(db, paths.auditLogs(tenantId), `acct_${id}_post`);
      transaction.set(auditDocRef, {
        userId: postedBy,
        userEmail: postedBy,
        action: 'accounting.journal_post',
        module: 'accounting',
        description: `Posted journal entry ${entry.entryNumber}`,
        timestamp: serverTimestamp(),
        tenantId,
        entityId: id,
        entityType: 'journal_entry',
        entityName: entry.entryNumber,
        metadata: {
          source: entry.source,
          sourceId: entry.sourceId || null,
          totalDebit: entry.totalDebit,
          totalCredit: entry.totalCredit,
          date: entry.date,
        },
        severity: 'info',
      });
    });
  }

  async voidJournalEntry(tenantId: string, id: string, voidedBy: string, reason: string): Promise<void> {
    const docRef = doc(db, paths.journalEntry(tenantId, id));
    const existing = await getDoc(docRef);
    if (!existing.exists()) {
      throw new Error('Journal entry not found');
    }
    const entry = { ...existing.data(), id: existing.id } as JournalEntry;
    if (entry.status !== 'posted') {
      throw new Error('Only posted journal entries can be voided');
    }

    await this.assertFiscalPeriodAllowsPosting(tenantId, entry.fiscalYear, entry.fiscalPeriod);

    await runTransaction(db, async (transaction) => {
      // 1. Mark journal entry as void
      transaction.update(docRef, {
        status: 'void',
        voidedAt: serverTimestamp(),
        voidedBy,
        voidReason: reason,
      });

      // 2. Create reversing GL entries (swap debits and credits)
      for (const line of entry.lines) {
        const glDocRef = doc(collection(db, paths.generalLedger(tenantId)));
        transaction.set(glDocRef, {
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: id,
          entryNumber: `${entry.entryNumber}-VOID`,
          entryDate: entry.date,
          description: `VOID: ${line.description || entry.description}`,
          debit: line.credit,   // Swap: original credit becomes debit
          credit: line.debit,   // Swap: original debit becomes credit
          balance: 0,
          fiscalYear: entry.fiscalYear,
          fiscalPeriod: entry.fiscalPeriod,
          createdAt: serverTimestamp(),
        });
      }

      // Audit trail: voided journal entry
      const auditDocRef = doc(db, paths.auditLogs(tenantId), `acct_${id}_void`);
      transaction.set(auditDocRef, {
        userId: voidedBy,
        userEmail: voidedBy,
        action: 'accounting.journal_void',
        module: 'accounting',
        description: `Voided journal entry ${entry.entryNumber}${reason ? `: ${reason}` : ''}`,
        timestamp: serverTimestamp(),
        tenantId,
        entityId: id,
        entityType: 'journal_entry',
        entityName: entry.entryNumber,
        metadata: {
          source: entry.source,
          sourceId: entry.sourceId || null,
          totalDebit: entry.totalDebit,
          totalCredit: entry.totalCredit,
          date: entry.date,
          reason,
        },
        severity: 'critical',
      });
    });
  }

  /**
   * Void a journal entry and create reversing GL entries inside an existing transaction.
   * Use this when cancelling/deleting source documents (bills, invoices, expenses)
   * to keep the General Ledger balanced.
   *
   * @param tenantId - Tenant ID
   * @param journalEntryId - The journal entry to void
   * @param transaction - Firestore transaction (must be provided)
   * @param voidedBy - User who initiated the void
   * @param reason - Reason for voiding
   */
  voidJournalEntryInTransaction(
    tenantId: string,
    journalEntryId: string,
    journalEntry: JournalEntry,
    transaction: Transaction,
    voidedBy: string,
    reason: string
  ): void {
    if (journalEntry.status !== 'posted') {
      // Nothing to reverse for draft or already-voided entries
      return;
    }

    const journalDocRef = doc(db, paths.journalEntry(tenantId, journalEntryId));

    // 1. Mark journal entry as void
    transaction.update(journalDocRef, {
      status: 'void',
      voidedAt: serverTimestamp(),
      voidedBy,
      voidReason: reason,
    });

    // 2. Create reversing GL entries (swap debits and credits)
    for (const line of journalEntry.lines) {
      const glDocRef = doc(collection(db, paths.generalLedger(tenantId)));
      transaction.set(glDocRef, {
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        journalEntryId: journalEntryId,
        entryNumber: `${journalEntry.entryNumber}-VOID`,
        entryDate: journalEntry.date,
        description: `VOID: ${line.description || journalEntry.description}`,
        debit: line.credit,   // Swap: original credit becomes debit
        credit: line.debit,   // Swap: original debit becomes credit
        balance: 0,
        fiscalYear: journalEntry.fiscalYear,
        fiscalPeriod: journalEntry.fiscalPeriod,
        createdAt: serverTimestamp(),
      });
    }

    // Audit trail: voided journal entry (inside parent transaction)
    const auditDocRef = doc(db, paths.auditLogs(tenantId), `acct_${journalEntryId}_void`);
    transaction.set(auditDocRef, {
      userId: voidedBy,
      userEmail: voidedBy,
      action: 'accounting.journal_void',
      module: 'accounting',
      description: `Voided journal entry ${journalEntry.entryNumber}${reason ? `: ${reason}` : ''}`,
      timestamp: serverTimestamp(),
      tenantId,
      entityId: journalEntryId,
      entityType: 'journal_entry',
      entityName: journalEntry.entryNumber,
      metadata: {
        source: journalEntry.source,
        sourceId: journalEntry.sourceId || null,
        totalDebit: journalEntry.totalDebit,
        totalCredit: journalEntry.totalCredit,
        date: journalEntry.date,
        reason,
      },
      severity: 'critical',
    });
  }

  async createReversingJournalEntry(
    tenantId: string,
    originalEntry: JournalEntry,
    params: {
      date: string;
      createdBy: string;
      reason: string;
      txn?: Transaction;
    }
  ): Promise<string> {
    if (!originalEntry?.id) {
      throw new Error('Original journal entry is missing id');
    }

    const { year, period: month } = getFiscalDateParts(params.date);
    const entryNumber = await this.getNextEntryNumber(tenantId, year, params.txn);

    const lines: JournalEntryLine[] = originalEntry.lines.map((line, idx) => ({
      lineNumber: idx + 1,
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      debit: line.credit,
      credit: line.debit,
      description: line.description,
      departmentId: line.departmentId,
      employeeId: line.employeeId,
      projectId: line.projectId,
    }));

    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: params.date,
      description: `Reversal of ${originalEntry.entryNumber}: ${params.reason}`,
      source: 'adjustment',
      sourceId: originalEntry.id,
      sourceRef: originalEntry.entryNumber,
      lines,
      totalDebit: originalEntry.totalDebit,
      totalCredit: originalEntry.totalCredit,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: params.createdBy,
      fiscalYear: year,
      fiscalPeriod: month,
      createdBy: params.createdBy,
    };

    return await this.createJournalEntry(tenantId, journalEntry, params.txn);
  }

  /**
   * Generate next entry number via Firestore transaction on a single settings doc.
   * NOTE: This limits throughput to ~1 write/sec per tenant. Acceptable for current
   * scale (1-2 admins). If high-volume concurrent numbering is needed, switch to
   * a distributed counter or timestamp-based IDs (e.g., JE-2026-10-ABC1).
   */
  async getNextEntryNumber(tenantId: string, year: number, txn?: Transaction): Promise<string> {
    const settingsRef = doc(db, paths.accountingSettings(tenantId));
    const currentYear = parseInt(getTodayTL().slice(0, 4), 10);

    const doWork = async (transaction: Transaction) => {
      const settingsSnap = await transaction.get(settingsRef);

      let prefix = 'JE';
      let nextNum = 1;

      if (settingsSnap.exists()) {
        const settings = settingsSnap.data() as Partial<AccountingSettings> & {
          nextJournalNumberByYear?: Record<string, number>;
        };
        prefix = settings.journalEntryPrefix || 'JE';

        const byYear = settings.nextJournalNumberByYear || {};
        const yearKey = String(year);
        const fromYearCounter = byYear[yearKey];

        if (typeof fromYearCounter === 'number' && fromYearCounter > 0) {
          nextNum = Math.floor(fromYearCounter);
        } else if (
          year === currentYear &&
          typeof settings.nextJournalNumber === 'number' &&
          settings.nextJournalNumber > 0
        ) {
          nextNum = Math.floor(settings.nextJournalNumber);
        }

        transaction.set(settingsRef, {
          journalEntryPrefix: prefix,
          nextJournalNumber: year === currentYear ? nextNum + 1 : settings.nextJournalNumber || 1,
          nextJournalNumberByYear: {
            ...byYear,
            [yearKey]: nextNum + 1,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        transaction.set(settingsRef, {
          journalEntryPrefix: 'JE',
          nextJournalNumber: year === currentYear ? 2 : 1,
          nextJournalNumberByYear: {
            [String(year)]: 2,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      return `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
    };

    if (txn) {
      return doWork(txn);
    }
    return runTransaction(db, doWork);
  }

  /**
   * Allocate a block of sequential entry numbers in a single transaction.
   * Returns { start, end, prefix } where start..end is the inclusive range.
   * Use this during payroll batch posting to avoid N separate transactions.
   */
  async allocateEntryNumberBlock(
    tenantId: string,
    year: number,
    blockSize: number = 10,
  ): Promise<{ start: number; end: number; prefix: string }> {
    const settingsRef = doc(db, paths.accountingSettings(tenantId));
    const currentYear = parseInt(getTodayTL().slice(0, 4), 10);

    return runTransaction(db, async (transaction) => {
      const settingsSnap = await transaction.get(settingsRef);

      let prefix = 'JE';
      let nextNum = 1;

      if (settingsSnap.exists()) {
        const settings = settingsSnap.data() as Partial<AccountingSettings> & {
          nextJournalNumberByYear?: Record<string, number>;
        };
        prefix = settings.journalEntryPrefix || 'JE';

        const byYear = settings.nextJournalNumberByYear || {};
        const yearKey = String(year);
        const fromYearCounter = byYear[yearKey];

        if (typeof fromYearCounter === 'number' && fromYearCounter > 0) {
          nextNum = Math.floor(fromYearCounter);
        } else if (
          year === currentYear &&
          typeof settings.nextJournalNumber === 'number' &&
          settings.nextJournalNumber > 0
        ) {
          nextNum = Math.floor(settings.nextJournalNumber);
        }

        const newNext = nextNum + blockSize;
        transaction.set(settingsRef, {
          journalEntryPrefix: prefix,
          nextJournalNumber: year === currentYear ? newNext : settings.nextJournalNumber || 1,
          nextJournalNumberByYear: {
            ...byYear,
            [yearKey]: newNext,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        transaction.set(settingsRef, {
          journalEntryPrefix: 'JE',
          nextJournalNumber: year === currentYear ? 1 + blockSize : 1,
          nextJournalNumberByYear: {
            [String(year)]: 1 + blockSize,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      return { start: nextNum, end: nextNum + blockSize - 1, prefix };
    });
  }

  /** Format an entry number from a block allocation. */
  formatEntryNumber(prefix: string, year: number, num: number): string {
    return `${prefix}-${year}-${String(num).padStart(4, '0')}`;
  }

  /**
   * Create journal entry from payroll run
   */
  async createFromPayroll(
    tenantId: string,
    payrollRun: TLPayrollRun,
    records: TLPayrollRecord[]
  ): Promise<string> {
    const totals = summarizePayrollForAccounting(records.map((record) => ({
      totalGrossPay: record.grossPay,
      totalDeductions: record.totalDeductions,
      netPay: record.netPay,
      deductions: record.deductions,
      employerTaxes: [{ type: 'inss_employer', amount: record.inssEmployer }],
    })));

    return this.createFromPayrollSummary({
      periodStart: payrollRun.periodStart,
      periodEnd: payrollRun.periodEnd,
      payDate: payrollRun.payDate,
      totalGrossPay: totals.totalWagesExpense,
      totalINSSEmployer: totals.totalINSSEmployer,
      totalIncomeTax: totals.totalIncomeTax,
      totalINSSEmployee: totals.totalINSSEmployee,
      totalNetPay: totals.totalNetPay,
      totalAdvanceRepayments: totals.totalAdvanceRepayments,
      totalOtherDeductions: totals.totalOtherDeductions,
      employeeCount: payrollRun.employeeCount,
      approvedBy: payrollRun.approvedBy,
      sourceId: payrollRun.id,
    }, tenantId);
  }

  /**
   * Create journal entry from summary payroll totals (generic payroll flow)
   * Use this when detailed TL payroll records are not available.
   */
  async createFromPayrollSummary(summary: {
    periodStart: string;
    periodEnd: string;
    payDate: string;
    totalGrossPay: number;
    totalINSSEmployer: number;
    totalIncomeTax: number;
    totalINSSEmployee: number;
    totalNetPay: number;
    totalAdvanceRepayments?: number;
    totalOtherDeductions?: number;
    employeeCount: number;
    approvedBy?: string;
    sourceId?: string;
    allocations?: Array<{
      projectCode: string;
      fundingSource: string;
      grossPay: number;
      inssEmployer: number;
    }>;
  }, tenantId: string): Promise<string> {
    if (summary.sourceId) {
      const existing = await this.getJournalEntryBySource(
        tenantId,
        'payroll',
        summary.sourceId,
      );
      if (existing?.id && existing.status === 'posted') {
        return existing.id;
      }
    }

    const { year, period: month } = getFiscalDateParts(summary.periodEnd);
    const entryNumber = await this.getNextEntryNumber(tenantId, year);

    const lines: JournalEntryLine[] = [];
    let lineNumber = 1;

    const getAccountId = async (code: string) => {
      const account = await accountService.getAccountByCode(tenantId, code);
      if (!account?.id) {
        throw new Error(`Missing account for code ${code}. Initialize chart of accounts first.`);
      }
      return { id: account.id, name: account.name };
    };

    const salaryAccount = await getAccountId('5110');
    const inssExpense = await getAccountId('5150');

    const allocationRows = (summary.allocations ?? [])
      .map((row) => ({
        projectCode: row.projectCode?.trim() || 'Unassigned',
        fundingSource: row.fundingSource?.trim() || 'Unassigned',
        grossPay: addMoney(row.grossPay || 0),
        inssEmployer: addMoney(row.inssEmployer || 0),
      }))
      .filter((row) => row.grossPay > 0 || row.inssEmployer > 0);

    if (allocationRows.length > 0) {
      let allocatedGross = 0;
      let allocatedINSS = 0;

      for (const allocation of allocationRows) {
        if (allocation.grossPay > 0) {
          lines.push({
            lineNumber: lineNumber++,
            accountId: salaryAccount.id,
            accountCode: '5110',
            accountName: salaryAccount.name,
            debit: allocation.grossPay,
            credit: 0,
            description: `Gross salaries (${allocation.projectCode} | ${allocation.fundingSource})`,
            projectId: allocation.projectCode,
            departmentId: allocation.fundingSource,
          });
          allocatedGross = addMoney(allocatedGross, allocation.grossPay);
        }
        if (allocation.inssEmployer > 0) {
          lines.push({
            lineNumber: lineNumber++,
            accountId: inssExpense.id,
            accountCode: '5150',
            accountName: inssExpense.name,
            debit: allocation.inssEmployer,
            credit: 0,
            description: `INSS employer contribution (${allocation.projectCode} | ${allocation.fundingSource})`,
            projectId: allocation.projectCode,
            departmentId: allocation.fundingSource,
          });
          allocatedINSS = addMoney(allocatedINSS, allocation.inssEmployer);
        }
      }

      const grossRemainder = subtractMoney(summary.totalGrossPay, allocatedGross);
      if (grossRemainder < 0) {
        throw new Error('Payroll allocations exceed total wages expense');
      }
      if (grossRemainder > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountId: salaryAccount.id,
          accountCode: '5110',
          accountName: salaryAccount.name,
          debit: grossRemainder,
          credit: 0,
          description: 'Gross salaries (Unassigned)',
          projectId: 'Unassigned',
          departmentId: 'Unassigned',
        });
      }

      const inssRemainder = subtractMoney(summary.totalINSSEmployer, allocatedINSS);
      if (inssRemainder < 0) {
        throw new Error('Payroll allocations exceed total employer INSS expense');
      }
      if (inssRemainder > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountId: inssExpense.id,
          accountCode: '5150',
          accountName: inssExpense.name,
          debit: inssRemainder,
          credit: 0,
          description: 'INSS employer contribution (Unassigned)',
          projectId: 'Unassigned',
          departmentId: 'Unassigned',
        });
      }
    } else {
      lines.push({
        lineNumber: lineNumber++,
        accountId: salaryAccount.id,
        accountCode: '5110',
        accountName: salaryAccount.name,
        debit: summary.totalGrossPay,
        credit: 0,
        description: 'Gross salaries',
      });

      lines.push({
        lineNumber: lineNumber++,
        accountId: inssExpense.id,
        accountCode: '5150',
        accountName: inssExpense.name,
        debit: summary.totalINSSEmployer,
        credit: 0,
        description: 'INSS employer contribution (6%)',
      });
    }

    const salariesPayable = await getAccountId('2210');
    lines.push({
      lineNumber: lineNumber++,
      accountId: salariesPayable.id,
      accountCode: '2210',
      accountName: salariesPayable.name,
      debit: 0,
      credit: summary.totalNetPay,
      description: 'Net salaries payable',
    });

    const witPayable = await getAccountId('2220');
    lines.push({
      lineNumber: lineNumber++,
      accountId: witPayable.id,
      accountCode: '2220',
      accountName: witPayable.name,
      debit: 0,
      credit: summary.totalIncomeTax,
      description: 'Withholding Income Tax (WIT)',
    });

    const inssEmployeePayable = await getAccountId('2230');
    lines.push({
      lineNumber: lineNumber++,
      accountId: inssEmployeePayable.id,
      accountCode: '2230',
      accountName: inssEmployeePayable.name,
      debit: 0,
      credit: summary.totalINSSEmployee,
      description: 'INSS employee contribution (4%)',
    });

    const inssEmployerPayable = await getAccountId('2240');
    lines.push({
      lineNumber: lineNumber++,
      accountId: inssEmployerPayable.id,
      accountCode: '2240',
      accountName: inssEmployerPayable.name,
      debit: 0,
      credit: summary.totalINSSEmployer,
      description: 'INSS employer contribution (6%)',
    });

    if ((summary.totalAdvanceRepayments || 0) > 0) {
      const employeeAdvances = await getAccountId('1220');
      lines.push({
        lineNumber: lineNumber++,
        accountId: employeeAdvances.id,
        accountCode: '1220',
        accountName: employeeAdvances.name,
        debit: 0,
        credit: summary.totalAdvanceRepayments || 0,
        description: 'Employee loan and advance repayments',
      });
    }

    if ((summary.totalOtherDeductions || 0) > 0) {
      // Use the long-standing payroll-liabilities control account so existing
      // tenants do not need a chart-of-accounts migration before approval.
      const otherPayrollDeductions = await getAccountId('2200');
      lines.push({
        lineNumber: lineNumber++,
        accountId: otherPayrollDeductions.id,
        accountCode: '2200',
        accountName: otherPayrollDeductions.name,
        debit: 0,
        credit: summary.totalOtherDeductions || 0,
        description: 'Other payroll deductions payable',
      });
    }

    const totalDebit = sumMoney(lines.map((line) => line.debit));
    const totalCredit = sumMoney(lines.map((line) => line.credit));

    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: summary.payDate,
      description: `Payroll for ${summary.periodStart} to ${summary.periodEnd}`,
      source: 'payroll',
      sourceId: summary.sourceId,
      sourceRef: `Payroll Run - ${summary.employeeCount} employees`,
      lines,
      totalDebit,
      totalCredit,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: summary.approvedBy || 'system',
      fiscalYear: year,
      fiscalPeriod: month,
    };

    return await this.createJournalEntry(tenantId, journalEntry);
  }

  // ============================================
  // MONEY MODULE JOURNAL ENTRIES
  // ============================================

  /**
   * Create journal entry when an invoice is sent
   * Debit: Trade Receivables (1210)
   * Credit: Service Revenue (4100) + Sales Tax Payable (2310)
   */
  async createFromInvoice(
    tenantId: string,
    invoice: Invoice,
    createdBy: string,
    txn?: Transaction,
    resolvedAccounts?: Record<string, { id: string; name: string }>
  ): Promise<string> {
    const invoiceDate = invoice.issueDate;
    const { year, period: month } = getFiscalDateParts(invoiceDate);
    const entryNumber = await this.getNextEntryNumber(tenantId, year, txn);

    const getAccountId = async (code: string) => {
      if (resolvedAccounts?.[code]) return resolvedAccounts[code];
      const account = await accountService.getAccountByCode(tenantId, code);
      if (!account?.id) {
        throw new Error(`Missing account for code ${code}. Initialize chart of accounts first.`);
      }
      return { id: account.id, name: account.name };
    };

    const mapping = MONEY_JOURNAL_MAPPINGS.invoiceCreated;
    const arAccount = await getAccountId(mapping.debit.code);
    const revenueAccount = await getAccountId(mapping.credit.code);
    const taxAmount = toMoney(toDecimal(invoice.taxAmount || 0));
    const revenueAmount = subtractMoney(invoice.total, taxAmount);
    const taxAccount = taxAmount > 0 ? await getAccountId('2310') : null;

    const lines: JournalEntryLine[] = [
      {
        lineNumber: 1,
        accountId: arAccount.id,
        accountCode: mapping.debit.code,
        accountName: arAccount.name,
        debit: invoice.total,
        credit: 0,
        description: `AR - ${invoice.invoiceNumber}`,
      },
      {
        lineNumber: 2,
        accountId: revenueAccount.id,
        accountCode: mapping.credit.code,
        accountName: revenueAccount.name,
        debit: 0,
        credit: revenueAmount,
        description: `Revenue - ${invoice.invoiceNumber}`,
      },
    ];

    if (taxAccount && taxAmount > 0) {
      lines.push({
        lineNumber: 3,
        accountId: taxAccount.id,
        accountCode: '2310',
        accountName: taxAccount.name,
        debit: 0,
        credit: taxAmount,
        description: `Sales tax payable - ${invoice.invoiceNumber}`,
      });
    }

    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: invoiceDate,
      description: `Invoice ${invoice.invoiceNumber} - ${invoice.customerName}`,
      source: 'invoice',
      sourceId: invoice.id,
      sourceRef: invoice.invoiceNumber,
      lines,
      totalDebit: invoice.total,
      totalCredit: invoice.total,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: createdBy,
      fiscalYear: year,
      fiscalPeriod: month,
    };

    return await this.createJournalEntry(tenantId, journalEntry, txn);
  }

  /**
   * Create journal entry when payment is received on an invoice
   * Debit: Cash in Bank (1120) or Cash on Hand (1110)
   * Credit: Trade Receivables (1210)
   */
  async createFromInvoicePayment(
    tenantId: string,
    payment: {
      invoiceId: string;
      invoiceNumber: string;
      customerName: string;
      date: string;
      amount: number;
      method: PaymentMethod;
      reference?: string;
    },
    createdBy: string,
    txn?: Transaction,
    resolvedAccounts?: Record<string, { id: string; name: string }>
  ): Promise<string> {
    const { year, period: month } = getFiscalDateParts(payment.date);
    const entryNumber = await this.getNextEntryNumber(tenantId, year, txn);

    const getAccountId = async (code: string) => {
      if (resolvedAccounts?.[code]) return resolvedAccounts[code];
      const account = await accountService.getAccountByCode(tenantId, code);
      if (!account?.id) {
        throw new Error(`Missing account for code ${code}. Initialize chart of accounts first.`);
      }
      return { id: account.id, name: account.name };
    };

    // Use Cash on Hand for cash payments, Bank for others
    const cashCode = payment.method === 'cash' ? '1110' : '1120';
    const cashAccount = await getAccountId(cashCode);
    const arAccount = await getAccountId('1210');

    const lines: JournalEntryLine[] = [
      {
        lineNumber: 1,
        accountId: cashAccount.id,
        accountCode: cashCode,
        accountName: cashAccount.name,
        debit: payment.amount,
        credit: 0,
        description: `Payment received - ${payment.invoiceNumber}`,
      },
      {
        lineNumber: 2,
        accountId: arAccount.id,
        accountCode: '1210',
        accountName: arAccount.name,
        debit: 0,
        credit: payment.amount,
        description: `Clear AR - ${payment.invoiceNumber}`,
      },
    ];

    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: payment.date,
      description: `Payment received for ${payment.invoiceNumber} - ${payment.customerName}`,
      source: 'payment',
      sourceId: payment.invoiceId,
      sourceRef: payment.reference || payment.invoiceNumber,
      lines,
      totalDebit: payment.amount,
      totalCredit: payment.amount,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: createdBy,
      fiscalYear: year,
      fiscalPeriod: month,
    };

    return await this.createJournalEntry(tenantId, journalEntry, txn);
  }

  /**
   * Create journal entry when a bill (vendor invoice) is received
   * Debit: Expense account (based on category)
   * Credit: Trade Payables (2110)
   */
  async createFromBill(
    tenantId: string,
    bill: Bill,
    createdBy: string,
    txn?: Transaction,
    resolvedAccounts?: Record<string, { id: string; name: string }>
  ): Promise<string> {
    const { year, period: month } = getFiscalDateParts(bill.billDate);
    const entryNumber = await this.getNextEntryNumber(tenantId, year, txn);

    // Use pre-resolved accounts (transaction-safe) or fall back to query (non-transaction path)
    const getAccountId = async (code: string) => {
      if (resolvedAccounts?.[code]) return resolvedAccounts[code];
      const account = await accountService.getAccountByCode(tenantId, code);
      if (!account?.id) {
        throw new Error(`Missing account for code ${code}. Initialize chart of accounts first.`);
      }
      return { id: account.id, name: account.name };
    };

    // Get expense account from category
    const expenseMapping = EXPENSE_CATEGORY_TO_ACCOUNT[bill.category] || EXPENSE_CATEGORY_TO_ACCOUNT.other;
    const expenseAccount = await getAccountId(expenseMapping.code);
    const apAccount = await getAccountId('2110');

    const lines: JournalEntryLine[] = [
      {
        lineNumber: 1,
        accountId: expenseAccount.id,
        accountCode: expenseMapping.code,
        accountName: expenseAccount.name,
        debit: bill.total,
        credit: 0,
        description: `${bill.description} - ${bill.vendorName}`,
      },
      {
        lineNumber: 2,
        accountId: apAccount.id,
        accountCode: '2110',
        accountName: apAccount.name,
        debit: 0,
        credit: bill.total,
        description: `AP - ${bill.billNumber || bill.vendorName}`,
      },
    ];

    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: bill.billDate,
      description: `Bill from ${bill.vendorName} - ${bill.description}`,
      source: 'bill',
      sourceId: bill.id,
      sourceRef: bill.billNumber || `Bill-${bill.id.slice(0, 8)}`,
      lines,
      totalDebit: bill.total,
      totalCredit: bill.total,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: createdBy,
      fiscalYear: year,
      fiscalPeriod: month,
    };

    return await this.createJournalEntry(tenantId, journalEntry, txn);
  }

  /**
   * Create journal entry when a bill is paid
   * Debit: Trade Payables (2110)
   * Credit: Cash in Bank (1120) or Cash on Hand (1110)
   */
  async createFromBillPayment(
    tenantId: string,
    payment: {
      billId: string;
      billNumber?: string;
      vendorName: string;
      date: string;
      amount: number;
      cashPaid?: number;
      withholdingTax?: number;
      method: PaymentMethod;
      reference?: string;
    },
    createdBy: string,
    txn?: Transaction,
    resolvedAccounts?: Record<string, { id: string; name: string }>
  ): Promise<string> {
    const { year, period: month } = getFiscalDateParts(payment.date);
    const entryNumber = await this.getNextEntryNumber(tenantId, year, txn);

    const getAccountId = async (code: string) => {
      if (resolvedAccounts?.[code]) return resolvedAccounts[code];
      const account = await accountService.getAccountByCode(tenantId, code);
      if (!account?.id) {
        throw new Error(`Missing account for code ${code}. Initialize chart of accounts first.`);
      }
      return { id: account.id, name: account.name };
    };

    const apAccount = await getAccountId('2110');
    // Use Cash on Hand for cash payments, Bank for others
    const cashCode = payment.method === 'cash' ? '1110' : '1120';
    const cashAccount = await getAccountId(cashCode);
    const { grossAmount, cashPaid, withholdingTax } = calculateBillPaymentPostingAmounts(
      payment.amount,
      payment.cashPaid,
      payment.withholdingTax,
    );
    const withholdingAccount = withholdingTax > 0
      ? await getAccountId('2320')
      : null;

    const refLabel = payment.billNumber || `Bill-${payment.billId.slice(0, 8)}`;

    const lines: JournalEntryLine[] = [
      {
        lineNumber: 1,
        accountId: apAccount.id,
        accountCode: '2110',
        accountName: apAccount.name,
        debit: grossAmount,
        credit: 0,
        description: `Clear AP - ${refLabel}`,
      },
    ];
    if (cashPaid > 0) {
      lines.push({
        lineNumber: lines.length + 1,
        accountId: cashAccount.id,
        accountCode: cashCode,
        accountName: cashAccount.name,
        debit: 0,
        credit: cashPaid,
        description: `Payment to ${payment.vendorName}`,
      });
    }
    if (withholdingAccount) {
      lines.push({
        lineNumber: lines.length + 1,
        accountId: withholdingAccount.id,
        accountCode: '2320',
        accountName: withholdingAccount.name,
        debit: 0,
        credit: withholdingTax,
        description: `Supplier withholding tax - ${refLabel}`,
      });
    }

    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: payment.date,
      description: `Bill payment to ${payment.vendorName} - ${refLabel}`,
      source: 'payment',
      sourceId: payment.billId,
      sourceRef: payment.reference || refLabel,
      lines,
      totalDebit: grossAmount,
      totalCredit: grossAmount,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: createdBy,
      fiscalYear: year,
      fiscalPeriod: month,
    };

    return await this.createJournalEntry(tenantId, journalEntry, txn);
  }

  /**
   * Clear supplier withholding only when an actual ATTL payment is recorded.
   * A filed return is not a cash event and must never call this method.
   */
  async createFromSupplierWithholdingRemittance(
    tenantId: string,
    remittance: {
      id: string;
      period: string;
      paymentDate: string;
      amount: number;
      method: 'bank_transfer' | 'cash_at_bnu';
      paymentReference: string;
      proofUrl: string;
    },
    createdBy: string,
    txn: Transaction,
    resolvedAccounts: Record<string, { id: string; name: string }>,
  ): Promise<string> {
    const { year, period: month } = getFiscalDateParts(remittance.paymentDate);
    const entryNumber = await this.getNextEntryNumber(tenantId, year, txn);
    const withholdingAccount = resolvedAccounts['2320'];
    const cashCode = remittance.method === 'cash_at_bnu' ? '1110' : '1120';
    const cashAccount = resolvedAccounts[cashCode];
    if (!withholdingAccount?.id) {
      throw new Error('Missing account for code 2320.');
    }
    if (!cashAccount?.id) {
      throw new Error(`Missing account for code ${cashCode}.`);
    }

    const amount = roundMoney(remittance.amount);
    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: remittance.paymentDate,
      description: `Supplier withholding remittance - ${remittance.period}`,
      source: 'tax_payment',
      sourceId: remittance.id,
      sourceRef: remittance.paymentReference,
      attachments: [remittance.proofUrl],
      lines: [
        {
          lineNumber: 1,
          accountId: withholdingAccount.id,
          accountCode: '2320',
          accountName: withholdingAccount.name,
          debit: amount,
          credit: 0,
          description: `Clear supplier withholding payable - ${remittance.period}`,
        },
        {
          lineNumber: 2,
          accountId: cashAccount.id,
          accountCode: cashCode,
          accountName: cashAccount.name,
          debit: 0,
          credit: amount,
          description: `ATTL payment - ${remittance.paymentReference}`,
        },
      ],
      totalDebit: amount,
      totalCredit: amount,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: createdBy,
      fiscalYear: year,
      fiscalPeriod: month,
      createdBy,
    };

    return this.createJournalEntry(tenantId, journalEntry, txn);
  }

  async createFromCashAdvanceIssue(
    tenantId: string,
    advance: {
      id: string;
      employeeName: string;
      purpose: string;
      issueDate: string;
      amount: number;
      fundingMethod: 'cash' | 'bank_transfer';
      issueReference: string;
      issueProofUrl: string;
    },
    createdBy: string,
    txn: Transaction,
    resolvedAccounts: Record<string, { id: string; name: string }>,
  ): Promise<string> {
    const { year, period: month } = getFiscalDateParts(advance.issueDate);
    const entryNumber = await this.getNextEntryNumber(tenantId, year, txn);
    const advanceAccount = resolvedAccounts['1230'];
    const cashCode = advance.fundingMethod === 'cash' ? '1110' : '1120';
    const cashAccount = resolvedAccounts[cashCode];
    if (!advanceAccount?.id || !cashAccount?.id) {
      throw new Error('Cash advance accounts were not resolved.');
    }
    const amount = roundMoney(advance.amount);
    return this.createJournalEntry(tenantId, {
      entryNumber,
      date: advance.issueDate,
      description: `Expense advance to ${advance.employeeName}`,
      source: 'cash_advance',
      sourceId: advance.id,
      sourceRef: advance.issueReference,
      attachments: [advance.issueProofUrl],
      lines: [
        {
          lineNumber: 1,
          accountId: advanceAccount.id,
          accountCode: '1230',
          accountName: advanceAccount.name,
          debit: amount,
          credit: 0,
          description: advance.purpose,
        },
        {
          lineNumber: 2,
          accountId: cashAccount.id,
          accountCode: cashCode,
          accountName: cashAccount.name,
          debit: 0,
          credit: amount,
          description: `Advance issued - ${advance.issueReference}`,
        },
      ],
      totalDebit: amount,
      totalCredit: amount,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: createdBy,
      fiscalYear: year,
      fiscalPeriod: month,
      createdBy,
    }, txn);
  }

  async createFromCashAdvanceClearing(
    tenantId: string,
    clearing: {
      id: string;
      advanceId: string;
      employeeName: string;
      type: 'expense' | 'return';
      date: string;
      amount: number;
      description: string;
      proofUrl: string;
      expenseAccountCode?: string;
      returnMethod?: 'cash' | 'bank_transfer';
      reference?: string;
    },
    createdBy: string,
    txn: Transaction,
    resolvedAccounts: Record<string, { id: string; name: string }>,
  ): Promise<string> {
    const { year, period: month } = getFiscalDateParts(clearing.date);
    const entryNumber = await this.getNextEntryNumber(tenantId, year, txn);
    const advanceAccount = resolvedAccounts['1230'];
    if (!advanceAccount?.id) throw new Error('Missing account for code 1230.');
    const debitCode = clearing.type === 'expense'
      ? clearing.expenseAccountCode
      : clearing.returnMethod === 'cash' ? '1110' : '1120';
    if (!debitCode || !resolvedAccounts[debitCode]?.id) {
      throw new Error('Cash advance clearing account was not resolved.');
    }
    const debitAccount = resolvedAccounts[debitCode];
    const amount = roundMoney(clearing.amount);
    const sourceRef = clearing.reference || `Advance-${clearing.advanceId.slice(0, 8)}`;
    return this.createJournalEntry(tenantId, {
      entryNumber,
      date: clearing.date,
      description: `${clearing.type === 'expense' ? 'Expense receipt' : 'Unused cash returned'} - ${clearing.employeeName}`,
      source: 'cash_advance',
      sourceId: clearing.id,
      sourceRef,
      attachments: [clearing.proofUrl],
      lines: [
        {
          lineNumber: 1,
          accountId: debitAccount.id,
          accountCode: debitCode,
          accountName: debitAccount.name,
          debit: amount,
          credit: 0,
          description: clearing.description,
        },
        {
          lineNumber: 2,
          accountId: advanceAccount.id,
          accountCode: '1230',
          accountName: advanceAccount.name,
          debit: 0,
          credit: amount,
          description: `Clear staff expense advance - ${clearing.employeeName}`,
        },
      ],
      totalDebit: amount,
      totalCredit: amount,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: createdBy,
      fiscalYear: year,
      fiscalPeriod: month,
      createdBy,
    }, txn);
  }

  /**
   * Create journal entry when an expense is recorded (direct expense, not from a bill)
   * Debit: Expense account (based on category)
   * Credit: Cash in Bank (1120) or Cash on Hand (1110)
   */
  async createFromExpense(
    tenantId: string,
    expense: Expense,
    createdBy: string,
    txn?: Transaction,
    resolvedAccounts?: Record<string, { id: string; name: string }>
  ): Promise<string> {
    const { year, period: month } = getFiscalDateParts(expense.date);
    const entryNumber = await this.getNextEntryNumber(tenantId, year, txn);

    // Use pre-resolved accounts (transaction-safe) or fall back to query (non-transaction path)
    const getAccountId = async (code: string) => {
      if (resolvedAccounts?.[code]) return resolvedAccounts[code];
      const account = await accountService.getAccountByCode(tenantId, code);
      if (!account?.id) {
        throw new Error(`Missing account for code ${code}. Initialize chart of accounts first.`);
      }
      return { id: account.id, name: account.name };
    };

    // Get expense account from category
    const expenseMapping = EXPENSE_CATEGORY_TO_ACCOUNT[expense.category] || EXPENSE_CATEGORY_TO_ACCOUNT.other;
    const expenseAccount = await getAccountId(expenseMapping.code);

    // Use Cash on Hand for cash payments, Bank for others
    const cashCode = expense.paymentMethod === 'cash' ? '1110' : '1120';
    const cashAccount = await getAccountId(cashCode);

    const lines: JournalEntryLine[] = [
      {
        lineNumber: 1,
        accountId: expenseAccount.id,
        accountCode: expenseMapping.code,
        accountName: expenseAccount.name,
        debit: expense.amount,
        credit: 0,
        description: expense.description,
      },
      {
        lineNumber: 2,
        accountId: cashAccount.id,
        accountCode: cashCode,
        accountName: cashAccount.name,
        debit: 0,
        credit: expense.amount,
        description: `Expense - ${expense.description}`,
      },
    ];

    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: expense.date,
      description: `Expense: ${expense.description}${expense.vendorName ? ` - ${expense.vendorName}` : ''}`,
      source: 'receipt', // Using 'receipt' for direct expenses
      sourceId: expense.id,
      sourceRef: `EXP-${expense.id.slice(0, 8)}`,
      lines,
      totalDebit: expense.amount,
      totalCredit: expense.amount,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: createdBy,
      fiscalYear: year,
      fiscalPeriod: month,
    };

    return await this.createJournalEntry(tenantId, journalEntry, txn);
  }
}

// ============================================
// GENERAL LEDGER SERVICE
// ============================================

class GeneralLedgerService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.generalLedger(tenantId));
  }

  async createEntriesFromJournal(tenantId: string, journalEntry: JournalEntry): Promise<void> {
    const batch = writeBatch(db);

    for (const line of journalEntry.lines) {
      const docRef = doc(this.collectionRef(tenantId));
      batch.set(docRef, {
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        journalEntryId: journalEntry.id,
        entryNumber: journalEntry.entryNumber,
        entryDate: journalEntry.date,
        description: line.description || journalEntry.description,
        debit: line.debit,
        credit: line.credit,
        balance: 0, // Will be calculated when retrieved
        fiscalYear: journalEntry.fiscalYear,
        fiscalPeriod: journalEntry.fiscalPeriod,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  async getEntriesByAccount(
    tenantId: string,
    accountKey: string,
    options?: {
      accountCode?: string;
      startDate?: string;
      endDate?: string;
      fiscalYear?: number;
      accountType?: AccountType;
      accountSubType?: AccountSubType;
    }
  ): Promise<{ entries: GeneralLedgerEntry[]; openingBalance: number }> {
    // Credit-normal accounts: liability, equity, revenue.
    // Exceptions for contra/temporary accounts in our simplified COA:
    // - accumulated_depreciation (asset, credit-normal)
    // - dividends (equity, debit-normal)
    const isCreditNormal = (() => {
      const type = options?.accountType;
      const subType = options?.accountSubType;
      if (!type) return false;

      if (type === 'asset') return subType === 'accumulated_depreciation';
      if (type === 'expense') return false;
      if (type === 'liability' || type === 'revenue') return true;
      if (type === 'equity') return subType !== 'dividends';
      return false;
    })();

    if (options?.accountCode) {
      const periodQueryConstraints = [where('accountCode', '==', options.accountCode)];

      if (options.startDate) {
        periodQueryConstraints.push(where('entryDate', '>=', options.startDate));
      }
      if (options.endDate) {
        periodQueryConstraints.push(where('entryDate', '<=', options.endDate));
      }

      const periodQuery = query(
        this.collectionRef(tenantId),
        ...periodQueryConstraints,
        orderBy('entryDate'),
      );
      const periodSnapshot = await getDocs(periodQuery);
      const periodEntries = periodSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as GeneralLedgerEntry))
        .sort((a, b) => {
          const dateCmp = a.entryDate.localeCompare(b.entryDate);
          if (dateCmp !== 0) return dateCmp;
          const numberCmp = (a.entryNumber || '').localeCompare(b.entryNumber || '');
          if (numberCmp !== 0) return numberCmp;
          return (a.id || '').localeCompare(b.id || '');
        });

      let openingBalance = 0;
      if (options.startDate) {
        const openingSnapshot = await getDocs(query(
          this.collectionRef(tenantId),
          where('accountCode', '==', options.accountCode),
          where('entryDate', '<', options.startDate),
        ));

        let openingDebit = 0;
        let openingCredit = 0;
        for (const doc of openingSnapshot.docs) {
          const data = doc.data();
          openingDebit = addMoney(openingDebit, Number(data.debit) || 0);
          openingCredit = addMoney(openingCredit, Number(data.credit) || 0);
        }
        openingBalance = isCreditNormal
          ? subtractMoney(openingCredit, openingDebit)
          : subtractMoney(openingDebit, openingCredit);
      }

      let runningBalance = openingBalance;
      const entries = periodEntries.map(entry => {
        runningBalance = isCreditNormal
          ? addMoney(runningBalance, subtractMoney(entry.credit, entry.debit))
          : addMoney(runningBalance, subtractMoney(entry.debit, entry.credit));
        return { ...entry, balance: runningBalance };
      });

      return { entries, openingBalance };
    }

    // Support legacy rows where accountId stored as accountCode by querying both.
    const queries = [
      query(this.collectionRef(tenantId), where('accountId', '==', accountKey), orderBy('entryDate')),
      query(this.collectionRef(tenantId), where('accountCode', '==', accountKey), orderBy('entryDate')),
    ];

    if (options?.fiscalYear) {
      queries[0] = query(queries[0], where('fiscalYear', '==', options.fiscalYear));
      queries[1] = query(queries[1], where('fiscalYear', '==', options.fiscalYear));
    }

    const snapshots = await Promise.all(queries.map(q => getDocs(q)));

    // Merge and dedupe by doc id
    const seen = new Set<string>();
    let allEntries: GeneralLedgerEntry[] = [];
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          allEntries.push({ id: doc.id, ...doc.data() } as GeneralLedgerEntry);
        }
      });
    });

    allEntries.sort((a, b) => {
      const dateCmp = a.entryDate.localeCompare(b.entryDate);
      if (dateCmp !== 0) return dateCmp;
      const numberCmp = (a.entryNumber || '').localeCompare(b.entryNumber || '');
      if (numberCmp !== 0) return numberCmp;
      return (a.id || '').localeCompare(b.id || '');
    });

    // Split into pre-period (opening) and in-period entries
    let openingBalance = 0;
    let periodEntries: GeneralLedgerEntry[] = allEntries;

    if (options?.startDate) {
      const prePeriod = allEntries.filter(e => e.entryDate < options.startDate!);
      periodEntries = allEntries.filter(e => e.entryDate >= options.startDate!);

      // Compute opening balance from pre-period entries
      for (const entry of prePeriod) {
        openingBalance = isCreditNormal
          ? addMoney(openingBalance, subtractMoney(entry.credit, entry.debit))
          : addMoney(openingBalance, subtractMoney(entry.debit, entry.credit));
      }
    }

    if (options?.endDate) {
      periodEntries = periodEntries.filter(e => e.entryDate <= options.endDate!);
    }

    // Calculate running balance starting from opening balance
    let runningBalance = openingBalance;
    const entries = periodEntries.map(entry => {
      runningBalance = isCreditNormal
        ? addMoney(runningBalance, subtractMoney(entry.credit, entry.debit))
        : addMoney(runningBalance, subtractMoney(entry.debit, entry.credit));
      return { ...entry, balance: runningBalance };
    });

    return { entries, openingBalance };
  }

  async getAccountBalance(
    tenantId: string,
    accountId: string,
    accountCode?: string,
    asOfDate?: string
  ): Promise<number> {
    const queries = [
      query(this.collectionRef(tenantId), where('accountId', '==', accountId)),
    ];
    if (accountCode) {
      queries.push(query(this.collectionRef(tenantId), where('accountCode', '==', accountCode)));
    }

    const snapshots = await Promise.all(queries.map(q => getDocs(q)));
    const seen = new Set<string>();
    let entries: GeneralLedgerEntry[] = [];
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          entries.push(doc.data() as GeneralLedgerEntry);
        }
      });
    });

    if (asOfDate) {
      entries = entries.filter(e => e.entryDate <= asOfDate);
    }

    return sumMoney(entries.map(e => subtractMoney(e.debit, e.credit)));
  }
}

// ============================================
// TRIAL BALANCE SERVICE
// ============================================

class TrialBalanceService {
  async getBalanceHealth(
    tenantId: string,
    asOfDate: string,
    _fiscalYear: number,
  ): Promise<{ isBalanced: boolean; source: 'aggregate' | 'empty' }> {
    const ledgerUpToDate = query(
      collection(db, paths.generalLedger(tenantId)),
      where('entryDate', '<=', asOfDate),
    );
    const snapshot = await getDocs(ledgerUpToDate);

    let totalDebit = 0;
    let totalCredit = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      totalDebit = addMoney(totalDebit, Number(data.debit) || 0);
      totalCredit = addMoney(totalCredit, Number(data.credit) || 0);
    }

    if (totalDebit === 0 && totalCredit === 0) {
      return { isBalanced: true, source: 'empty' };
    }

    return {
      isBalanced: toDecimal(totalDebit).minus(totalCredit).abs().lessThan(0.01),
      source: 'aggregate',
    };
  }

  /**
   * Helper: load GL entries, using snapshot+delta when available.
   * Returns entries split into "before cutoff" and "from cutoff to endDate".
   * Falls back to full GL scan when no snapshot exists.
   */
  private async loadGLWithSnapshot(
    tenantId: string,
    cutoffDate: string,
    endDate: string,
  ): Promise<{
    openingById: Map<string, number>;
    openingByCode: Map<string, number>;
    periodDebitById: Map<string, number>;
    periodDebitByCode: Map<string, number>;
    periodCreditById: Map<string, number>;
    periodCreditByCode: Map<string, number>;
  }> {
    const { balanceSnapshotService } = await import('@/services/balanceSnapshotService');

    const openingById = new Map<string, number>();
    const openingByCode = new Map<string, number>();
    const periodDebitById = new Map<string, number>();
    const periodDebitByCode = new Map<string, number>();
    const periodCreditById = new Map<string, number>();
    const periodCreditByCode = new Map<string, number>();

    const addPeriodMovement = (entry: GeneralLedgerEntry) => {
      addToMoneyMap(periodDebitById, entry.accountId, entry.debit);
      addToMoneyMap(periodDebitByCode, entry.accountCode, entry.debit);
      addToMoneyMap(periodCreditById, entry.accountId, entry.credit);
      addToMoneyMap(periodCreditByCode, entry.accountCode, entry.credit);
    };

    // Try to find a snapshot that covers everything before cutoffDate
    const snapshot = await balanceSnapshotService.ensureSnapshotCoverageBefore(tenantId, cutoffDate);

    if (snapshot) {
      // Populate opening balances from snapshot
      for (const entry of snapshot.accounts) {
        addToMoneyMap(openingById, entry.accountId, entry.cumulativeNet);
        addToMoneyMap(openingByCode, entry.accountCode, entry.cumulativeNet);
      }

      // Query GL entries between snapshot end and cutoffDate for remaining opening
      if (snapshot.periodEndDate < cutoffDate) {
        const gapEntries = await balanceSnapshotService.queryGLDelta(
          tenantId,
          snapshot.periodEndDate,
          // We need entries after snapshot end but before cutoff for opening
          // and entries from cutoff to endDate for period
          endDate,
        );
        for (const e of gapEntries) {
          const net = subtractMoney(e.debit, e.credit);
          if (e.entryDate < cutoffDate) {
            addToMoneyMap(openingById, e.accountId, net);
            addToMoneyMap(openingByCode, e.accountCode, net);
          } else if (e.entryDate <= endDate) {
            addPeriodMovement(e);
          }
        }
      } else {
        // Snapshot covers right up to cutoff, just query period entries
        const periodEntries = await balanceSnapshotService.queryGLDelta(
          tenantId,
          snapshot.periodEndDate,
          endDate,
        );
        for (const e of periodEntries) {
          addPeriodMovement(e);
        }
      }
    } else {
      const entries = await balanceSnapshotService.queryGLDelta(tenantId, undefined, endDate);
      entries.forEach(entry => {
        if (entry.entryDate > endDate) return;
        const net = subtractMoney(entry.debit, entry.credit);
        if (entry.entryDate < cutoffDate) {
          addToMoneyMap(openingById, entry.accountId, net);
          addToMoneyMap(openingByCode, entry.accountCode, net);
        } else {
          addPeriodMovement(entry);
        }
      });
    }

    return {
      openingById,
      openingByCode,
      periodDebitById,
      periodDebitByCode,
      periodCreditById,
      periodCreditByCode,
    };
  }

  async generateTrialBalance(tenantId: string, asOfDate: string, fiscalYear: number, periodStart?: string): Promise<TrialBalance> {
    const effectivePeriodStart = periodStart || `${fiscalYear}-01-01`;

    const [accounts, balanceMaps] = await Promise.all([
      accountService.getAllAccounts(tenantId),
      this.loadGLWithSnapshot(tenantId, effectivePeriodStart, asOfDate),
    ]);

    const {
      openingById,
      openingByCode,
      periodDebitById,
      periodDebitByCode,
      periodCreditById,
      periodCreditByCode,
    } = balanceMaps;

    const rows: TrialBalanceRow[] = [];

    for (const account of accounts) {
      if (!account.isActive) continue;

      const openingNet = getAccountNet(openingById, openingByCode, account.id!, account.code);
      const periodDebit = getAccountNet(
        periodDebitById,
        periodDebitByCode,
        account.id!,
        account.code,
      );
      const periodCredit = getAccountNet(
        periodCreditById,
        periodCreditByCode,
        account.id!,
        account.code,
      );
      const periodNet = subtractMoney(periodDebit, periodCredit);
      const closingNet = addMoney(openingNet, periodNet);

      if (toDecimal(openingNet).abs().lessThan(0.01)
        && toDecimal(periodDebit).abs().lessThan(0.01)
        && toDecimal(periodCredit).abs().lessThan(0.01)
        && toDecimal(closingNet).abs().lessThan(0.01)) continue;

      rows.push({
        accountId: account.id!,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        openingDebit: openingNet > 0 ? openingNet : 0,
        openingCredit: openingNet < 0 ? toMoney(toDecimal(openingNet).abs()) : 0,
        periodDebit,
        periodCredit,
        closingDebit: closingNet > 0 ? closingNet : 0,
        closingCredit: closingNet < 0 ? toMoney(toDecimal(closingNet).abs()) : 0,
      });
    }

    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalDebit = sumMoney(rows.map(r => r.closingDebit));
    const totalCredit = sumMoney(rows.map(r => r.closingCredit));

    return {
      asOfDate,
      fiscalYear,
      fiscalPeriod: getFiscalDateParts(asOfDate).period,
      rows,
      totalDebit,
      totalCredit,
      isBalanced: toDecimal(totalDebit).minus(totalCredit).abs().lessThan(0.01),
      generatedAt: new Date(),
      generatedBy: 'system',
    };
  }

  async generateIncomeStatement(
    tenantId: string,
    periodStart: string,
    periodEnd: string,
    fiscalYear: number,
  ): Promise<IncomeStatement> {
    const { balanceSnapshotService } = await import('@/services/balanceSnapshotService');

    const accounts = await accountService.getAllAccounts(tenantId);

    // Try snapshot+delta; fallback to full scan
    const snapshot = await balanceSnapshotService.ensureSnapshotCoverageBefore(tenantId, periodStart);

    const balanceById = new Map<string, number>();
    const balanceByCode = new Map<string, number>();

    if (snapshot) {
      // Query only the delta from snapshot end to periodEnd
      const deltaEntries = await balanceSnapshotService.queryGLDelta(
        tenantId,
        snapshot.periodEndDate,
        periodEnd,
      );
      // We only need entries within [periodStart, periodEnd]
      for (const e of deltaEntries) {
        if (e.entryDate < periodStart) continue;
        const net = subtractMoney(e.debit, e.credit);
        addToMoneyMap(balanceById, e.accountId, net);
        addToMoneyMap(balanceByCode, e.accountCode, net);
      }
    } else {
      const entries = await balanceSnapshotService.queryGLRange(tenantId, periodStart, periodEnd);
      entries.forEach(entry => {
        const net = subtractMoney(entry.debit, entry.credit);
        addToMoneyMap(balanceById, entry.accountId, net);
        addToMoneyMap(balanceByCode, entry.accountCode, net);
      });
    }

    const revenueItems: IncomeStatementRow[] = [];
    const expenseItems: IncomeStatementRow[] = [];

    for (const account of accounts) {
      if (!account.isActive) continue;
      if (account.type !== 'revenue' && account.type !== 'expense') continue;

      const net = getAccountNet(balanceById, balanceByCode, account.id!, account.code);
      if (toDecimal(net).abs().lessThan(0.01)) continue;

      const effectiveAmount = account.type === 'revenue'
        ? toMoney(toDecimal(net).negated())
        : net;

      const row: IncomeStatementRow = {
        accountId: account.id!,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type as 'revenue' | 'expense',
        amount: effectiveAmount,
        level: 0,
        isTotal: false,
      };

      if (account.type === 'revenue') {
        revenueItems.push(row);
      } else {
        expenseItems.push(row);
      }
    }

    revenueItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    expenseItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalRevenue = sumMoney(revenueItems.map(r => r.amount));
    const totalExpenses = sumMoney(expenseItems.map(r => r.amount));
    const netIncome = subtractMoney(totalRevenue, totalExpenses);

    return {
      periodStart,
      periodEnd,
      fiscalYear,
      revenueItems,
      totalRevenue,
      expenseItems,
      totalExpenses,
      netIncome,
      netIncomeLabel: netIncome >= 0 ? 'Net Profit' : 'Net Loss',
      generatedAt: new Date(),
      generatedBy: 'system',
    };
  }

  async generateBalanceSheet(
    tenantId: string,
    asOfDate: string,
    fiscalYear: number,
  ): Promise<BalanceSheet> {
    const { balanceSnapshotService } = await import('@/services/balanceSnapshotService');

    const accounts = await accountService.getAllAccounts(tenantId);
    const snapshot = await balanceSnapshotService.ensureSnapshotCoverageBefore(tenantId, asOfDate);

    const balanceById = new Map<string, number>();
    const balanceByCode = new Map<string, number>();

    if (snapshot) {
      // Seed cumulative balances from snapshot
      for (const entry of snapshot.accounts) {
        addToMoneyMap(balanceById, entry.accountId, entry.cumulativeNet);
        addToMoneyMap(balanceByCode, entry.accountCode, entry.cumulativeNet);
      }

      // Query delta entries after snapshot through asOfDate
      const deltaEntries = await balanceSnapshotService.queryGLDelta(
        tenantId,
        snapshot.periodEndDate,
        asOfDate,
      );
      for (const e of deltaEntries) {
        const net = subtractMoney(e.debit, e.credit);
        addToMoneyMap(balanceById, e.accountId, net);
        addToMoneyMap(balanceByCode, e.accountCode, net);
      }

    } else {
      const entries = await balanceSnapshotService.queryGLDelta(tenantId, undefined, asOfDate);
      entries.forEach(entry => {
        const net = subtractMoney(entry.debit, entry.credit);
        addToMoneyMap(balanceById, entry.accountId, net);
        addToMoneyMap(balanceByCode, entry.accountCode, net);
      });
    }

    const assetItems: BalanceSheetRow[] = [];
    const liabilityItems: BalanceSheetRow[] = [];
    const equityItems: BalanceSheetRow[] = [];
    let currentYearRevenue = 0;
    let currentYearExpenses = 0;

    for (const account of accounts) {
      if (!account.isActive) continue;

      const net = getAccountNet(balanceById, balanceByCode, account.id!, account.code);

      if (account.type === 'revenue' || account.type === 'expense') {
        if (account.type === 'revenue') {
          currentYearRevenue = addMoney(currentYearRevenue, toMoney(toDecimal(net).negated()));
        } else {
          currentYearExpenses = addMoney(currentYearExpenses, net);
        }
        continue;
      }

      if (toDecimal(net).abs().lessThan(0.01)) continue;

      const displayAmount = (account.type === 'liability' || account.type === 'equity')
        ? toMoney(toDecimal(net).negated())
        : net;

      const row: BalanceSheetRow = {
        accountId: account.id!,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type as 'asset' | 'liability' | 'equity',
        amount: displayAmount,
        level: 0,
        isTotal: false,
      };

      if (account.type === 'asset') assetItems.push(row);
      else if (account.type === 'liability') liabilityItems.push(row);
      else if (account.type === 'equity') equityItems.push(row);
    }

    const currentYearEarnings = subtractMoney(currentYearRevenue, currentYearExpenses);
    if (toDecimal(currentYearEarnings).abs().greaterThanOrEqualTo(0.01)) {
      equityItems.push({
        accountId: '__current_year_earnings__',
        accountCode: '',
        // Cumulative since inception — the system has no year-end close, so
        // this line is retained + current-year earnings combined.
        accountName: 'Accumulated Earnings',
        accountType: 'equity',
        amount: currentYearEarnings,
        level: 0,
        isTotal: false,
      });
    }

    assetItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    liabilityItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    equityItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalAssets = sumMoney(assetItems.map(r => r.amount));
    const totalLiabilities = sumMoney(liabilityItems.map(r => r.amount));
    const totalEquity = sumMoney(equityItems.map(r => r.amount));

    const isBalanced = toDecimal(totalAssets)
      .minus(addMoney(totalLiabilities, totalEquity))
      .abs()
      .lessThan(0.01);

    return {
      asOfDate,
      fiscalYear,
      assetItems,
      totalAssets,
      liabilityItems,
      totalLiabilities,
      equityItems,
      totalEquity,
      isBalanced,
      generatedAt: new Date(),
      generatedBy: 'system',
    };
  }
}

// ============================================
// FISCAL PERIOD SERVICE
// ============================================

class FiscalPeriodService {
  private yearCollection(tenantId: string) {
    return collection(db, paths.fiscalYears(tenantId));
  }

  private periodCollection(tenantId: string) {
    return collection(db, paths.fiscalPeriods(tenantId));
  }

  async getPeriodByYearAndPeriod(tenantId: string, year: number, period: number): Promise<FiscalPeriod | null> {
    const q = query(
      this.periodCollection(tenantId),
      where('year', '==', year),
      where('period', '==', period),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as FiscalPeriod;
  }

  async createFiscalYear(tenantId: string, year: number, createdBy?: string): Promise<string> {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const docRef = await addDoc(this.yearCollection(tenantId), {
      year,
      startDate,
      endDate,
      status: 'open',
      openingBalancesPosted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create 12 periods
    const batch = writeBatch(db);
    for (let month = 1; month <= 12; month++) {
      const lastDay = new Date(year, month, 0).getDate();
      const periodRef = doc(this.periodCollection(tenantId));
      batch.set(periodRef, {
        fiscalYearId: docRef.id,
        year,
        period: month,
        startDate: `${year}-${String(month).padStart(2, '0')}-01`,
        endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
        status: 'open',
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();

    if (createdBy) {
      await auditLogService.log({
        userId: createdBy,
        userEmail: createdBy,
        action: 'accounting.period_create_year',
        tenantId,
        entityId: docRef.id,
        entityType: 'fiscal_year',
        entityName: String(year),
        description: `Created fiscal year ${year}`,
        metadata: { year },
        severity: 'info',
      }).catch(err => console.error('Audit log failed:', err));
    }

    return docRef.id;
  }

  async getFiscalYear(tenantId: string, year: number): Promise<FiscalYear | null> {
    const q = query(this.yearCollection(tenantId), where('year', '==', year), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FiscalYear;
  }

  async getCurrentPeriod(tenantId: string): Promise<FiscalPeriod | null> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const q = query(
      this.periodCollection(tenantId),
      where('year', '==', year),
      where('period', '==', month),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FiscalPeriod;
  }

  async getPeriodsForYear(tenantId: string, year: number): Promise<FiscalPeriod[]> {
    const q = query(
      this.periodCollection(tenantId),
      where('year', '==', year),
      orderBy('period', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiscalPeriod));
  }

  async closePeriod(tenantId: string, periodId: string, closedBy: string): Promise<void> {
    const docRef = doc(db, paths.fiscalPeriod(tenantId, periodId));
    const before = await getDoc(docRef);
    const period = before.exists() ? ({ id: before.id, ...before.data() } as FiscalPeriod) : null;
    await updateDoc(docRef, {
      status: 'closed',
      closedAt: serverTimestamp(),
      closedBy,
    });

    await auditLogService.log({
      userId: closedBy,
      userEmail: closedBy,
      action: 'accounting.period_close',
      tenantId,
      entityId: periodId,
      entityType: 'fiscal_period',
      entityName: period ? `${period.year}-${String(period.period).padStart(2, '0')}` : periodId,
      description: period
        ? `Closed fiscal period ${period.year}-${String(period.period).padStart(2, '0')}`
        : `Closed fiscal period ${periodId}`,
      metadata: period ? { year: period.year, period: period.period } : undefined,
      severity: 'warning',
    }).catch(err => console.error('Audit log failed:', err));

    // Generate balance snapshot for the closed period (async, non-blocking)
    if (period) {
      import('@/services/balanceSnapshotService').then(({ balanceSnapshotService }) =>
        balanceSnapshotService.generateSnapshot(tenantId, period, closedBy)
      ).catch(err => console.error('Snapshot generation failed:', err));
    }
  }

  async reopenPeriod(tenantId: string, periodId: string, reopenedBy: string): Promise<void> {
    const docRef = doc(db, paths.fiscalPeriod(tenantId, periodId));
    const before = await getDoc(docRef);
    const period = before.exists() ? ({ id: before.id, ...before.data() } as FiscalPeriod) : null;
    if (period?.status === 'locked') {
      throw new Error('Locked fiscal periods cannot be reopened');
    }
    await updateDoc(docRef, {
      status: 'open',
      closedAt: null,
      closedBy: null,
    });

    await auditLogService.log({
      userId: reopenedBy,
      userEmail: reopenedBy,
      action: 'accounting.period_reopen',
      tenantId,
      entityId: periodId,
      entityType: 'fiscal_period',
      entityName: period ? `${period.year}-${String(period.period).padStart(2, '0')}` : periodId,
      description: period
        ? `Reopened fiscal period ${period.year}-${String(period.period).padStart(2, '0')}`
        : `Reopened fiscal period ${periodId}`,
      metadata: period ? { year: period.year, period: period.period } : undefined,
      severity: 'warning',
    }).catch(err => console.error('Audit log failed:', err));

    // Delete stale snapshots for the reopened period and everything after it
    if (period) {
      import('@/services/balanceSnapshotService').then(({ balanceSnapshotService }) =>
        balanceSnapshotService.deleteSnapshotsFromDate(tenantId, period.endDate)
      ).catch(err => console.error('Snapshot deletion failed:', err));
    }
  }

  async lockPeriod(tenantId: string, periodId: string, lockedBy: string): Promise<void> {
    const docRef = doc(db, paths.fiscalPeriod(tenantId, periodId));
    const before = await getDoc(docRef);
    const period = before.exists() ? ({ id: before.id, ...before.data() } as FiscalPeriod) : null;
    if (period?.status === 'locked') return;
    if (period?.status === 'open') {
      throw new Error('Fiscal period must be closed before it can be locked');
    }

    await updateDoc(docRef, {
      status: 'locked',
      lockedAt: serverTimestamp(),
      lockedBy,
    });

    await auditLogService.log({
      userId: lockedBy,
      userEmail: lockedBy,
      action: 'accounting.period_lock',
      tenantId,
      entityId: periodId,
      entityType: 'fiscal_period',
      entityName: period ? `${period.year}-${String(period.period).padStart(2, '0')}` : periodId,
      description: period
        ? `Locked fiscal period ${period.year}-${String(period.period).padStart(2, '0')}`
        : `Locked fiscal period ${periodId}`,
      metadata: period ? { year: period.year, period: period.period } : undefined,
      severity: 'critical',
    }).catch(err => console.error('Audit log failed:', err));
  }

  async updateFiscalYear(tenantId: string, yearId: string, updates: Partial<FiscalYear>): Promise<void> {
    const docRef = doc(db, paths.fiscalYear(tenantId, yearId));
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }
}

// ============================================
// SETTINGS SERVICE
// ============================================

class AccountingSettingsService {
  private docRef(tenantId: string) {
    return doc(db, paths.accountingSettings(tenantId));
  }

  async getSettings(tenantId: string): Promise<AccountingSettings | null> {
    const docSnap = await getDoc(this.docRef(tenantId));
    if (docSnap.exists()) {
      return docSnap.data() as AccountingSettings;
    }
    return null;
  }

  async updateSettings(tenantId: string, settings: Partial<AccountingSettings>, updatedBy: string): Promise<void> {
    const existing = await this.getSettings(tenantId);
    if (existing) {
      await updateDoc(this.docRef(tenantId), {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy,
      });
    } else {
      // Create default settings
      const { setDoc } = await import('firebase/firestore');
      await setDoc(this.docRef(tenantId), {
        ...settings,
        journalEntryPrefix: 'JE',
        invoicePrefix: 'INV',
        nextJournalNumber: 1,
        nextInvoiceNumber: 1,
        currency: 'USD',
        fiscalYearStart: 1, // January
        autoGeneratePayrollJournals: true,
        updatedAt: serverTimestamp(),
        updatedBy,
      });
    }
  }
}

// ============================================
// EXPORT SERVICE INSTANCES
// ============================================

export const accountService = new AccountService();
export const journalEntryService = new JournalEntryService();
export const generalLedgerService = new GeneralLedgerService();
export const trialBalanceService = new TrialBalanceService();
export const fiscalPeriodService = new FiscalPeriodService();
const accountingSettingsService = new AccountingSettingsService();

// Convenience export
export const accountingService = {
  accounts: accountService,
  journalEntries: journalEntryService,
  generalLedger: generalLedgerService,
  trialBalance: trialBalanceService,
  fiscalPeriods: fiscalPeriodService,
  settings: accountingSettingsService,
};
