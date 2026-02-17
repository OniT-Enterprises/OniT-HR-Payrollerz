/**
 * Tenant store — manages current tenant + employeeId resolution
 * Fetches employeeId from tenants/{tid}/members/{uid} after tenant selection
 */
import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../lib/firebase';

interface TenantState {
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
  employeeId: string | null;
  loading: boolean;
  error: string | null;

  setTenant: (tenantId: string, tenantName: string, role: string) => void;
  resolveEmployee: (uid: string) => Promise<void>;
  loadSavedTenant: () => Promise<void>;
  clearTenant: () => void;
}

const TENANT_STORAGE_KEY = '@ekipa/currentTenant';

export const useTenantStore = create<TenantState>((set, get) => ({
  tenantId: null,
  tenantName: null,
  role: null,
  employeeId: null,
  loading: true,
  error: null,

  setTenant: async (tenantId: string, tenantName: string, role: string) => {
    set({ tenantId, tenantName, role, loading: false, error: null });
    await AsyncStorage.setItem(
      TENANT_STORAGE_KEY,
      JSON.stringify({ tenantId, tenantName, role })
    );
  },

  resolveEmployee: async (uid: string) => {
    const { tenantId } = get();
    if (!tenantId) return;

    try {
      const memberDoc = await getDoc(doc(db, `tenants/${tenantId}/members/${uid}`));
      if (memberDoc.exists()) {
        const data = memberDoc.data();
        if (data.employeeId) {
          set({ employeeId: data.employeeId, error: null });
          return;
        }
      }
      // No member doc or no employeeId
      set({ employeeId: null, error: 'noEmployee' });
    } catch {
      set({ employeeId: null, error: 'fetchError' });
    }
  },

  loadSavedTenant: async () => {
    try {
      const saved = await AsyncStorage.getItem(TENANT_STORAGE_KEY);
      if (saved) {
        const { tenantId, tenantName, role } = JSON.parse(saved);
        set({ tenantId, tenantName, role, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  clearTenant: async () => {
    set({ tenantId: null, tenantName: null, role: null, employeeId: null, error: null });
    await AsyncStorage.removeItem(TENANT_STORAGE_KEY);
  },
}));
