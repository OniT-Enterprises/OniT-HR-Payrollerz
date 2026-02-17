/**
 * Kaixa — VAT Return Generator
 *
 * Generates a formatted VAT return document for filing with the
 * DGFI (Diresaun Geral Finansas e Impostu), Timor-Leste's tax authority.
 *
 * Supports monthly and quarterly filing periods. Output is a text-based
 * form that can be shared via WhatsApp, printed, or used as a reference
 * when completing the official filing.
 */
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { paths } from '@onit/shared';
import type { VATCategory } from '@onit/shared';

// ============================================
// Types
// ============================================

export interface VATReturnPeriod {
  type: 'monthly' | 'quarterly';
  year: number;
  /** 1-12, required when type is 'monthly' */
  month?: number;
  /** 1-4, required when type is 'quarterly' */
  quarter?: number;
}

export interface BusinessInfo {
  name: string;
  vatRegNumber: string;
  address: string;
  phone: string;
}

export interface VATReturnData {
  period: VATReturnPeriod;
  periodLabel: string;
  periodLabelTL: string;

  // Box 1: Output VAT
  totalTaxableSales: number;
  standardRateVATOnSales: number;
  reducedRateSales: number;
  zeroRatedSales: number;
  exemptSales: number;
  totalOutputVAT: number;

  // Box 2: Input VAT
  totalTaxablePurchases: number;
  vatOnPurchases: number;
  totalInputVAT: number;

  // Box 3: Net VAT
  netVATPayable: number;

  // Box 4: Summary
  totalTransactions: number;
  totalRevenue: number;
  totalExpenses: number;

  // Rates observed
  standardRate: number;

  // Deadline
  filingDeadline: string;
}

// ============================================
// Tetum month names (same as monthlyReport)
// ============================================

const TETUM_MONTHS = [
  'Janeiru',
  'Fevereiru',
  'Marsu',
  'Abril',
  'Maiu',
  'Juñu',
  'Jullu',
  'Agostu',
  'Setembru',
  'Outubru',
  'Novembru',
  'Dezembru',
];

const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// ============================================
// Internal transaction type for query results
// ============================================

interface TransactionRow {
  type: 'in' | 'out';
  amount: number;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  vatCategory: VATCategory;
  category: string;
}

// ============================================
// Data fetching
// ============================================

/**
 * Resolve a period into start/end dates in Dili timezone (UTC+9).
 */
