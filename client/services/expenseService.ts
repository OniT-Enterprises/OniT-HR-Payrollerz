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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Expense, ExpenseFormData, ExpenseCategory } from '@/types/money';
import { vendorService } from './vendorService';

class ExpenseService {
  private get collectionRef() {
    return collection(db, 'expenses');
  }

  /**
   * Get all expenses
   */
  async getAllExpenses(maxResults: number = 500): Promise<Expense[]> {
    const querySnapshot = await getDocs(
      query(this.collectionRef, orderBy('date', 'desc'), limit(maxResults))
    );

    return querySnapshot.docs.map((doc) => this.mapExpense(doc));
  }

  /**
   * Get expenses by category
   */
  async getExpensesByCategory(category: ExpenseCategory): Promise<Expense[]> {
    const q = query(
      this.collectionRef,
      where('category', '==', category),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapExpense(doc));
  }

  /**
   * Get expenses by vendor
   */
  async getExpensesByVendor(vendorId: string): Promise<Expense[]> {
    const q = query(
      this.collectionRef,
      where('vendorId', '==', vendorId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapExpense(doc));
  }

  /**
   * Get expenses for a date range
   */
  async getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    const q = query(
      this.collectionRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapExpense(doc));
  }

  /**
   * Get expenses for current month
   */
  async getExpensesThisMonth(): Promise<Expense[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    return this.getExpensesByDateRange(startOfMonth, endOfMonth);
  }

  /**
   * Get a single expense by ID
   */
  async getExpenseById(id: string): Promise<Expense | null> {
    const docRef = doc(db, 'expenses', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapExpense(docSnap);
  }

  /**
   * Create a new expense
   */
  async createExpense(data: ExpenseFormData): Promise<string> {
    // Get vendor name if vendorId provided
    let vendorName: string | undefined;
    if (data.vendorId) {
      const vendor = await vendorService.getVendorById(data.vendorId);
      vendorName = vendor?.name;
    }

    const expense: Omit<Expense, 'id'> = {
      ...data,
      vendorName,
      createdAt: new Date(),
    };

    const docRef = await addDoc(this.collectionRef, {
      ...expense,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Update an existing expense
   */
  async updateExpense(id: string, data: Partial<ExpenseFormData>): Promise<boolean> {
    const updates: Partial<Expense> = { ...data };

    // Update vendor name if vendorId changed
    if (data.vendorId) {
      const vendor = await vendorService.getVendorById(data.vendorId);
      updates.vendorName = vendor?.name;
    } else if (data.vendorId === '') {
      updates.vendorId = undefined;
      updates.vendorName = undefined;
    }

    const docRef = doc(db, 'expenses', id);
    await updateDoc(docRef, updates);
    return true;
  }

  /**
   * Delete an expense
   */
  async deleteExpense(id: string): Promise<boolean> {
    const docRef = doc(db, 'expenses', id);
    await deleteDoc(docRef);
    return true;
  }

  /**
   * Get expense totals by category for a date range
   */
  async getExpenseTotalsByCategory(
    startDate: string,
    endDate: string
  ): Promise<Record<ExpenseCategory, number>> {
    const expenses = await this.getExpensesByDateRange(startDate, endDate);

    const totals: Record<string, number> = {};
    expenses.forEach((expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    });

    return totals as Record<ExpenseCategory, number>;
  }

  /**
   * Get total expenses for a period
   */
  async getTotalExpenses(startDate: string, endDate: string): Promise<number> {
    const expenses = await this.getExpensesByDateRange(startDate, endDate);
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  private mapExpense(doc: any): Expense {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as Expense;
  }
}

export const expenseService = new ExpenseService();
export default expenseService;
