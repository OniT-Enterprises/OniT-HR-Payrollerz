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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asDate(value: unknown): Date | undefined {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function asStatus(value: unknown): Payslip['status'] {
  return value === 'draft' || value === 'processed' || value === 'approved' || value === 'paid'
    ? value
    : 'processed';
}

function mapBreakdown(raw: unknown): Array<{ label: string; amount: number }> {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!isRecord(item)) return [];
    const label = asString(item.label);
    const amount = asNumber(item.amount);
    if (!label || amount === undefined || amount === 0) {
      return [];
    }
    return [{ label, amount }];
  });
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

function mapPayslipDoc(docId: string, data: UnknownRecord, period: string): Payslip {
  const employeeId = asString(data.employeeId) ?? docId;
  const employeeName = asString(data.employeeName) ?? '';
  const baseSalary = asNumber(data.baseSalary) ?? 0;
  const overtimePay = asNumber(data.overtimePay) ?? 0;
  const allowances = asNumber(data.allowances) ?? 0;
  const otherEarnings = asNumber(data.otherEarnings) ?? 0;
  const grossPay = asNumber(data.grossPay) ?? 0;
  const witAmount = asNumber(data.witAmount) ?? 0;
  const inssEmployee = asNumber(data.inssEmployee) ?? 0;
  const inssEmployer = asNumber(data.inssEmployer) ?? 0;
  const otherDeductions = asNumber(data.otherDeductions) ?? 0;
  const totalDeductions = asNumber(data.totalDeductions) ?? 0;
  const netPay = asNumber(data.netPay) ?? 0;

  // Build earnings breakdown
  const earnings: PayslipEarning[] = [];
  if (baseSalary) earnings.push({ label: t('payslips.baseSalary'), amount: baseSalary });
  if (overtimePay) earnings.push({ label: t('payslips.overtime'), amount: overtimePay });
  if (allowances) earnings.push({ label: t('payslips.allowances'), amount: allowances });
  if (otherEarnings) earnings.push({ label: t('payslips.other'), amount: otherEarnings });

  // Also check for itemized earnings/deductions arrays
  earnings.push(...mapBreakdown(data.earnings));

  const deductions: PayslipDeduction[] = [];
  if (witAmount) deductions.push({ label: t('payslips.wit'), amount: witAmount });
  if (inssEmployee) deductions.push({ label: t('payslips.inss'), amount: inssEmployee });
  if (otherDeductions) deductions.push({ label: t('payslips.other'), amount: otherDeductions });
  deductions.push(...mapBreakdown(data.deductions));

  return {
    id: docId,
    employeeId,
    employeeName,
    period,
    periodLabel: formatPeriodLabel(period),
    baseSalary,
    overtimePay,
    allowances,
    otherEarnings,
    grossPay,
    witAmount,
    inssEmployee,
    inssEmployer,
    otherDeductions,
    totalDeductions,
    netPay,
    earnings: earnings.length > 0 ? earnings : [{ label: t('payslips.baseSalary'), amount: grossPay }],
    deductions: deductions.length > 0 ? deductions : [],
    status: asStatus(data.status),
    processedAt: asDate(data.processedAt),
    paidAt: asDate(data.paidAt),
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
