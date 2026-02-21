/**
 * Payslip store — fetch own payslips from recent payruns
 * Path: tenants/{tid}/payruns/{yyyymm}/payslips/{empId}
 */
import { create } from 'zustand';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../lib/firebase';
import { t } from '../lib/i18n';
import type { Payslip, PayslipEarning, PayslipDeduction } from '../types/payslip';

const PAYSLIP_CACHE_KEY = '@ekipa/payslips_cache';
const MAX_CACHED_PAYSLIPS = 6;

const MONTHS_TO_FETCH = 12;

interface PayslipState {
  payslips: Payslip[];
  selectedPayslip: Payslip | null;
  loading: boolean;
  error: string | null;

  fetchPayslips: (tenantId: string, employeeId: string) => Promise<void>;
  selectPayslip: (payslip: Payslip) => void;
  clearSelection: () => void;
  clear: () => void;
}

function formatPeriodLabel(yyyymm: string): string {
  const year = yyyymm.substring(0, 4);
  const month = parseInt(yyyymm.substring(4, 6), 10);
  return `${t(`month.${month}`)} ${year}`;
}

function getRecentPeriods(count: number): string[] {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear().toString();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    periods.push(`${yyyy}${mm}`);
  }
  return periods;
}

function mapPayslipDoc(docId: string, data: any, period: string): Payslip {
  // Build earnings breakdown
  const earnings: PayslipEarning[] = [];
  if (data.baseSalary) earnings.push({ label: t('payslips.baseSalary'), amount: data.baseSalary });
  if (data.overtimePay) earnings.push({ label: t('payslips.overtime'), amount: data.overtimePay });
  if (data.allowances) earnings.push({ label: t('payslips.allowances'), amount: data.allowances });
  if (data.otherEarnings) earnings.push({ label: t('payslips.other'), amount: data.otherEarnings });

  // Also check for itemized earnings/deductions arrays
  if (data.earnings && Array.isArray(data.earnings)) {
    for (const e of data.earnings) {
      if (e.label && e.amount) earnings.push(e);
    }
  }

  const deductions: PayslipDeduction[] = [];
  if (data.witAmount) deductions.push({ label: t('payslips.wit'), amount: data.witAmount });
  if (data.inssEmployee) deductions.push({ label: t('payslips.inss'), amount: data.inssEmployee });
  if (data.otherDeductions) deductions.push({ label: t('payslips.other'), amount: data.otherDeductions });

  if (data.deductions && Array.isArray(data.deductions)) {
    for (const d of data.deductions) {
      if (d.label && d.amount) deductions.push(d);
    }
  }

  return {
    id: docId,
    employeeId: data.employeeId || docId,
    employeeName: data.employeeName || '',
    period,
    periodLabel: formatPeriodLabel(period),
    baseSalary: data.baseSalary || 0,
    overtimePay: data.overtimePay || 0,
    allowances: data.allowances || 0,
    otherEarnings: data.otherEarnings || 0,
    grossPay: data.grossPay || 0,
    witAmount: data.witAmount || 0,
    inssEmployee: data.inssEmployee || 0,
    inssEmployer: data.inssEmployer || 0,
    otherDeductions: data.otherDeductions || 0,
    totalDeductions: data.totalDeductions || 0,
    netPay: data.netPay || 0,
    earnings: earnings.length > 0 ? earnings : [{ label: t('payslips.baseSalary'), amount: data.grossPay || 0 }],
    deductions: deductions.length > 0 ? deductions : [],
    status: data.status || 'processed',
    processedAt: data.processedAt instanceof Timestamp ? data.processedAt.toDate() : data.processedAt,
    paidAt: data.paidAt instanceof Timestamp ? data.paidAt.toDate() : data.paidAt,
  };
}

export const usePayslipStore = create<PayslipState>((set) => ({
  payslips: [],
  selectedPayslip: null,
  loading: false,
  error: null,

  fetchPayslips: async (tenantId: string, employeeId: string) => {
    set({ loading: true, error: null });
    try {
      const periods = getRecentPeriods(MONTHS_TO_FETCH);
      const results: Payslip[] = [];

      // Fetch payslip from each recent period in parallel
      const fetches = periods.map(async (period) => {
        try {
          const payslipDoc = await getDoc(
            doc(db, `tenants/${tenantId}/payruns/${period}/payslips/${employeeId}`)
          );
          if (payslipDoc.exists()) {
            return mapPayslipDoc(payslipDoc.id, payslipDoc.data(), period);
          }
        } catch {
          // Skip periods that don't exist
        }
        return null;
      });

      const fetched = await Promise.all(fetches);
      for (const p of fetched) {
        if (p) results.push(p);
      }

      // Sort by period descending (most recent first)
      results.sort((a, b) => b.period.localeCompare(a.period));

      // Cache the latest payslips for offline access
      try {
        const toCache = results.slice(0, MAX_CACHED_PAYSLIPS);
        await AsyncStorage.setItem(PAYSLIP_CACHE_KEY, JSON.stringify(toCache));
      } catch {
        // Cache write failure is non-critical
      }

      set({ payslips: results, loading: false });
    } catch {
      // On network failure, try to load from cache
      try {
        const cached = await AsyncStorage.getItem(PAYSLIP_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as Payslip[];
          set({ payslips: parsed, loading: false, error: null });
          return;
        }
      } catch {
        // Cache read also failed
      }
      set({ payslips: [], loading: false, error: 'fetchError' });
    }
  },

  selectPayslip: (payslip: Payslip) => set({ selectedPayslip: payslip }),
  clearSelection: () => set({ selectedPayslip: null }),
  clear: () => set({ payslips: [], selectedPayslip: null, loading: false, error: null }),
}));
