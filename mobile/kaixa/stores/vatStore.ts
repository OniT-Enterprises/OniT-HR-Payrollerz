/**
 * VAT Config Store — Caches platform VAT config from Firestore.
 *
 * On app launch: loads cached config from AsyncStorage.
 * When online: fetches latest from Firestore and updates cache.
 * All VAT calculations use this config.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { VATConfig, TenantVATSettings } from '@onit/shared';
import { DEFAULT_VAT_CONFIG, DEFAULT_TENANT_VAT_SETTINGS } from '@onit/shared';

const PLATFORM_CACHE_KEY = '@kaixa/vatConfig';
const TENANT_CACHE_KEY = '@kaixa/tenantVatSettings';

interface VATState {
  /** Platform-level VAT config */
  config: VATConfig;
  /** Tenant-specific VAT settings */
  tenantSettings: TenantVATSettings;
  /** Loading state */
  loading: boolean;
  /** Last sync timestamp */
  lastSynced: Date | null;

  // Computed
  /** Is VAT active for this tenant? */
  isVATActive: () => boolean;
  /** Current effective VAT rate */
  effectiveRate: () => number;

  // Actions
  /** Load cached config from AsyncStorage */
  loadCached: () => Promise<void>;
  /** Fetch latest config from Firestore */
  syncFromFirestore: (tenantId: string) => Promise<void>;
}

export const useVATStore = create<VATState>((set, get) => ({
  config: DEFAULT_VAT_CONFIG,
  tenantSettings: DEFAULT_TENANT_VAT_SETTINGS,
  loading: false,
  lastSynced: null,

  isVATActive: () => {
    const { config, tenantSettings } = get();
    return config.enabled && tenantSettings.vatEnabled;
  },

  effectiveRate: () => {
    const { config, tenantSettings } = get();
    if (!config.enabled || !tenantSettings.vatEnabled) return 0;
    return tenantSettings.defaultVATRate || config.standardRate;
  },

  loadCached: async () => {
    try {
      const [configJson, settingsJson] = await Promise.all([
        AsyncStorage.getItem(PLATFORM_CACHE_KEY),
        AsyncStorage.getItem(TENANT_CACHE_KEY),
      ]);

      const updates: Partial<VATState> = {};
      if (configJson) {
        updates.config = JSON.parse(configJson);
      }
      if (settingsJson) {
        updates.tenantSettings = JSON.parse(settingsJson);
      }

      if (Object.keys(updates).length > 0) {
        set(updates);
      }
    } catch {
      // Cache miss is fine — defaults are safe (VAT disabled)
    }
  },

  syncFromFirestore: async (tenantId: string) => {
    set({ loading: true });
    try {
      // Fetch platform config and tenant settings in parallel
      const [configSnap, settingsSnap] = await Promise.all([
        getDoc(doc(db, 'platform', 'vatConfig')),
        getDoc(doc(db, 'tenants', tenantId, 'settings', 'vat')),
      ]);

      const config = configSnap.exists()
        ? (configSnap.data() as VATConfig)
        : DEFAULT_VAT_CONFIG;

      const tenantSettings = settingsSnap.exists()
        ? (settingsSnap.data() as TenantVATSettings)
        : DEFAULT_TENANT_VAT_SETTINGS;

      // Update state
      set({ config, tenantSettings, lastSynced: new Date(), loading: false });

      // Cache for offline use
      await Promise.all([
        AsyncStorage.setItem(PLATFORM_CACHE_KEY, JSON.stringify(config)),
        AsyncStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(tenantSettings)),
      ]);
    } catch {
      // Offline — use cached values
      set({ loading: false });
    }
  },
}));
