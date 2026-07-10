/**
 * Product Store — Firestore-backed product catalog for Kaixa POS.
 *
 * Products live at tenants/{tid}/products/{prodId}.
 * Supports basic CRUD + active filtering for POS display.
 */
import { create } from 'zustand';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { paths } from '@onit/shared';

// ============================================
// Types
// ============================================

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  isActive: boolean;
  stock: number | null; // null = unlimited / not tracked
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Mapper
// ============================================

function mapDoc(id: string, data: Record<string, unknown>): Product {
  return {
    id,
    name: (data.name as string) || '',
    price: (data.price as number) || 0,
    category: (data.category as string) || '',
    isActive: data.isActive !== false,
    stock: data.stock != null ? (data.stock as number) : null,
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

interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;

  // Computed
  activeProducts: () => Product[];

  // Actions
  loadProducts: (tenantId: string) => Promise<void>;
  addProduct: (
    tenantId: string,
    data: { name: string; price: number; category?: string; stock?: number | null }
  ) => Promise<string>;
  updateProduct: (
    tenantId: string,
    productId: string,
    data: Partial<Pick<Product, 'name' | 'price' | 'category' | 'isActive' | 'stock'>>
  ) => Promise<void>;
  deleteProduct: (tenantId: string, productId: string) => Promise<void>;
  clear: () => void;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: false,
  error: null,

  activeProducts: () => get().products.filter((p) => p.isActive),

  loadProducts: async (tenantId) => {
    set({ loading: true, error: null });
    try {
      const colRef = collection(db, paths.products(tenantId));
      const q = query(colRef, orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const products = snapshot.docs.map((d) => mapDoc(d.id, d.data()));
      set({ products, loading: false });
    } catch (err: unknown) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load products',
      });
    }
  },

  addProduct: async (tenantId, data) => {
    set({ error: null });
    const now = new Date();
    const colRef = collection(db, paths.products(tenantId));
    const docRef = await addDoc(colRef, {
      name: data.name,
      price: data.price,
      category: data.category || '',
      isActive: true,
      stock: data.stock ?? null,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    });

    const newProduct: Product = {
      id: docRef.id,
      name: data.name,
      price: data.price,
      category: data.category || '',
      isActive: true,
      stock: data.stock ?? null,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      products: [...state.products, newProduct].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }));

    return docRef.id;
  },

  updateProduct: async (tenantId, productId, data) => {
    set({ error: null });
    const ref = doc(db, paths.product(tenantId, productId));
    await updateDoc(ref, {
      ...data,
      updatedAt: Timestamp.fromDate(new Date()),
    });

    set((state) => ({
      products: state.products.map((p) =>
        p.id === productId ? { ...p, ...data, updatedAt: new Date() } : p
      ),
    }));
  },

  deleteProduct: async (tenantId, productId) => {
    set({ error: null });
    const ref = doc(db, paths.product(tenantId, productId));
    await deleteDoc(ref);

    set((state) => ({
      products: state.products.filter((p) => p.id !== productId),
    }));
  },

  clear: () => set({ products: [], loading: false, error: null }),
}));
