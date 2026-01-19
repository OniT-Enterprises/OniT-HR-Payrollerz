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
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  QueryConstraint,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import type { Expense, ExpenseFormData, ExpenseCategory } from '@/types/money';
import { vendorService } from './vendorService';

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
   * Get all expenses
   * @deprecated Use getExpenses() with filters for better performance
   */
  async getAllExpenses(tenantId: string, maxResults: number = 500): Promise<Expense[]> {
    const result = await this.getExpenses(tenantId, { pageSize: maxResults });
    return result.data;
  }

  /**
   * Get expenses by category (server-side filtered)
   */
  async getExpensesByCategory(tenantId: string, category: ExpenseCategory): Promise<Expense[]> {
    const result = await this.getExpenses(tenantId, { category, pageSize: 500 });
    return result.data;
  }

  /**
   * Get expenses by vendor (server-side filtered)
   */
  async getExpensesByVendor(tenantId: string, vendorId: string): Promise<Expense[]> {
    const result = await this.getExpenses(tenantId, { vendorId, pageSize: 500 });
    return result.data;
  }

  /**
   * Get expenses for a date range (server-side filtered)
   */
  async getExpensesByDateRange(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<Expense[]> {
    const result = await this.getExpenses(tenantId, { startDate, endDate, pageSize: 500 });
    return result.data;
  }

  /**
   * Get expenses for current month
   */
  async getExpensesThisMonth(tenantId: string): Promise<Expense[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

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
   */
  async createExpense(
    tenantId: string,
    data: ExpenseFormData & { receiptUrl?: string }
  ): Promise<string> {
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
    const updates: Partial<Expense> = { ...data };

    // Update vendor name if vendorId changed
    if (data.vendorId) {
      const vendor = await vendorService.getVendorById(tenantId, data.vendorId);
      updates.vendorName = vendor?.name;
    } else if (data.vendorId === '') {
      updates.vendorId = undefined;
      updates.vendorName = undefined;
    }

    const docRef = doc(db, paths.expense(tenantId, id));
    await updateDoc(docRef, updates);
    return true;
  }

  /**
   * Delete an expense
   */
  async deleteExpense(tenantId: string, id: string): Promise<boolean> {
    const docRef = doc(db, paths.expense(tenantId, id));
    await deleteDoc(docRef);
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
export default expenseService;
