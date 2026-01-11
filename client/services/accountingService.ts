/**
 * Accounting Service
 * Firebase Firestore operations for the accounting module
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Account,
  JournalEntry,
  JournalEntryLine,
  FiscalYear,
  FiscalPeriod,
  BankAccount,
  BankReconciliation,
  AccountingSettings,
  TrialBalance,
  TrialBalanceRow,
  GeneralLedgerEntry,
} from '@/types/accounting';
import { getDefaultAccounts, PAYROLL_JOURNAL_MAPPINGS } from '@/lib/accounting/chart-of-accounts';
import type { TLPayrollRun, TLPayrollRecord } from '@/types/payroll-tl';

// ============================================
// ACCOUNTS SERVICE
// ============================================

class AccountService {
  private collectionRef = collection(db, 'accounts');

  async createAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(this.collectionRef, {
      ...account,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<void> {
    const docRef = doc(db, 'accounts', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  async getAccount(id: string): Promise<Account | null> {
    const docRef = doc(db, 'accounts', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Account;
    }
    return null;
  }

  async getAccountByCode(code: string): Promise<Account | null> {
    const q = query(this.collectionRef, where('code', '==', code), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Account;
  }

  async getAllAccounts(): Promise<Account[]> {
    const q = query(this.collectionRef, orderBy('code'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
  }

  async getAccountsByType(type: Account['type']): Promise<Account[]> {
    const q = query(
      this.collectionRef,
      where('type', '==', type),
      where('isActive', '==', true),
      orderBy('code')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
  }

  async deleteAccount(id: string): Promise<void> {
    const docRef = doc(db, 'accounts', id);
    // Soft delete - just deactivate
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Initialize chart of accounts with defaults
   */
  async initializeChartOfAccounts(): Promise<void> {
    const existingAccounts = await this.getAllAccounts();
    if (existingAccounts.length > 0) {
      console.log('Chart of accounts already exists');
      return;
    }

    const batch = writeBatch(db);
    const defaultAccounts = getDefaultAccounts();

    for (const account of defaultAccounts) {
      const docRef = doc(this.collectionRef);
      batch.set(docRef, {
        ...account,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(`Initialized ${defaultAccounts.length} accounts`);
  }
}

// ============================================
// JOURNAL ENTRY SERVICE
// ============================================

class JournalEntryService {
  private collectionRef = collection(db, 'journalEntries');

  async createJournalEntry(entry: Omit<JournalEntry, 'id' | 'createdAt'>): Promise<string> {
    // Validate that debits = credits
    if (Math.abs(entry.totalDebit - entry.totalCredit) > 0.01) {
      throw new Error('Journal entry must balance: debits must equal credits');
    }

    const docRef = await addDoc(this.collectionRef, {
      ...entry,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async getJournalEntry(id: string): Promise<JournalEntry | null> {
    const docRef = doc(db, 'journalEntries', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as JournalEntry;
    }
    return null;
  }

  async getAllJournalEntries(options?: {
    status?: JournalEntry['status'];
    startDate?: string;
    endDate?: string;
    fiscalYear?: number;
  }): Promise<JournalEntry[]> {
    let q = query(this.collectionRef, orderBy('date', 'desc'));

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

  async postJournalEntry(id: string, postedBy: string): Promise<void> {
    const docRef = doc(db, 'journalEntries', id);
    await updateDoc(docRef, {
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy,
    });

    // Create general ledger entries
    const entry = await this.getJournalEntry(id);
    if (entry) {
      await generalLedgerService.createEntriesFromJournal(entry);
    }
  }

  async voidJournalEntry(id: string, voidedBy: string, reason: string): Promise<void> {
    const docRef = doc(db, 'journalEntries', id);
    await updateDoc(docRef, {
      status: 'void',
      voidedAt: serverTimestamp(),
      voidedBy,
      voidReason: reason,
    });
  }

  /**
   * Generate next entry number
   */
  async getNextEntryNumber(year: number): Promise<string> {
    const q = query(
      this.collectionRef,
      where('fiscalYear', '==', year),
      orderBy('entryNumber', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);

    let nextNum = 1;
    if (!snapshot.empty) {
      const lastEntry = snapshot.docs[0].data() as JournalEntry;
      const match = lastEntry.entryNumber.match(/JE-\d{4}-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    return `JE-${year}-${String(nextNum).padStart(4, '0')}`;
  }

  /**
   * Create journal entry from payroll run
   */
  async createFromPayroll(
    payrollRun: TLPayrollRun,
    records: TLPayrollRecord[]
  ): Promise<string> {
    const year = new Date(payrollRun.periodEnd).getFullYear();
    const month = new Date(payrollRun.periodEnd).getMonth() + 1;
    const entryNumber = await this.getNextEntryNumber(year);

    const lines: JournalEntryLine[] = [];
    let lineNumber = 1;

    // Get account IDs from codes
    const getAccountId = async (code: string) => {
      const account = await accountService.getAccountByCode(code);
      return account?.id || '';
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

    // 4. Credit Income Tax Payable
    const taxPayableId = await getAccountId('2220');
    lines.push({
      lineNumber: lineNumber++,
      accountId: taxPayableId,
      accountCode: '2220',
      accountName: 'Income Tax Payable (IRPS)',
      debit: 0,
      credit: payrollRun.totalIncomeTax,
      description: 'Income tax withholdings',
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

    return await this.createJournalEntry(journalEntry);
  }
}

// ============================================
// GENERAL LEDGER SERVICE
// ============================================

class GeneralLedgerService {
  private collectionRef = collection(db, 'generalLedger');

  async createEntriesFromJournal(journalEntry: JournalEntry): Promise<void> {
    const batch = writeBatch(db);

    for (const line of journalEntry.lines) {
      const docRef = doc(this.collectionRef);
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
    accountId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      fiscalYear?: number;
    }
  ): Promise<GeneralLedgerEntry[]> {
    let q = query(
      this.collectionRef,
      where('accountId', '==', accountId),
      orderBy('entryDate')
    );

    if (options?.fiscalYear) {
      q = query(q, where('fiscalYear', '==', options.fiscalYear));
    }

    const snapshot = await getDocs(q);
    let entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneralLedgerEntry));

    // Calculate running balance
    let runningBalance = 0;
    entries = entries.map(entry => {
      runningBalance += entry.debit - entry.credit;
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

  async getAccountBalance(accountId: string, asOfDate?: string): Promise<number> {
    let q = query(
      this.collectionRef,
      where('accountId', '==', accountId)
    );

    const snapshot = await getDocs(q);
    let entries = snapshot.docs.map(doc => doc.data() as GeneralLedgerEntry);

    if (asOfDate) {
      entries = entries.filter(e => e.entryDate <= asOfDate);
    }

    return entries.reduce((sum, e) => sum + e.debit - e.credit, 0);
  }
}

// ============================================
// TRIAL BALANCE SERVICE
// ============================================

class TrialBalanceService {
  async generateTrialBalance(asOfDate: string, fiscalYear: number): Promise<TrialBalance> {
    const accounts = await accountService.getAllAccounts();
    const rows: TrialBalanceRow[] = [];

    for (const account of accounts) {
      if (!account.isActive) continue;

      const balance = await generalLedgerService.getAccountBalance(account.id!, asOfDate);

      // Skip zero balances for cleaner report
      if (Math.abs(balance) < 0.01) continue;

      const isDebitAccount = ['asset', 'expense'].includes(account.type);

      rows.push({
        accountId: account.id!,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        openingDebit: 0,  // Would need prior period data
        openingCredit: 0,
        periodDebit: isDebitAccount && balance > 0 ? balance : 0,
        periodCredit: !isDebitAccount || balance < 0 ? Math.abs(balance) : 0,
        closingDebit: isDebitAccount && balance > 0 ? balance : 0,
        closingCredit: !isDebitAccount || balance < 0 ? Math.abs(balance) : 0,
      });
    }

    // Sort by account code
    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalDebit = rows.reduce((sum, r) => sum + r.closingDebit, 0);
    const totalCredit = rows.reduce((sum, r) => sum + r.closingCredit, 0);

    return {
      asOfDate,
      fiscalYear,
      fiscalPeriod: new Date(asOfDate).getMonth() + 1,
      rows,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      generatedAt: new Date(),
      generatedBy: 'system',
    };
  }
}

// ============================================
// FISCAL PERIOD SERVICE
// ============================================

class FiscalPeriodService {
  private yearCollection = collection(db, 'fiscalYears');
  private periodCollection = collection(db, 'fiscalPeriods');

  async createFiscalYear(year: number): Promise<string> {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const docRef = await addDoc(this.yearCollection, {
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
      const periodRef = doc(this.periodCollection);
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

  async getFiscalYear(year: number): Promise<FiscalYear | null> {
    const q = query(this.yearCollection, where('year', '==', year), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FiscalYear;
  }

  async getCurrentPeriod(): Promise<FiscalPeriod | null> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const q = query(
      this.periodCollection,
      where('year', '==', year),
      where('period', '==', month),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FiscalPeriod;
  }

  async closePeriod(periodId: string, closedBy: string): Promise<void> {
    const docRef = doc(db, 'fiscalPeriods', periodId);
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
  private docRef = doc(db, 'settings', 'accounting');

  async getSettings(): Promise<AccountingSettings | null> {
    const docSnap = await getDoc(this.docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AccountingSettings;
    }
    return null;
  }

  async updateSettings(settings: Partial<AccountingSettings>, updatedBy: string): Promise<void> {
    const existing = await this.getSettings();
    if (existing) {
      await updateDoc(this.docRef, {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy,
      });
    } else {
      // Create default settings
      const { setDoc } = await import('firebase/firestore');
      await setDoc(this.docRef, {
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
export const accountingSettingsService = new AccountingSettingsService();

// Convenience export
export const accountingService = {
  accounts: accountService,
  journalEntries: journalEntryService,
  generalLedger: generalLedgerService,
  trialBalance: trialBalanceService,
  fiscalPeriods: fiscalPeriodService,
  settings: accountingSettingsService,
};

export default accountingService;
