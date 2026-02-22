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
import type {
  Account,
  JournalEntry,
  JournalEntryLine,
  FiscalYear,
  FiscalPeriod,
  AccountingSettings,
  TrialBalance,
  TrialBalanceRow,
  GeneralLedgerEntry,
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
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const docRef = await addDoc(this.collectionRef(tenantId), {
      ...account,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateAccount(tenantId: string, id: string, updates: Partial<Account>): Promise<void> {
    const docRef = doc(db, paths.account(tenantId, id));
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
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
  async initializeChartOfAccounts(tenantId: string): Promise<void> {
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
  }
}

// ============================================
// JOURNAL ENTRY SERVICE
// ============================================

class JournalEntryService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.journalEntries(tenantId));
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

    const journalDocRef = doc(this.collectionRef(tenantId));

    // Write journal + GL entries atomically so books cannot drift.
    const doWrite = (transaction: Transaction) => {
      transaction.set(journalDocRef, {
        ...entry,
        createdAt: serverTimestamp(),
      });

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
    });
  }

  async voidJournalEntry(tenantId: string, id: string, voidedBy: string, reason: string): Promise<void> {
    const docRef = doc(db, paths.journalEntry(tenantId, id));
    const existing = await getDoc(docRef);
    if (!existing.exists()) {
      throw new Error('Journal entry not found');
    }
    const entry = existing.data() as JournalEntry;
    if (entry.status !== 'posted') {
      throw new Error('Only posted journal entries can be voided');
    }
    await updateDoc(docRef, {
      status: 'void',
      voidedAt: serverTimestamp(),
      voidedBy,
      voidReason: reason,
    });
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
    lines.push({
      lineNumber: lineNumber++,
      accountId: salaryAccount.id,
      accountCode: '5110',
      accountName: salaryAccount.name,
      debit: summary.totalGrossPay,
      credit: 0,
      description: 'Gross salaries',
    });

    const inssExpense = await getAccountId('5150');
    lines.push({
      lineNumber: lineNumber++,
      accountId: inssExpense.id,
      accountCode: '5150',
      accountName: inssExpense.name,
      debit: summary.totalINSSEmployer,
      credit: 0,
      description: 'INSS employer contribution (6%)',
    });

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
    }
  ): Promise<GeneralLedgerEntry[]> {
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
    let entries: GeneralLedgerEntry[] = [];
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          entries.push({ id: doc.id, ...doc.data() } as GeneralLedgerEntry);
        }
      });
    });

    entries.sort((a, b) => {
      const dateCmp = a.entryDate.localeCompare(b.entryDate);
      if (dateCmp !== 0) return dateCmp;
      const numberCmp = (a.entryNumber || '').localeCompare(b.entryNumber || '');
      if (numberCmp !== 0) return numberCmp;
      return (a.id || '').localeCompare(b.id || '');
    });

    // Calculate running balance
    let runningBalance = 0;
    entries = entries.map(entry => {
      runningBalance = addMoney(runningBalance, subtractMoney(entry.debit, entry.credit));
      return { ...entry, balance: runningBalance };
    });

    // Filter by date range
    if (options?.startDate) {
      entries = entries.filter(e => e.entryDate >= options.startDate!);
    }
    if (options?.endDate) {
      entries = entries.filter(e => e.entryDate <= options.endDate!);
    }

    return entries;
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
  async generateTrialBalance(tenantId: string, asOfDate: string, fiscalYear: number): Promise<TrialBalance> {
    // Fetch accounts and ALL GL entries in just 2 queries (instead of N×2)
    const [accounts, glSnapshot] = await Promise.all([
      accountService.getAllAccounts(tenantId),
      getDocs(collection(db, paths.generalLedger(tenantId))),
    ]);

    // Build balance map from GL entries, filtering by date
    const balanceByAccountId = new Map<string, number>();
    const balanceByAccountCode = new Map<string, number>();

    glSnapshot.docs.forEach(doc => {
      const entry = doc.data() as GeneralLedgerEntry;
      if (asOfDate && entry.entryDate > asOfDate) return;

      const net = subtractMoney(entry.debit, entry.credit);

      // Accumulate by accountId
      const prevById = balanceByAccountId.get(entry.accountId) ?? 0;
      balanceByAccountId.set(entry.accountId, addMoney(prevById, net));

      // Accumulate by accountCode (for legacy rows)
      const prevByCode = balanceByAccountCode.get(entry.accountCode) ?? 0;
      balanceByAccountCode.set(entry.accountCode, addMoney(prevByCode, net));
    });

    const rows: TrialBalanceRow[] = [];

    for (const account of accounts) {
      if (!account.isActive) continue;

      // Use accountId balance, fall back to accountCode for legacy data
      const balance = balanceByAccountId.get(account.id!) ?? balanceByAccountCode.get(account.code) ?? 0;

      // Skip zero balances for cleaner report
      if (toDecimal(balance).abs().lessThan(0.01)) continue;

      const debitBalance = balance > 0 ? balance : 0;
      const creditBalance = balance < 0 ? toMoney(toDecimal(balance).abs()) : 0;

      rows.push({
        accountId: account.id!,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: debitBalance,
        periodCredit: creditBalance,
        closingDebit: debitBalance,
        closingCredit: creditBalance,
      });
    }

    // Sort by account code
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

  async createFiscalYear(tenantId: string, year: number): Promise<string> {
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

  async closePeriod(tenantId: string, periodId: string, closedBy: string): Promise<void> {
    const docRef = doc(db, paths.fiscalPeriod(tenantId, periodId));
    await updateDoc(docRef, {
      status: 'closed',
      closedAt: serverTimestamp(),
      closedBy,
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
const fiscalPeriodService = new FiscalPeriodService();
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
