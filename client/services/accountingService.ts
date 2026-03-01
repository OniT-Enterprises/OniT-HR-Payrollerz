/**
 * Accounting Service
 * Firebase Firestore operations for the accounting module
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  runTransaction,
  Transaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { addMoney, subtractMoney, sumMoney, toDecimal, toMoney } from '@/lib/currency';
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
import type { TLPayrollRun, TLPayrollRecord } from '@/types/payroll-tl';
import type { Invoice, Expense, Bill, PaymentMethod } from '@/types/money';

// ============================================
// ACCOUNTS SERVICE
// ============================================

class AccountService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.accounts(tenantId));
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
    const docRef = doc(db, paths.account(tenantId, id));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Account;
    }
    return null;
  }

  async getAccountByCode(tenantId: string, code: string): Promise<Account | null> {
    const q = query(this.collectionRef(tenantId), where('code', '==', code), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Account;
  }

  async getAllAccounts(tenantId: string): Promise<Account[]> {
    const q = query(this.collectionRef(tenantId), orderBy('code'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
  }

  async getAccountsByType(tenantId: string, type: Account['type']): Promise<Account[]> {
    const q = query(
      this.collectionRef(tenantId),
      where('type', '==', type),
      where('isActive', '==', true),
      orderBy('code')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
  }

  async deleteAccount(tenantId: string, id: string): Promise<void> {
    const docRef = doc(db, paths.account(tenantId, id));
    // Soft delete - just deactivate
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Initialize chart of accounts with defaults
   */
  async initializeChartOfAccounts(
    tenantId: string,
    audit?: { userId: string; userEmail: string; userName?: string }
  ): Promise<void> {
    const existingAccounts = await this.getAllAccounts(tenantId);
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
      where('sourceId', '==', sourceId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const first = snapshot.docs[0];
    return { id: first.id, ...first.data() } as JournalEntry;
  }

  async createJournalEntry(
    tenantId: string,
    entry: Omit<JournalEntry, 'id' | 'createdAt'>,
    txn?: Transaction
  ): Promise<string> {
    if (!Array.isArray(entry.lines) || entry.lines.length === 0) {
      throw new Error('Journal entry must include at least one line');
    }

    let lineDebitTotal = 0;
    let lineCreditTotal = 0;

    for (const line of entry.lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error('Journal entry line amounts cannot be negative');
      }

      const hasDebit = line.debit > 0;
      const hasCredit = line.credit > 0;
      if (hasDebit === hasCredit) {
        throw new Error('Each journal entry line must contain either a debit or a credit amount');
      }

      lineDebitTotal += line.debit;
      lineCreditTotal += line.credit;
    }

    if (
      toDecimal(lineDebitTotal).minus(entry.totalDebit).abs().greaterThan(0.01) ||
      toDecimal(lineCreditTotal).minus(entry.totalCredit).abs().greaterThan(0.01)
    ) {
      throw new Error('Journal entry totals do not match line amounts');
    }

    // Validate that debits = credits
    if (toDecimal(entry.totalDebit).minus(entry.totalCredit).abs().greaterThan(0.01)) {
      throw new Error('Journal entry must balance: debits must equal credits');
    }

    // Enforce fiscal period controls (posted entries only).
    if (entry.status === 'posted') {
      await this.assertFiscalPeriodAllowsPosting(tenantId, entry.fiscalYear, entry.fiscalPeriod);
    }

    const journalDocRef = doc(this.collectionRef(tenantId));

    // Write journal + GL entries atomically so books cannot drift.
    const doWrite = (transaction: Transaction) => {
      const journalPayload: Record<string, unknown> = {
        ...entry,
        createdAt: serverTimestamp(),
      };

      if (entry.status === 'posted') {
        // Ensure posted metadata is present for posted-on-create entries.
        if (!('postedAt' in journalPayload) || journalPayload.postedAt === undefined) {
          journalPayload.postedAt = serverTimestamp();
        }
        if (!('postedBy' in journalPayload) || journalPayload.postedBy === undefined) {
          journalPayload.postedBy = entry.postedBy || entry.createdBy || 'system';
        }
      }

      transaction.set(journalDocRef, journalPayload);

      if (entry.status === 'posted') {
        for (const line of entry.lines) {
          const glDocRef = doc(collection(db, paths.generalLedger(tenantId)));
          transaction.set(glDocRef, {
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            journalEntryId: journalDocRef.id,
            entryNumber: entry.entryNumber,
            entryDate: entry.date,
            description: line.description || entry.description,
            debit: line.debit,
            credit: line.credit,
            balance: 0,
            fiscalYear: entry.fiscalYear,
            fiscalPeriod: entry.fiscalPeriod,
            createdAt: serverTimestamp(),
          });
        }

        // Audit trail: posted journal entry (includes auto-generated postings)
        const actor = entry.postedBy || entry.createdBy || 'system';
        const auditDocRef = doc(db, paths.auditLogs(tenantId), `acct_${journalDocRef.id}_post`);
        transaction.set(auditDocRef, {
          userId: actor,
          userEmail: actor,
          action: 'accounting.journal_post',
          module: 'accounting',
          description: `Posted journal entry ${entry.entryNumber}`,
          timestamp: serverTimestamp(),
          tenantId,
          entityId: journalDocRef.id,
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
      }
    };

    if (txn) {
      doWrite(txn);
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
    startDate?: string;
    endDate?: string;
    fiscalYear?: number;
  }): Promise<JournalEntry[]> {
    let q = query(this.collectionRef(tenantId), orderBy('date', 'desc'));

    if (options?.status) {
      q = query(q, where('status', '==', options.status));
    }
    if (options?.fiscalYear) {
      q = query(q, where('fiscalYear', '==', options.fiscalYear));
    }

    const snapshot = await getDocs(q);
    let entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));

    // Filter by date range in memory (Firestore limitation)
    if (options?.startDate) {
      entries = entries.filter(e => e.date >= options.startDate!);
    }
    if (options?.endDate) {
      entries = entries.filter(e => e.date <= options.endDate!);
    }

    return entries;
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

    const year = new Date(params.date).getFullYear();
    const month = new Date(params.date).getMonth() + 1;
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
    _records: TLPayrollRecord[]
  ): Promise<string> {
    const year = new Date(payrollRun.periodEnd).getFullYear();
    const month = new Date(payrollRun.periodEnd).getMonth() + 1;
    const entryNumber = await this.getNextEntryNumber(tenantId, year);

    const lines: JournalEntryLine[] = [];
    let lineNumber = 1;

    // Get account IDs from codes
    const getAccountId = async (code: string) => {
      const account = await accountService.getAccountByCode(tenantId, code);
      if (!account?.id) {
        throw new Error(`Missing account for code ${code}. Initialize chart of accounts first.`);
      }
      return account.id;
    };

    // 1. Debit Salary Expense
    const salaryAccountId = await getAccountId('5110');
    lines.push({
      lineNumber: lineNumber++,
      accountId: salaryAccountId,
      accountCode: '5110',
      accountName: 'Salaries and Wages',
      debit: payrollRun.totalGrossPay,
      credit: 0,
      description: 'Gross salaries',
    });

    // 2. Debit INSS Employer Expense
    const inssExpenseId = await getAccountId('5150');
    lines.push({
      lineNumber: lineNumber++,
      accountId: inssExpenseId,
      accountCode: '5150',
      accountName: 'INSS Employer Contribution',
      debit: payrollRun.totalINSSEmployer,
      credit: 0,
      description: 'INSS employer contribution (6%)',
    });

    // 3. Credit Salaries Payable (net pay)
    const salariesPayableId = await getAccountId('2210');
    lines.push({
      lineNumber: lineNumber++,
      accountId: salariesPayableId,
      accountCode: '2210',
      accountName: 'Salaries Payable',
      debit: 0,
      credit: payrollRun.totalNetPay,
      description: 'Net salaries payable',
    });

    // 4. Credit WIT (Withholding Income Tax)
    const taxPayableId = await getAccountId('2220');
    lines.push({
      lineNumber: lineNumber++,
      accountId: taxPayableId,
      accountCode: '2220',
      accountName: 'Withholding Income Tax (WIT)',
      debit: 0,
      credit: payrollRun.totalIncomeTax,
      description: 'WIT withholdings',
    });

    // 5. Credit INSS Payable - Employee
    const inssEmployeePayableId = await getAccountId('2230');
    lines.push({
      lineNumber: lineNumber++,
      accountId: inssEmployeePayableId,
      accountCode: '2230',
      accountName: 'INSS Payable - Employee',
      debit: 0,
      credit: payrollRun.totalINSSEmployee,
      description: 'INSS employee contribution (4%)',
    });

    // 6. Credit INSS Payable - Employer
    const inssEmployerPayableId = await getAccountId('2240');
    lines.push({
      lineNumber: lineNumber++,
      accountId: inssEmployerPayableId,
      accountCode: '2240',
      accountName: 'INSS Payable - Employer',
      debit: 0,
      credit: payrollRun.totalINSSEmployer,
      description: 'INSS employer contribution (6%)',
    });

    // Calculate totals
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: payrollRun.payDate,
      description: `Payroll for ${payrollRun.periodStart} to ${payrollRun.periodEnd}`,
      source: 'payroll',
      sourceId: payrollRun.id,
      sourceRef: `Payroll Run - ${payrollRun.employeeCount} employees`,
      lines,
      totalDebit,
      totalCredit,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: payrollRun.approvedBy || 'system',
      fiscalYear: year,
      fiscalPeriod: month,
    };

    return await this.createJournalEntry(tenantId, journalEntry);
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
    const year = new Date(summary.periodEnd).getFullYear();
    const month = new Date(summary.periodEnd).getMonth() + 1;
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

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

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
   * Credit: Service Revenue (4100)
   */
  async createFromInvoice(
    tenantId: string,
    invoice: Invoice,
    createdBy: string,
    txn?: Transaction,
    resolvedAccounts?: Record<string, { id: string; name: string }>
  ): Promise<string> {
    const invoiceDate = invoice.issueDate;
    const year = new Date(invoiceDate).getFullYear();
    const month = new Date(invoiceDate).getMonth() + 1;
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
        credit: invoice.total,
        description: `Revenue - ${invoice.invoiceNumber}`,
      },
    ];

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
    const year = new Date(payment.date).getFullYear();
    const month = new Date(payment.date).getMonth() + 1;
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
    const year = new Date(bill.billDate).getFullYear();
    const month = new Date(bill.billDate).getMonth() + 1;
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
      method: PaymentMethod;
      reference?: string;
    },
    createdBy: string,
    txn?: Transaction,
    resolvedAccounts?: Record<string, { id: string; name: string }>
  ): Promise<string> {
    const year = new Date(payment.date).getFullYear();
    const month = new Date(payment.date).getMonth() + 1;
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

    const refLabel = payment.billNumber || `Bill-${payment.billId.slice(0, 8)}`;

    const lines: JournalEntryLine[] = [
      {
        lineNumber: 1,
        accountId: apAccount.id,
        accountCode: '2110',
        accountName: apAccount.name,
        debit: payment.amount,
        credit: 0,
        description: `Clear AP - ${refLabel}`,
      },
      {
        lineNumber: 2,
        accountId: cashAccount.id,
        accountCode: cashCode,
        accountName: cashAccount.name,
        debit: 0,
        credit: payment.amount,
        description: `Payment to ${payment.vendorName}`,
      },
    ];

    const journalEntry: Omit<JournalEntry, 'id' | 'createdAt'> = {
      entryNumber,
      date: payment.date,
      description: `Bill payment to ${payment.vendorName} - ${refLabel}`,
      source: 'payment',
      sourceId: payment.billId,
      sourceRef: payment.reference || refLabel,
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
    const year = new Date(expense.date).getFullYear();
    const month = new Date(expense.date).getMonth() + 1;
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
    periodById: Map<string, number>;
    periodByCode: Map<string, number>;
  }> {
    const { balanceSnapshotService } = await import('@/services/balanceSnapshotService');

    const openingById = new Map<string, number>();
    const openingByCode = new Map<string, number>();
    const periodById = new Map<string, number>();
    const periodByCode = new Map<string, number>();

    // Try to find a snapshot that covers everything before cutoffDate
    const snapshot = await balanceSnapshotService.findLatestSnapshotBefore(tenantId, cutoffDate);

    if (snapshot) {
      // Populate opening balances from snapshot
      for (const entry of snapshot.accounts) {
        openingById.set(entry.accountId, entry.cumulativeNet);
        openingByCode.set(entry.accountCode, entry.cumulativeNet);
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
            openingById.set(e.accountId, addMoney(openingById.get(e.accountId) ?? 0, net));
            openingByCode.set(e.accountCode, addMoney(openingByCode.get(e.accountCode) ?? 0, net));
          } else if (e.entryDate <= endDate) {
            periodById.set(e.accountId, addMoney(periodById.get(e.accountId) ?? 0, net));
            periodByCode.set(e.accountCode, addMoney(periodByCode.get(e.accountCode) ?? 0, net));
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
          const net = subtractMoney(e.debit, e.credit);
          periodById.set(e.accountId, addMoney(periodById.get(e.accountId) ?? 0, net));
          periodByCode.set(e.accountCode, addMoney(periodByCode.get(e.accountCode) ?? 0, net));
        }
      }
    } else {
      // Fallback: full GL scan (backward compatible)
      const glSnapshot = await getDocs(collection(db, paths.generalLedger(tenantId)));
      glSnapshot.docs.forEach(glDoc => {
        const entry = glDoc.data() as GeneralLedgerEntry;
        if (entry.entryDate > endDate) return;
        const net = subtractMoney(entry.debit, entry.credit);
        if (entry.entryDate < cutoffDate) {
          openingById.set(entry.accountId, addMoney(openingById.get(entry.accountId) ?? 0, net));
          openingByCode.set(entry.accountCode, addMoney(openingByCode.get(entry.accountCode) ?? 0, net));
        } else {
          periodById.set(entry.accountId, addMoney(periodById.get(entry.accountId) ?? 0, net));
          periodByCode.set(entry.accountCode, addMoney(periodByCode.get(entry.accountCode) ?? 0, net));
        }
      });
    }

    return { openingById, openingByCode, periodById, periodByCode };
  }

  async generateTrialBalance(tenantId: string, asOfDate: string, fiscalYear: number, periodStart?: string): Promise<TrialBalance> {
    const effectivePeriodStart = periodStart || `${fiscalYear}-01-01`;

    const [accounts, balanceMaps] = await Promise.all([
      accountService.getAllAccounts(tenantId),
      this.loadGLWithSnapshot(tenantId, effectivePeriodStart, asOfDate),
    ]);

    const { openingById, openingByCode, periodById, periodByCode } = balanceMaps;

    const rows: TrialBalanceRow[] = [];

    for (const account of accounts) {
      if (!account.isActive) continue;

      const openingNet = openingById.get(account.id!) ?? openingByCode.get(account.code) ?? 0;
      const periodNet = periodById.get(account.id!) ?? periodByCode.get(account.code) ?? 0;
      const closingNet = addMoney(openingNet, periodNet);

      if (toDecimal(openingNet).abs().lessThan(0.01)
        && toDecimal(periodNet).abs().lessThan(0.01)
        && toDecimal(closingNet).abs().lessThan(0.01)) continue;

      rows.push({
        accountId: account.id!,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        openingDebit: openingNet > 0 ? openingNet : 0,
        openingCredit: openingNet < 0 ? toMoney(toDecimal(openingNet).abs()) : 0,
        periodDebit: periodNet > 0 ? periodNet : 0,
        periodCredit: periodNet < 0 ? toMoney(toDecimal(periodNet).abs()) : 0,
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
      fiscalPeriod: new Date(asOfDate).getMonth() + 1,
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
    const snapshot = await balanceSnapshotService.findLatestSnapshotBefore(tenantId, periodStart);

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
        balanceById.set(e.accountId, addMoney(balanceById.get(e.accountId) ?? 0, net));
        balanceByCode.set(e.accountCode, addMoney(balanceByCode.get(e.accountCode) ?? 0, net));
      }
    } else {
      // Fallback: full GL scan
      const glSnapshot = await getDocs(collection(db, paths.generalLedger(tenantId)));
      glSnapshot.docs.forEach(glDoc => {
        const entry = glDoc.data() as GeneralLedgerEntry;
        if (entry.entryDate < periodStart || entry.entryDate > periodEnd) return;
        const net = subtractMoney(entry.debit, entry.credit);
        balanceById.set(entry.accountId, addMoney(balanceById.get(entry.accountId) ?? 0, net));
        balanceByCode.set(entry.accountCode, addMoney(balanceByCode.get(entry.accountCode) ?? 0, net));
      });
    }

    const revenueItems: IncomeStatementRow[] = [];
    const expenseItems: IncomeStatementRow[] = [];

    for (const account of accounts) {
      if (!account.isActive) continue;
      if (account.type !== 'revenue' && account.type !== 'expense') continue;

      const net = balanceById.get(account.id!) ?? balanceByCode.get(account.code) ?? 0;
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
    const snapshot = await balanceSnapshotService.findLatestSnapshotBefore(tenantId, asOfDate);

    const balanceById = new Map<string, number>();
    const balanceByCode = new Map<string, number>();
    const revenueExpenseById = new Map<string, number>();
    const fyStart = `${fiscalYear}-01-01`;

    if (snapshot) {
      // Seed cumulative balances from snapshot
      for (const entry of snapshot.accounts) {
        balanceById.set(entry.accountId, entry.cumulativeNet);
        balanceByCode.set(entry.accountCode, entry.cumulativeNet);
      }

      // Query delta entries after snapshot through asOfDate
      const deltaEntries = await balanceSnapshotService.queryGLDelta(
        tenantId,
        snapshot.periodEndDate,
        asOfDate,
      );
      for (const e of deltaEntries) {
        const net = subtractMoney(e.debit, e.credit);
        balanceById.set(e.accountId, addMoney(balanceById.get(e.accountId) ?? 0, net));
        balanceByCode.set(e.accountCode, addMoney(balanceByCode.get(e.accountCode) ?? 0, net));
      }

      // Current year revenue/expense: snapshot cumulative includes pre-FY amounts.
      // We need only FY-to-date. Use snapshot if its period is in the same FY,
      // or query from FY start.
      const fySnapshot = snapshot.year === fiscalYear
        ? snapshot
        : await balanceSnapshotService.findLatestSnapshotBefore(tenantId, fyStart);

      if (fySnapshot && fySnapshot.year === fiscalYear) {
        // Snapshot is within this FY — its period activity covers some FY months.
        // We need cumulative from FY start through asOfDate.
        // Compute: snapshot's cumulative - (pre-FY cumulative from an earlier snapshot)
        // Simpler approach: query GL from FY start to asOfDate for revenue/expense only
        const fyEntries = await balanceSnapshotService.queryGLDelta(tenantId, undefined, asOfDate);
        for (const e of fyEntries) {
          if (e.entryDate < fyStart) continue;
          revenueExpenseById.set(e.accountId, addMoney(revenueExpenseById.get(e.accountId) ?? 0, subtractMoney(e.debit, e.credit)));
        }
      } else {
        // No FY-relevant snapshot; query FY range
        const fyEntries = await balanceSnapshotService.queryGLDelta(tenantId, undefined, asOfDate);
        for (const e of fyEntries) {
          if (e.entryDate < fyStart) continue;
          revenueExpenseById.set(e.accountId, addMoney(revenueExpenseById.get(e.accountId) ?? 0, subtractMoney(e.debit, e.credit)));
        }
      }
    } else {
      // Fallback: full GL scan
      const glSnapshot = await getDocs(collection(db, paths.generalLedger(tenantId)));
      glSnapshot.docs.forEach(glDoc => {
        const entry = glDoc.data() as GeneralLedgerEntry;
        if (entry.entryDate > asOfDate) return;
        const net = subtractMoney(entry.debit, entry.credit);
        balanceById.set(entry.accountId, addMoney(balanceById.get(entry.accountId) ?? 0, net));
        balanceByCode.set(entry.accountCode, addMoney(balanceByCode.get(entry.accountCode) ?? 0, net));
      });

      // Current year earnings from full scan
      glSnapshot.docs.forEach(glDoc => {
        const entry = glDoc.data() as GeneralLedgerEntry;
        if (entry.entryDate < fyStart || entry.entryDate > asOfDate) return;
        revenueExpenseById.set(entry.accountId, addMoney(revenueExpenseById.get(entry.accountId) ?? 0, subtractMoney(entry.debit, entry.credit)));
      });
    }

    const assetItems: BalanceSheetRow[] = [];
    const liabilityItems: BalanceSheetRow[] = [];
    const equityItems: BalanceSheetRow[] = [];
    let currentYearRevenue = 0;
    let currentYearExpenses = 0;

    for (const account of accounts) {
      if (!account.isActive) continue;

      const net = balanceById.get(account.id!) ?? balanceByCode.get(account.code) ?? 0;

      if (account.type === 'revenue' || account.type === 'expense') {
        const fyNet = revenueExpenseById.get(account.id!) ?? 0;
        if (account.type === 'revenue') {
          currentYearRevenue = addMoney(currentYearRevenue, toMoney(toDecimal(fyNet).negated()));
        } else {
          currentYearExpenses = addMoney(currentYearExpenses, fyNet);
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
        accountName: 'Current Year Earnings',
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

    // Delete the stale snapshot for the reopened period
    if (period) {
      const sid = `${period.year}-${String(period.period).padStart(2, '0')}`;
      import('@/services/balanceSnapshotService').then(({ balanceSnapshotService }) =>
        balanceSnapshotService.deleteSnapshot(tenantId, sid)
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
const generalLedgerService = new GeneralLedgerService();
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
