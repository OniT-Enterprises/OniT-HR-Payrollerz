/**
 * Expense Service
 * Firestore CRUD operations for expenses
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  deleteField,
  runTransaction,
  QueryConstraint,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import { getTodayTL } from '@/lib/dateUtils';
import type { Expense, ExpenseFormData, ExpenseCategory } from '@/types/money';
import { vendorService } from './vendorService';
import { journalEntryService, accountService, fiscalPeriodService } from './accountingService';
import { EXPENSE_CATEGORY_TO_ACCOUNT } from '@/lib/accounting/chart-of-accounts';

/**
 * Filter options for expense queries
 */
export interface ExpenseFilters {
  // Server-side filters
  category?: ExpenseCategory;
  vendorId?: string;
  startDate?: string;
  endDate?: string;

  // Pagination
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;

  // Client-side filters
  searchTerm?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalFetched: number;
}

/**
 * Maps Firestore document to Expense
 */
function mapExpense(docSnap: DocumentSnapshot): Expense {
  const data = docSnap.data();
  if (!data) throw new Error('Document data is undefined');

  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : data.createdAt || new Date(),
  } as Expense;
}

class ExpenseService {
  private collectionRef(tenantId: string) {
    return collection(db, paths.expenses(tenantId));
  }

  /**
   * Get expenses with server-side filtering and pagination
   */
  async getExpenses(
    tenantId: string,
    filters: ExpenseFilters = {}
  ): Promise<PaginatedResult<Expense>> {
    const {
      category,
      vendorId,
      startDate,
      endDate,
      pageSize = 100,
      startAfterDoc,
      searchTerm,
      minAmount,
      maxAmount,
    } = filters;

    const constraints: QueryConstraint[] = [];

    // Server-side filters
    if (category) {
      constraints.push(where('category', '==', category));
    }
    if (vendorId) {
      constraints.push(where('vendorId', '==', vendorId));
    }
    if (startDate) {
      constraints.push(where('date', '>=', startDate));
    }
    if (endDate) {
      constraints.push(where('date', '<=', endDate));
    }

    // Ordering and pagination
    constraints.push(orderBy('date', 'desc'));

    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    constraints.push(limit(pageSize + 1));

    const q = query(this.collectionRef(tenantId), ...constraints);
    const querySnapshot = await getDocs(q);

    let expenses = querySnapshot.docs.map(mapExpense);
    const hasMore = expenses.length > pageSize;

    if (hasMore) {
      expenses = expenses.slice(0, pageSize);
    }

    const lastDoc = expenses.length > 0
      ? querySnapshot.docs[expenses.length - 1]
      : null;

    // Client-side filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      expenses = expenses.filter(
        (expense) =>
          expense.description?.toLowerCase().includes(term) ||
          expense.vendorName?.toLowerCase().includes(term)
      );
    }

    if (minAmount !== undefined) {
      expenses = expenses.filter((expense) => expense.amount >= minAmount);
    }

    if (maxAmount !== undefined) {
      expenses = expenses.filter((expense) => expense.amount <= maxAmount);
    }

    return {
      data: expenses,
      lastDoc,
      hasMore,
      totalFetched: expenses.length,
    };
  }

  /**
   * Get all expenses (fetches every page via getExpenses pagination loop)
   */
  async getAllExpenses(tenantId: string): Promise<Expense[]> {
    const MAX_PAGES = 100;
    const all: Expense[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getAllExpenses: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getExpenses(tenantId, { pageSize: 500, startAfterDoc: lastDoc });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }
    return all;
  }

  /**
   * Get expenses by category (server-side filtered, paginated)
   */
  async getExpensesByCategory(tenantId: string, category: ExpenseCategory): Promise<Expense[]> {
    const MAX_PAGES = 100;
    const all: Expense[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getExpensesByCategory: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getExpenses(tenantId, { category, pageSize: 500, startAfterDoc: lastDoc });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }
    return all;
  }

  /**
   * Get expenses by vendor (server-side filtered, paginated)
   */
  async getExpensesByVendor(tenantId: string, vendorId: string): Promise<Expense[]> {
    const MAX_PAGES = 100;
    const all: Expense[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getExpensesByVendor: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getExpenses(tenantId, { vendorId, pageSize: 500, startAfterDoc: lastDoc });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }
    return all;
  }

  /**
   * Get expenses for a date range (server-side filtered, paginated)
   */
  async getExpensesByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<Expense[]> {
    const MAX_PAGES = 100;
    const all: Expense[] = [];
    let lastDoc: DocumentSnapshot | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) {
        console.warn(`getExpensesByDateRange: safety limit of ${MAX_PAGES} pages reached, returning ${all.length} records`);
        break;
      }
      const result = await this.getExpenses(tenantId, { startDate, endDate, pageSize: 500, startAfterDoc: lastDoc });
      all.push(...result.data);
      lastDoc = result.lastDoc ?? undefined;
      hasMore = result.hasMore;
    }
    return all;
  }

  /**
   * Get expenses for current month
   */
  async getExpensesThisMonth(tenantId: string): Promise<Expense[]> {
    const [yearStr, monthStr] = getTodayTL().split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startOfMonth = `${yearStr}-${monthStr}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endOfMonth = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    return this.getExpensesByDateRange(tenantId, startOfMonth, endOfMonth);
  }

  /**
   * Get a single expense by ID
   */
  async getExpenseById(tenantId: string, id: string): Promise<Expense | null> {
    const docRef = doc(db, paths.expense(tenantId, id));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapExpense(docSnap);
  }

  /**
   * Create a new expense
   * Also creates a journal entry (Debit Expense, Credit Cash)
   */
  async createExpense(
    tenantId: string,
    data: ExpenseFormData & { receiptUrl?: string },
    userId?: string,
    /** Pre-generated Firestore document ID (used when receipt was uploaded before save) */
    preGeneratedId?: string
  ): Promise<string> {
    if (data.amount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }

    // Get vendor name if vendorId provided
    let vendorName: string | undefined;
    if (data.vendorId) {
      const vendor = await vendorService.getVendorById(tenantId, data.vendorId);
      vendorName = vendor?.name;
    }

    const expense: Omit<Expense, 'id'> = {
      ...data,
      vendorName,
      createdAt: new Date(),
    };

    // Check if chart of accounts is set up (read before transaction)
    const accounts = await accountService.getAllAccounts(tenantId);
    const hasAccounts = accounts.length > 0;

    if (hasAccounts) {
      // Pre-resolve account IDs BEFORE the transaction (getDocs queries are not transaction-safe)
      const expenseMapping = EXPENSE_CATEGORY_TO_ACCOUNT[data.category] || EXPENSE_CATEGORY_TO_ACCOUNT.other;
      const cashCode = data.paymentMethod === 'cash' ? '1110' : '1120';
      const [expenseAccount, cashAccount] = await Promise.all([
        accountService.getAccountByCode(tenantId, expenseMapping.code),
        accountService.getAccountByCode(tenantId, cashCode),
      ]);
      if (!expenseAccount?.id) throw new Error(`Missing account for code ${expenseMapping.code}`);
      if (!cashAccount?.id) throw new Error(`Missing account for code ${cashCode}`);
      const resolvedAccounts: Record<string, { id: string; name: string }> = {
        [expenseMapping.code]: { id: expenseAccount.id, name: expenseAccount.name },
        [cashCode]: { id: cashAccount.id, name: cashAccount.name },
      };

      // ATOMIC: Create expense + journal entry in a single transaction.
      const expenseDocRef = preGeneratedId
        ? doc(this.collectionRef(tenantId), preGeneratedId)
        : doc(this.collectionRef(tenantId));
      await runTransaction(db, async (transaction) => {
        // Journal entry (only transaction.get for entry number, writes journal + GL)
        await journalEntryService.createFromExpense(
          tenantId,
          { ...expense, id: expenseDocRef.id },
          userId || 'system',
          transaction,
          resolvedAccounts
        );
        // Write expense in same transaction
        transaction.set(expenseDocRef, {
          ...expense,
          createdAt: serverTimestamp(),
        });
      });
      return expenseDocRef.id;
    }

    // No accounting setup — just create expense
    if (preGeneratedId) {
      const docRef = doc(this.collectionRef(tenantId), preGeneratedId);
      await setDoc(docRef, {
        ...expense,
        createdAt: serverTimestamp(),
      });
      return preGeneratedId;
    }
    const docRef = await addDoc(this.collectionRef(tenantId), {
      ...expense,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Update an existing expense
   */
  async updateExpense(
    tenantId: string,
    id: string,
    data: Partial<ExpenseFormData> & { receiptUrl?: string }
  ): Promise<boolean> {
    if (data.amount !== undefined && data.amount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }

    const updates: Record<string, unknown> = { ...data };

    // Update vendor name if vendorId changed
    if (data.vendorId) {
      const vendor = await vendorService.getVendorById(tenantId, data.vendorId);
      updates.vendorName = vendor?.name;
    } else if (data.vendorId === '') {
      updates.vendorId = deleteField();
      updates.vendorName = deleteField();
    }

    const docRef = doc(db, paths.expense(tenantId, id));
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  /**
   * Delete an expense
   * Also voids the associated journal entry and creates reversing GL entries
   */
  async deleteExpense(tenantId: string, id: string, userId?: string): Promise<boolean> {
    // Look up the associated journal entry BEFORE the transaction (query not transaction-safe)
    // Expenses use source='receipt' (see createFromExpense in accountingService)
    const journalEntry = await journalEntryService.getJournalEntryBySource(tenantId, 'receipt', id);

    // Post-close correction flow:
    // - If the original journal entry is in a closed/locked period, do NOT void it.
    // - Instead, create a reversing adjustment entry in the current open period.
    const journalPeriod = journalEntry?.status === 'posted'
      ? await fiscalPeriodService.getPeriodByYearAndPeriod(tenantId, journalEntry.fiscalYear, journalEntry.fiscalPeriod)
      : null;

    const needsAdjustment = !!journalPeriod && journalPeriod.status !== 'open';
    const adjustmentDate = needsAdjustment ? getTodayTL() : null;

    if (needsAdjustment && adjustmentDate) {
      const adjYear = new Date(adjustmentDate).getFullYear();
      const adjMonth = new Date(adjustmentDate).getMonth() + 1;
      const adjPeriod = await fiscalPeriodService.getPeriodByYearAndPeriod(tenantId, adjYear, adjMonth);
      if (adjPeriod && adjPeriod.status !== 'open') {
        throw new Error(
          `Cannot delete expense: adjustment period ${adjYear}-${String(adjMonth).padStart(2, '0')} is ${adjPeriod.status}. ` +
          'Reopen the period (or choose an open adjustment date) to post the reversal entry.'
        );
      }
    }

    const expenseDocRef = doc(db, paths.expense(tenantId, id));

    await runTransaction(db, async (transaction) => {
      // 1. Delete the expense document
      transaction.delete(expenseDocRef);

      // 2. Void the journal entry and create reversing GL entries
      if (journalEntry?.id) {
        if (needsAdjustment && adjustmentDate) {
          await journalEntryService.createReversingJournalEntry(
            tenantId,
            journalEntry,
            {
              date: adjustmentDate,
              createdBy: userId || 'system',
              reason: `Expense ${id} deleted`,
              txn: transaction,
            }
          );
        } else {
          journalEntryService.voidJournalEntryInTransaction(
            tenantId,
            journalEntry.id,
            journalEntry,
            transaction,
            userId || 'system',
            `Expense ${id} deleted`
          );
        }
      }
    });

    return true;
  }

  /**
   * Get expense totals by category for a date range
   */
  async getExpenseTotalsByCategory(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<Record<ExpenseCategory, number>> {
    const expenses = await this.getExpensesByDateRange(tenantId, startDate, endDate);

    const totals: Record<string, number> = {};
    expenses.forEach((expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    });

    return totals as Record<ExpenseCategory, number>;
  }

  /**
   * Get total expenses for a period
   */
  async getTotalExpenses(tenantId: string, startDate: string, endDate: string): Promise<number> {
    const expenses = await this.getExpensesByDateRange(tenantId, startDate, endDate);
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

}

export const expenseService = new ExpenseService();