function getPeriodBoundaries(period: VATReturnPeriod): {
  start: Date;
  end: Date;
  startMonth: number;
  endMonth: number;
} {
  if (period.type === 'monthly') {
    const month = period.month!;
    const startStr = `${period.year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? period.year + 1 : period.year;
    const endStr = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00+09:00`;
    return {
      start: new Date(startStr),
      end: new Date(endStr),
      startMonth: month,
      endMonth: month,
    };
  }

  // Quarterly: Q1 = Jan-Mar, Q2 = Apr-Jun, Q3 = Jul-Sep, Q4 = Oct-Dec
  const quarter = period.quarter!;
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const startStr = `${period.year}-${String(startMonth).padStart(2, '0')}-01T00:00:00+09:00`;
  const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
  const nextYear = endMonth === 12 ? period.year + 1 : period.year;
  const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`;
  return {
    start: new Date(startStr),
    end: new Date(endStr),
    startMonth,
    endMonth,
  };
}

/**
 * Fetch all transactions for a given period from Firestore.
 */
async function fetchPeriodTransactions(
  tenantId: string,
  period: VATReturnPeriod
): Promise<TransactionRow[]> {
  const { start, end } = getPeriodBoundaries(period);

  const colRef = collection(db, paths.transactions(tenantId));
  const q = query(
    colRef,
    where('timestamp', '>=', Timestamp.fromDate(start)),
    where('timestamp', '<', Timestamp.fromDate(end)),
    orderBy('timestamp', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      type: (data.type as 'in' | 'out') || 'in',
      amount: (data.amount as number) || 0,
      netAmount: (data.netAmount as number) || 0,
      vatRate: (data.vatRate as number) || 0,
      vatAmount: (data.vatAmount as number) || 0,
      vatCategory: (data.vatCategory as VATCategory) || 'none',
      category: (data.category as string) || 'other',
    };
  });
}

// ============================================
// Period labels
// ============================================

function getPeriodLabel(period: VATReturnPeriod): string {
  if (period.type === 'monthly') {
    return `${EN_MONTHS[period.month! - 1]} ${period.year}`;
  }
  return `Q${period.quarter} ${period.year} (${EN_MONTHS[(period.quarter! - 1) * 3]}-${EN_MONTHS[period.quarter! * 3 - 1]})`;
}

function getPeriodLabelTL(period: VATReturnPeriod): string {
  if (period.type === 'monthly') {
    return `${TETUM_MONTHS[period.month! - 1]} ${period.year}`;
  }
  return `Q${period.quarter} ${period.year} (${TETUM_MONTHS[(period.quarter! - 1) * 3]}-${TETUM_MONTHS[period.quarter! * 3 - 1]})`;
}

// ============================================
// Filing deadline calculation
// ============================================

/**
 * TL filing deadline: 15th of the month following the period end.
 * - Monthly (e.g. January): deadline is February 15th.
 * - Quarterly (e.g. Q1 Jan-Mar): deadline is April 15th.
 */
function getFilingDeadline(period: VATReturnPeriod): Date {
  let lastMonth: number;
  let year = period.year;

  if (period.type === 'monthly') {
    lastMonth = period.month!;
  } else {
    lastMonth = period.quarter! * 3;
  }

  // Move to the following month
  let deadlineMonth = lastMonth + 1;
  let deadlineYear = year;
  if (deadlineMonth > 12) {
    deadlineMonth = 1;
    deadlineYear += 1;
  }

  // 15th of that month, Dili timezone
  const deadlineStr = `${deadlineYear}-${String(deadlineMonth).padStart(2, '0')}-15T23:59:59+09:00`;
  return new Date(deadlineStr);
}

function formatDateDili(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Dili',
  });
}

// ============================================
// VAT calculation
// ============================================

function calculateVATReturn(
  txs: TransactionRow[],
  period: VATReturnPeriod
): VATReturnData {
  // ---- Sales (type === 'in') ----
  const sales = txs.filter((t) => t.type === 'in');
  const purchases = txs.filter((t) => t.type === 'out');

  // Standard-rated sales
  const standardSales = sales.filter((t) => t.vatCategory === 'standard');
  const totalTaxableSales = standardSales.reduce((sum, t) => sum + t.netAmount, 0);
  const standardRateVATOnSales = standardSales.reduce((sum, t) => sum + t.vatAmount, 0);

  // Reduced-rate sales
  const reducedSales = sales.filter((t) => t.vatCategory === 'reduced');
  const reducedRateSales = reducedSales.reduce((sum, t) => sum + t.netAmount, 0);
  const reducedRateVAT = reducedSales.reduce((sum, t) => sum + t.vatAmount, 0);

  // Zero-rated sales (0% but claimable input VAT)
  const zeroRatedSales = sales
    .filter((t) => t.vatCategory === 'zero')
    .reduce((sum, t) => sum + t.netAmount, 0);

  // Exempt sales (no VAT, no input credit)
  const exemptSales = sales
    .filter((t) => t.vatCategory === 'exempt')
    .reduce((sum, t) => sum + t.amount, 0);

  // Total output VAT = standard + reduced rate VAT on sales
  const totalOutputVAT = standardRateVATOnSales + reducedRateVAT;

  // ---- Purchases (type === 'out') ----
  const taxablePurchases = purchases.filter(
    (t) => t.vatCategory === 'standard' || t.vatCategory === 'reduced'
  );
  const totalTaxablePurchases = taxablePurchases.reduce((sum, t) => sum + t.netAmount, 0);
  const vatOnPurchases = taxablePurchases.reduce((sum, t) => sum + t.vatAmount, 0);
  const totalInputVAT = vatOnPurchases;

  // ---- Net VAT ----
  const netVATPayable = totalOutputVAT - totalInputVAT;

  // ---- Summary ----
  const totalRevenue = sales.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = purchases.reduce((sum, t) => sum + t.amount, 0);

  // Determine the prevailing standard rate from transactions (or default to 10)
  const standardRate =
    standardSales.length > 0
      ? standardSales[0].vatRate
      : 10;

  // Filing deadline
  const deadline = getFilingDeadline(period);

  return {
    period,
    periodLabel: getPeriodLabel(period),
    periodLabelTL: getPeriodLabelTL(period),
    totalTaxableSales: round2(totalTaxableSales),
    standardRateVATOnSales: round2(standardRateVATOnSales),
    reducedRateSales: round2(reducedRateSales),
    zeroRatedSales: round2(zeroRatedSales),
    exemptSales: round2(exemptSales),
    totalOutputVAT: round2(totalOutputVAT),
    totalTaxablePurchases: round2(totalTaxablePurchases),
    vatOnPurchases: round2(vatOnPurchases),
    totalInputVAT: round2(totalInputVAT),
    netVATPayable: round2(netVATPayable),
    totalTransactions: txs.length,
    totalRevenue: round2(totalRevenue),
    totalExpenses: round2(totalExpenses),
    standardRate,
    filingDeadline: formatDateDili(deadline),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================
// Report formatting
// ============================================

function formatVATReturn(data: VATReturnData, info: BusinessInfo): string {
  const $ = (n: number) => n.toFixed(2);
  const pad = (label: string, val: string, width = 37) => {
    const space = Math.max(1, width - label.length - val.length);
    return label + ' '.repeat(space) + val;
  };

  const frequency = data.period.type === 'monthly' ? 'Monthly / Mensal' : 'Quarterly / Trimestral';
  const netLabel =
    data.netVATPayable >= 0
      ? 'NET VAT PAYABLE:'
      : 'NET VAT REFUNDABLE:';

  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('\u2550'.repeat(39));
  lines.push('   REPUBLICA DEMOCRATICA DE TIMOR-LESTE');
  lines.push('   DIRESAUN GERAL FINANSAS E IMPOSTU');
  lines.push('   DEKLARASAUN VAT / VAT RETURN');
  lines.push('\u2550'.repeat(39));

  // Business information
  lines.push('');
  lines.push('INFORMASAUN NEGOSIU / BUSINESS INFORMATION');
  lines.push('\u2500'.repeat(39));
  lines.push(`Business Name:    ${info.name}`);
  lines.push(`VAT Reg. No:      ${info.vatRegNumber}`);
  lines.push(`Address:          ${info.address}`);
  lines.push(`Phone:            ${info.phone}`);
  lines.push(`Filing Period:    ${data.periodLabel}`);
  lines.push(`                  ${data.periodLabelTL}`);
  lines.push(`Filing Frequency: ${frequency}`);

  // Box 1: Output VAT
  lines.push('');
  lines.push('BOX 1: OUTPUT VAT (VAT iha Vendas)');
  lines.push('\u2500'.repeat(39));
  lines.push(pad('1a. Total Taxable Sales (net):', `$${$(data.totalTaxableSales)}`));
  lines.push(pad(`1b. Standard Rate VAT (${data.standardRate}%):`, `$${$(data.standardRateVATOnSales)}`));
  lines.push(pad('1c. Reduced Rate Sales:', `$${$(data.reducedRateSales)}`));
  lines.push(pad('1d. Zero-Rated Sales:', `$${$(data.zeroRatedSales)}`));
  lines.push(pad('1e. Exempt Sales:', `$${$(data.exemptSales)}`));
  lines.push(pad('1f. TOTAL OUTPUT VAT:', `$${$(data.totalOutputVAT)}`));

  // Box 2: Input VAT
  lines.push('');
  lines.push('BOX 2: INPUT VAT (VAT iha Kompras)');
  lines.push('\u2500'.repeat(39));
  lines.push(pad('2a. Total Taxable Purchases (net):', `$${$(data.totalTaxablePurchases)}`));
  lines.push(pad('2b. VAT on Purchases:', `$${$(data.vatOnPurchases)}`));
  lines.push(pad('2c. TOTAL INPUT VAT:', `$${$(data.totalInputVAT)}`));

  // Box 3: Net VAT
  lines.push('');
  lines.push('BOX 3: NET VAT (VAT atu Selu)');
  lines.push('\u2500'.repeat(39));
  lines.push(pad('3a. Output VAT (Box 1f):', `$${$(data.totalOutputVAT)}`));
  lines.push(pad('3b. Less Input VAT (Box 2c):', `$${$(data.totalInputVAT)}`));
  lines.push(pad(`3c. ${netLabel}`, `$${$(Math.abs(data.netVATPayable))}`));
  if (data.netVATPayable < 0) {
    lines.push('    [REFUND / REEMBOLSU]');
  }

  // Box 4: Summary
  lines.push('');
  lines.push('BOX 4: SUMMARY');
  lines.push('\u2500'.repeat(39));
  lines.push(pad('Total Transactions:', `${data.totalTransactions}`));
  lines.push(pad('Total Revenue:', `$${$(data.totalRevenue)}`));
  lines.push(pad('Total Expenses:', `$${$(data.totalExpenses)}`));

  // Deadline
  lines.push('');
  lines.push(`DEADLINE: ${data.filingDeadline}`);
  lines.push('\u2500'.repeat(39));

  // Footer
  const todayStr = formatDateDili(new Date());
  lines.push(`Prepared by: Kaixa Business System`);
  lines.push(`Date: ${todayStr}`);
  lines.push('');

  return lines.join('\n');
}

// ============================================
// Public API
// ============================================

/**
 * Generate a VAT return for a given tenant and period.
 *
 * @param tenantId - Firestore tenant ID
 * @param businessInfo - Business name, VAT reg number, address, phone
 * @param period - Monthly or quarterly period specification
 * @returns Formatted text report and structured data
 *
 * @example
 * ```ts
 * // Monthly return for January 2027
 * const { text, data } = await generateVATReturn(
 *   'tenant-123',
 *   { name: 'Loja Bonita', vatRegNumber: 'TL-VAT-0001', address: 'Dili', phone: '+670 7777 0001' },
 *   { type: 'monthly', year: 2027, month: 1 }
 * );
 *
 * // Quarterly return for Q1 2027
 * const { text, data } = await generateVATReturn(
 *   'tenant-123',
 *   { name: 'Loja Bonita', vatRegNumber: 'TL-VAT-0001', address: 'Dili', phone: '+670 7777 0001' },
 *   { type: 'quarterly', year: 2027, quarter: 1 }
 * );
 * ```
 */
export async function generateVATReturn(
  tenantId: string,
  businessInfo: BusinessInfo,
  period: VATReturnPeriod
): Promise<{ text: string; data: VATReturnData }> {
  // Validate period
  if (period.type === 'monthly' && (period.month == null || period.month < 1 || period.month > 12)) {
    throw new Error('Monthly period requires month (1-12)');
  }
  if (period.type === 'quarterly' && (period.quarter == null || period.quarter < 1 || period.quarter > 4)) {
    throw new Error('Quarterly period requires quarter (1-4)');
  }

  // Fetch transactions
  const txs = await fetchPeriodTransactions(tenantId, period);

  // Calculate
  const data = calculateVATReturn(txs, period);

  // Format
  const text = formatVATReturn(data, businessInfo);

  return { text, data };
}
