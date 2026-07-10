/**
 * Customer Tab Store — Firestore-backed credit tracking.
 *
 * "João owes me $15" — track who owes you and who you owe.
 * Path: tenants/{tid}/customerTabs/{tabId}
 */
import { create } from 'zustand';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { paths } from '@onit/shared';

// ============================================
// Types
// ============================================

export interface TabEntry {
  id: string;
  amount: number;
  type: 'debt' | 'payment';
  note: string;
  date: Date;
}

export interface CustomerTab {
  id: string;
  customerName: string;
  phone: string;
  balance: number;
  entries: TabEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Mapper
// ============================================

function mapDoc(id: string, data: Record<string, unknown>): CustomerTab {
  const entries = (data.entries as Array<Record<string, unknown>> || []).map(
    (e, i) => ({
      id: (e.id as string) || `entry-${i}`,
      amount: (e.amount as number) || 0,
      type: (e.type as 'debt' | 'payment') || 'debt',
      note: (e.note as string) || '',
      date:
        e.date instanceof Timestamp
          ? e.date.toDate()
          : new Date(e.date as string),
    })
  );

  return {
    id,
    customerName: (data.customerName as string) || '',
    phone: (data.phone as string) || '',
    balance: (data.balance as number) || 0,
    entries,
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

interface CustomerTabState {
  tabs: CustomerTab[];
  loading: boolean;
  error: string | null;

  // Computed
  totalOwed: () => number;
  activeTabCount: () => number;

  // Actions
  loadTabs: (tenantId: string) => Promise<void>;
  addCustomer: (
    tenantId: string,
    name: string,
    phone?: string
  ) => Promise<string>;
  addEntry: (
    tenantId: string,
    tabId: string,
    amount: number,
    type: 'debt' | 'payment',
    note?: string
  ) => Promise<void>;
  deleteCustomer: (tenantId: string, tabId: string) => Promise<void>;
  clear: () => void;
}

export const useCustomerTabStore = create<CustomerTabState>((set, get) => ({
  tabs: [],
  loading: false,
  error: null,

  totalOwed: () =>
    get()
      .tabs.filter((t) => t.balance > 0)
      .reduce((sum, t) => sum + t.balance, 0),

  activeTabCount: () => get().tabs.filter((t) => t.balance !== 0).length,

  loadTabs: async (tenantId) => {
    set({ loading: true, error: null });
    try {
      const colRef = collection(db, paths.customerTabs(tenantId));
      const q = query(colRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      const tabs = snapshot.docs.map((d) => mapDoc(d.id, d.data()));
      set({ tabs, loading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load customer tabs';
      set({ error: message, loading: false });
    }
  },

  addCustomer: async (tenantId, name, phone = '') => {
    set({ error: null });
    try {
      const now = new Date();
      const colRef = collection(db, paths.customerTabs(tenantId));
      const docRef = await addDoc(colRef, {
        customerName: name,
        phone,
        balance: 0,
        entries: [],
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });

      const newTab: CustomerTab = {
        id: docRef.id,
        customerName: name,
        phone,
        balance: 0,
        entries: [],
        createdAt: now,
        updatedAt: now,
      };

      set((state) => ({ tabs: [newTab, ...state.tabs] }));
      return docRef.id;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to add customer';
      set({ error: message });
      throw err;
    }
  },

  addEntry: async (tenantId, tabId, amount, type, note = '') => {
    set({ error: null });
    try {
      const now = new Date();
      const entry: TabEntry = {
        id: `e-${Date.now()}`,
        amount,
        type,
        note,
        date: now,
      };
      const ref = doc(db, paths.customerTab(tenantId, tabId));
      let newBalance = 0;

      await runTransaction(db, async (firestoreTx) => {
        const snapshot = await firestoreTx.get(ref);
        if (!snapshot.exists()) throw new Error('Customer tab not found');

        const data = snapshot.data();
        const currentBalance = Number(data.balance ?? 0);
        if (type === 'payment' && amount > currentBalance) {
          throw new Error(`Payment cannot exceed the $${currentBalance.toFixed(2)} balance.`);
        }

        newBalance = type === 'debt'
          ? currentBalance + amount
          : currentBalance - amount;
        const existingEntries = Array.isArray(data.entries) ? data.entries : [];

        firestoreTx.update(ref, {
          balance: Math.round(newBalance * 100) / 100,
          entries: [
            ...existingEntries,
            { ...entry, date: Timestamp.fromDate(now) },
          ],
          updatedAt: Timestamp.fromDate(now),
        });
      });

      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                balance: Math.round(newBalance * 100) / 100,
                entries: [...t.entries, entry],
                updatedAt: now,
              }
            : t
        ),
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to add entry';
      set({ error: message });
      throw err;
    }
  },

  deleteCustomer: async (tenantId, tabId) => {
    set({ error: null });
    try {
      const ref = doc(db, paths.customerTab(tenantId, tabId));
      await deleteDoc(ref);
      set((state) => ({
        tabs: state.tabs.filter((t) => t.id !== tabId),
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete customer';
      set({ error: message });
      throw err;
    }
  },

  clear: () => set({ tabs: [], loading: false, error: null }),
}));
