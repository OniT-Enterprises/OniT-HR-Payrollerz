/**
 * Transaction Store — Firestore-backed transaction management.
 *
 * Supports date range queries (today, this week, this month, custom).
 * Provides computed summaries for the UI.
 */
import { create } from 'zustand';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { paths } from '@onit/shared';
import type { KaixaTransaction } from '../types/transaction';

// ============================================
// Date Range Helpers
// ============================================

export type DateRange = 'today' | 'week' | 'month' | 'custom';

/** Get a date in Dili timezone as YYYY-MM-DD */
function diliDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Dili' });
}

/** Convert a YYYY-MM-DD string to a Date at midnight in TL timezone */
function diliMidnight(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00+09:00');
}

/** Get date range boundaries for a given period */
export function getDateRange(range: DateRange, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const todayStr = diliDateString();
  const today = diliMidnight(todayStr);

  switch (range) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };

    case 'week': {
      // Start of current week (Monday)
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
      return {
        start: monday,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    case 'month': {
      // Start of current month
      const [year, month] = todayStr.split('-').map(Number);
      const monthStart = diliMidnight(`${year}-${String(month).padStart(2, '0')}-01`);
      return {
        start: monthStart,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    case 'custom':
      return {
        start: customStart || today,
        end: customEnd || new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };
  }
}

/** Get previous period for comparison */
export function getPreviousPeriod(range: DateRange): { start: Date; end: Date } {
  const current = getDateRange(range);
  const duration = current.end.getTime() - current.start.getTime();

  return {
    start: new Date(current.start.getTime() - duration),
    end: current.start,
  };
}

// ============================================
// Document Mapper
// ============================================

function mapDoc(id: string, data: Record<string, unknown>): KaixaTransaction {
  return {
    id,
    type: data.type as 'in' | 'out',
    amount: data.amount as number,
    netAmount: (data.netAmount as number) ?? (data.amount as number),
    vatRate: (data.vatRate as number) ?? 0,
    vatAmount: (data.vatAmount as number) ?? 0,
    vatCategory: (data.vatCategory as KaixaTransaction['vatCategory']) ?? 'none',
    category: data.category as string,
    note: (data.note as string) ?? '',
    timestamp:
      data.timestamp instanceof Timestamp
        ? data.timestamp.toDate()
        : new Date(data.timestamp as string),
    receiptNumber: data.receiptNumber as string | undefined,
    businessVatId: data.businessVatId as string | undefined,
    customerVatId: data.customerVatId as string | undefined,
    syncedToMeza: (data.syncedToMeza as boolean) ?? false,
    mezaInvoiceId: data.mezaInvoiceId as string | undefined,
    tenantId: data.tenantId as string,
    createdBy: data.createdBy as string,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(data.createdAt as string),
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(data.updatedAt as string),
  };
}

// ============================================
// Store
// ============================================

interface TransactionState {
  transactions: KaixaTransaction[];
  loading: boolean;
  error: string | null;
  dateRange: DateRange;

  // Computed
  totalIn: () => number;
  totalOut: () => number;
  totalNet: () => number;
  totalVAT: () => number;
  transactionCount: () => number;
  recentTransactions: (limit?: number) => KaixaTransaction[];

  // Actions
  setDateRange: (range: DateRange) => void;
  addTransaction: (
    tx: Omit<KaixaTransaction, 'id'>,
    tenantId: string
  ) => Promise<string>;
  loadRange: (tenantId: string, range?: DateRange) => Promise<void>;
  subscribe: (tenantId: string) => Unsubscribe;
  clear: () => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loading: false,
  error: null,
  dateRange: 'today' as DateRange,

  // Computed helpers — work on whatever transactions are loaded
  totalIn: () =>
    get()
      .transactions.filter((t) => t.type === 'in')
      .reduce((sum, t) => sum + t.amount, 0),

  totalOut: () =>
    get()
      .transactions.filter((t) => t.type === 'out')
      .reduce((sum, t) => sum + t.amount, 0),

  totalNet: () => get().totalIn() - get().totalOut(),

  totalVAT: () =>
    get()
      .transactions.filter((t) => t.type === 'in')
      .reduce((sum, t) => sum + t.vatAmount, 0),

  transactionCount: () => get().transactions.length,

  recentTransactions: (limit = 10) => get().transactions.slice(0, limit),

  setDateRange: (range) => set({ dateRange: range }),

  addTransaction: async (tx, tenantId) => {
    try {
      const colRef = collection(db, paths.transactions(tenantId));
      const docRef = await addDoc(colRef, {
        ...tx,
        timestamp: Timestamp.fromDate(tx.timestamp),
        createdAt: Timestamp.fromDate(tx.createdAt),
        updatedAt: Timestamp.fromDate(tx.updatedAt),
      });

      // Optimistic update
      const newTx: KaixaTransaction = { ...tx, id: docRef.id };
      set((state) => ({
        transactions: [newTx, ...state.transactions],
      }));

      return docRef.id;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save transaction';
      set({ error: message });
      throw err;
    }
  },

  loadRange: async (tenantId, range) => {
    const dateRange = range || get().dateRange;
    set({ loading: true, error: null, dateRange });

    try {
      const { start, end } = getDateRange(dateRange);
      const colRef = collection(db, paths.transactions(tenantId));
      const q = query(
        colRef,
        where('timestamp', '>=', Timestamp.fromDate(start)),
        where('timestamp', '<', Timestamp.fromDate(end)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map((doc) =>
        mapDoc(doc.id, doc.data())
      );

      set({ transactions, loading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load transactions';
      set({ error: message, loading: false });
    }
  },

  subscribe: (tenantId) => {
    const { start, end } = getDateRange(get().dateRange);
    const colRef = collection(db, paths.transactions(tenantId));
    const q = query(
      colRef,
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const transactions = snapshot.docs.map((doc) =>
          mapDoc(doc.id, doc.data())
        );
        set({ transactions, loading: false });
      },
      (err) => {
        set({ error: err.message, loading: false });
      }
    );
  },

  clear: () => set({ transactions: [], loading: false, error: null }),
}));
