/**
 * Expense store — employee expense submissions
 * Path: tenants/{tid}/expenses
 * Filtered by employeeId, last 6 months
 */
import { create } from 'zustand';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Expense, ExpenseCategory } from '../types/expense';

interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  submitting: boolean;
  error: string | null;

  fetchExpenses: (tenantId: string, employeeId: string) => Promise<void>;
  createExpense: (params: CreateExpenseParams) => Promise<void>;
  cancelExpense: (tenantId: string, expenseId: string) => Promise<void>;
  clear: () => void;
}

interface CreateExpenseParams {
  tenantId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string;
  description: string;
  receiptUrl?: string;
}

function getSixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0];
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  loading: false,
  submitting: false,
  error: null,

  fetchExpenses: async (tenantId: string, employeeId: string) => {
    set({ loading: true, error: null });
    try {
      const sixMonthsAgo = getSixMonthsAgo();
      const q = query(
        collection(db, `tenants/${tenantId}/expenses`),
        where('employeeId', '==', employeeId),
        where('date', '>=', sixMonthsAgo),
        orderBy('date', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const expenses: Expense[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          tenantId: data.tenantId || tenantId,
          employeeId: data.employeeId,
          employeeName: data.employeeName || '',
          amount: data.amount || 0,
          currency: data.currency || 'USD',
          category: data.category || 'other',
          date: data.date || '',
          description: data.description || '',
          receiptUrl: data.receiptUrl,
          status: data.status || 'submitted',
          approvedBy: data.approvedBy,
          approverName: data.approverName,
          approvedAt: data.approvedAt instanceof Timestamp ? data.approvedAt.toDate() : data.approvedAt,
          rejectionReason: data.rejectionReason,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
        };
      });
      set({ expenses, loading: false });
    } catch {
      set({ expenses: [], loading: false, error: 'fetchError' });
    }
  },

  createExpense: async (params: CreateExpenseParams) => {
    set({ submitting: true, error: null });
    try {
      await addDoc(collection(db, `tenants/${params.tenantId}/expenses`), {
        tenantId: params.tenantId,
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        amount: params.amount,
        currency: params.currency,
        category: params.category,
        date: params.date,
        description: params.description,
        receiptUrl: params.receiptUrl ?? null,
        status: 'submitted',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Refresh expenses
      await get().fetchExpenses(params.tenantId, params.employeeId);
      set({ submitting: false });
    } catch {
      set({ submitting: false, error: 'submitError' });
    }
  },

  cancelExpense: async (tenantId: string, expenseId: string) => {
    set({ submitting: true, error: null });
    try {
      await updateDoc(doc(db, `tenants/${tenantId}/expenses`, expenseId), {
        status: 'submitted', // Reset — only submitted can be cancelled by employee
        updatedAt: serverTimestamp(),
      });

      // Update local state: remove the expense (treat cancel as withdrawal)
      set((state) => ({
        expenses: state.expenses.filter((e) => e.id !== expenseId),
        submitting: false,
      }));
    } catch {
      set({ submitting: false, error: 'cancelError' });
    }
  },

  clear: () => set({ expenses: [], loading: false, submitting: false, error: null }),
}));
