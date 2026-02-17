/**
 * Tenant store — manages current tenant context
 * Mirrors the web app's TenantContext but using Zustand
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TenantState {
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
  loading: boolean;

  // Actions
  setTenant: (tenantId: string, tenantName: string, role: string) => void;
  loadSavedTenant: () => Promise<void>;
  clearTenant: () => void;
}

const TENANT_STORAGE_KEY = '@kaixa/currentTenant';

export const useTenantStore = create<TenantState>((set) => ({
  tenantId: null,
  tenantName: null,
  role: null,
  loading: true,

  setTenant: async (tenantId: string, tenantName: string, role: string) => {
    set({ tenantId, tenantName, role, loading: false });
    // Persist selection
    await AsyncStorage.setItem(
      TENANT_STORAGE_KEY,
      JSON.stringify({ tenantId, tenantName, role })
    );
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
    set({ tenantId: null, tenantName: null, role: null });
    await AsyncStorage.removeItem(TENANT_STORAGE_KEY);
  },
}));
