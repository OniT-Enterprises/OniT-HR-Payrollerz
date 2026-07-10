/**
 * Employee-safe tenant settings used by the Ekipa dashboard.
 *
 * Xefe stores the canonical configuration at
 * `tenants/{tenantId}/settings/config`. Ekipa only reads the small subset it
 * needs to explain the next payroll date to an employee.
 */
import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface PayrollPeriodConfig {
  payDay?: number;
  isActive?: boolean;
}

interface EkipaSettingsState {
  payDay: number;
  companyName: string | null;
  loading: boolean;
  error: string | null;

  fetchSettings: (tenantId: string) => Promise<void>;
  clear: () => void;
}

const DEFAULT_PAY_DAY = 25;

function normalizePayDay(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_PAY_DAY;
  return Math.min(31, Math.max(1, Math.round(value)));
}

export const useSettingsStore = create<EkipaSettingsState>((set) => ({
  payDay: DEFAULT_PAY_DAY,
  companyName: null,
  loading: false,
  error: null,

  fetchSettings: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      let snapshot = await getDoc(doc(db, `tenants/${tenantId}/settings/config`));

      // Older tenants may still have the pre-migration settings document.
      if (!snapshot.exists()) {
        snapshot = await getDoc(doc(db, 'tenant_settings', tenantId));
      }

      if (!snapshot.exists()) {
        set({ payDay: DEFAULT_PAY_DAY, companyName: null, loading: false });
        return;
      }

      const data = snapshot.data();
      const periods = Array.isArray(data.paymentStructure?.payrollPeriods)
        ? data.paymentStructure.payrollPeriods as PayrollPeriodConfig[]
        : [];
      const activePeriod = periods.find((period) => period.isActive !== false)
        ?? periods[0];

      set({
        payDay: normalizePayDay(activePeriod?.payDay),
        companyName:
          typeof data.companyDetails?.legalName === 'string' && data.companyDetails.legalName.trim()
            ? data.companyDetails.legalName.trim()
            : null,
        loading: false,
      });
    } catch {
      set({ payDay: DEFAULT_PAY_DAY, companyName: null, loading: false, error: 'fetchError' });
    }
  },

  clear: () => set({ payDay: DEFAULT_PAY_DAY, companyName: null, loading: false, error: null }),
}));
