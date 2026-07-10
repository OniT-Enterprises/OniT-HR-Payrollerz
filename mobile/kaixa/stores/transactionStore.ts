/**
 * Transaction Store — Firestore-backed transaction management.
 *
 * Supports date range queries (today, this week, this month, custom).
 * Provides computed summaries for the UI.
 */
import { create } from 'zustand';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  runTransaction,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { paths } from '@onit/shared';
import type { KaixaTransaction } from '../types/transaction';

export interface SaleStockItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

function receiptYear(date: Date): string {
  return date
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Dili' })
    .split('-')[0];
}

function formatReceiptNumber(year: string, sequence: number): string {
  return `REC-${year}-${String(sequence).padStart(6, '0')}`;
}

function serializeTransaction(tx: Omit<KaixaTransaction, 'id'>) {
  return {
    ...tx,
    timestamp: Timestamp.fromDate(tx.timestamp),
    createdAt: Timestamp.fromDate(tx.createdAt),
    updatedAt: Timestamp.fromDate(tx.updatedAt),
  };
}

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
  completeSale: (
    tx: Omit<KaixaTransaction, 'id'>,
    tenantId: string,
    stockItems: SaleStockItem[]
  ) => Promise<KaixaTransaction>;
  ensureReceiptNumber: (
    tenantId: string,
    tx: KaixaTransaction
  ) => Promise<KaixaTransaction>;
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
    set({ error: null });
    try {
      const txRef = doc(collection(db, paths.transactions(tenantId)));
      let receiptNumber = tx.receiptNumber;

      await runTransaction(db, async (firestoreTx) => {
        if (tx.type === 'in' && !receiptNumber) {
          const year = receiptYear(tx.timestamp);
          const counterRef = doc(db, paths.receiptCounter(tenantId, year));
          const counterSnap = await firestoreTx.get(counterRef);
          const nextSequence = counterSnap.exists()
            ? ((counterSnap.data().seq as number) || 0) + 1
            : 1;

          receiptNumber = formatReceiptNumber(year, nextSequence);
          firestoreTx.set(
            counterRef,
            { seq: nextSequence, year, updatedAt: Timestamp.fromDate(new Date()) },
            { merge: true }
          );
        }

        firestoreTx.set(
          txRef,
          serializeTransaction({ ...tx, receiptNumber })
        );
      });

      // Optimistic update
      const newTx: KaixaTransaction = { ...tx, receiptNumber, id: txRef.id };
      set((state) => ({
        transactions: [newTx, ...state.transactions],
      }));

      return txRef.id;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save transaction';
      set({ error: message });
      throw err;
    }
  },

  completeSale: async (tx, tenantId, stockItems) => {
    set({ error: null });
    try {
      const txRef = doc(collection(db, paths.transactions(tenantId)));
      const year = receiptYear(tx.timestamp);
      const counterRef = doc(db, paths.receiptCounter(tenantId, year));
      const productRefs = stockItems.map((item) =>
        doc(db, paths.product(tenantId, item.productId))
      );
      let receiptNumber = '';

      await runTransaction(db, async (firestoreTx) => {
        // Firestore requires every read to happen before the first write.
        const [counterSnap, ...productSnaps] = await Promise.all([
          firestoreTx.get(counterRef),
          ...productRefs.map((ref) => firestoreTx.get(ref)),
        ]);

        productSnaps.forEach((snapshot, index) => {
          const item = stockItems[index];
          if (!snapshot.exists()) {
            throw new Error('A product in this cart no longer exists. Refresh and try again.');
          }

          const product = snapshot.data();
          if (product.isActive === false) {
            throw new Error('A product in this cart is no longer available.');
          }

          const currentPrice = Number(product.price ?? 0);
          if (Math.abs(currentPrice - item.unitPrice) > 0.0001) {
            throw new Error('A product price changed. Refresh the cart before checkout.');
          }

          if (product.stock != null && Number(product.stock) < item.quantity) {
            throw new Error(`Only ${product.stock} ${product.name || 'item(s)'} remain in stock.`);
          }
        });

        const nextSequence = counterSnap.exists()
          ? ((counterSnap.data().seq as number) || 0) + 1
          : 1;
        receiptNumber = formatReceiptNumber(year, nextSequence);
        const now = new Date();

        firestoreTx.set(
          counterRef,
          { seq: nextSequence, year, updatedAt: Timestamp.fromDate(now) },
          { merge: true }
        );
        firestoreTx.set(
          txRef,
          serializeTransaction({ ...tx, receiptNumber })
        );

        productSnaps.forEach((snapshot, index) => {
          const currentStock = snapshot.data()?.stock;
          if (currentStock == null) return;

          firestoreTx.update(productRefs[index], {
            stock: Number(currentStock) - stockItems[index].quantity,
            updatedAt: Timestamp.fromDate(now),
          });
        });
      });

      const completed: KaixaTransaction = {
        ...tx,
        id: txRef.id,
        receiptNumber,
      };
      set((state) => ({ transactions: [completed, ...state.transactions] }));
      return completed;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to complete sale';
      set({ error: message });
      throw err;
    }
  },

  ensureReceiptNumber: async (tenantId, tx) => {
    if (tx.receiptNumber) return tx;

    set({ error: null });
    try {
      const txRef = doc(db, paths.transaction(tenantId, tx.id));
      const year = receiptYear(tx.timestamp);
      const counterRef = doc(db, paths.receiptCounter(tenantId, year));
      let receiptNumber = '';

      await runTransaction(db, async (firestoreTx) => {
        const [txSnap, counterSnap] = await Promise.all([
          firestoreTx.get(txRef),
          firestoreTx.get(counterRef),
        ]);

        if (!txSnap.exists()) {
          throw new Error('Transaction not found');
        }

        const existing = txSnap.data().receiptNumber as string | undefined;
        if (existing) {
          receiptNumber = existing;
          return;
        }

        const nextSequence = counterSnap.exists()
          ? ((counterSnap.data().seq as number) || 0) + 1
          : 1;
        receiptNumber = formatReceiptNumber(year, nextSequence);
        const now = Timestamp.fromDate(new Date());

        firestoreTx.set(
          counterRef,
          { seq: nextSequence, year, updatedAt: now },
          { merge: true }
        );
        firestoreTx.update(txRef, { receiptNumber, updatedAt: now });
      });

      const updated = { ...tx, receiptNumber, updatedAt: new Date() };
      set((state) => ({
        transactions: state.transactions.map((item) =>
          item.id === tx.id ? updated : item
        ),
      }));
      return updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create receipt number';
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
