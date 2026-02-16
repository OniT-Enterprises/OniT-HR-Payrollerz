/**
 * Kaixa — Monthly Report Generator
 *
 * Generates a text-based monthly summary for sharing via WhatsApp
 * or native share sheet. Designed for small business owners who
 * need a simple "how was this month?" answer.
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

// ============================================
// Types
// ============================================

interface MonthlyReportData {
  month: string; // e.g. "February 2026"
  monthTL: string; // e.g. "Fevereiru 2026"
  totalIn: number;
  totalOut: number;
  profit: number;
  txCount: number;
  vatCollected: number;
  topCategories: { category: string; total: number }[];
  prevMonthProfit: number | null; // null if no data
}

// ============================================
// Tetum month names
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

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Vendas',
  service: 'Servisu',
  payment_received: 'Simu pagamentu',
  other_income: 'Seluk',
  stock: 'Estoke',
  rent: 'Alugel',
  supplies: 'Fornese',
  salary: 'Saláriu',
  transport: 'Transporte',
  food: 'Hahan',
  other_expense: 'Seluk',
};

// ============================================
// Data fetching
// ============================================

async function fetchMonthTransactions(
  tenantId: string,
  year: number,
  month: number
): Promise<
  {
    type: 'in' | 'out';
    amount: number;
    vatAmount: number;
    category: string;
  }[]
> {
  // Month boundaries in Dili timezone (TL+09:00)
  const startStr = `${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endStr = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00+09:00`;

  const start = new Date(startStr);
  const end = new Date(endStr);

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
      type: data.type as 'in' | 'out',
      amount: (data.amount as number) || 0,
      vatAmount: (data.vatAmount as number) || 0,
      category: (data.category as string) || 'other',
    };
  });
}

// ============================================
// Report generation
// ============================================

export async function generateMonthlyReport(
  tenantId: string,
  businessName: string,
  year?: number,
  month?: number
): Promise<{ text: string; data: MonthlyReportData }> {
  // Default to current month in Dili timezone
  const now = new Date();
  const diliDate = now.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Dili',
  });
  const [diliYear, diliMonth] = diliDate.split('-').map(Number);
  const reportYear = year ?? diliYear;
  const reportMonth = month ?? diliMonth;

  // Fetch current month
  const txs = await fetchMonthTransactions(tenantId, reportYear, reportMonth);

  const totalIn = txs
    .filter((t) => t.type === 'in')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOut = txs
    .filter((t) => t.type === 'out')
    .reduce((sum, t) => sum + t.amount, 0);
  const profit = totalIn - totalOut;
  const vatCollected = txs
    .filter((t) => t.type === 'in')
    .reduce((sum, t) => sum + t.vatAmount, 0);

  // Top income categories
  const catMap = new Map<string, number>();
  txs
    .filter((t) => t.type === 'in')
    .forEach((t) => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
    });
  const topCategories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, total]) => ({ category, total }));

  // Fetch previous month for comparison
  const prevMonth = reportMonth === 1 ? 12 : reportMonth - 1;
  const prevYear = reportMonth === 1 ? reportYear - 1 : reportYear;
  let prevMonthProfit: number | null = null;
  try {
    const prevTxs = await fetchMonthTransactions(tenantId, prevYear, prevMonth);
    if (prevTxs.length > 0) {
      const prevIn = prevTxs
        .filter((t) => t.type === 'in')
        .reduce((sum, t) => sum + t.amount, 0);
      const prevOut = prevTxs
        .filter((t) => t.type === 'out')
        .reduce((sum, t) => sum + t.amount, 0);
      prevMonthProfit = prevIn - prevOut;
    }
  } catch {
    // Skip comparison if previous month fails
  }

  // Format month names
  const enMonth = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString(
    'en-GB',
    { month: 'long', year: 'numeric' }
  );
  const tlMonth = `${TETUM_MONTHS[reportMonth - 1]} ${reportYear}`;

  const data: MonthlyReportData = {
    month: enMonth,
    monthTL: tlMonth,
    totalIn,
    totalOut,
    profit,
    txCount: txs.length,
    vatCollected,
    topCategories,
    prevMonthProfit,
  };

  // Build text report
  const text = formatReport(data, businessName);

  return { text, data };
}

function formatReport(data: MonthlyReportData, businessName: string): string {
  const lines: string[] = [];
  const divider = '────────────────────';

  // Header
  lines.push(`*RELATÓRIU MENSAL*`);
  lines.push(`*${businessName || 'Kaixa'}*`);
  lines.push(`${data.monthTL}`);
  lines.push(divider);

  // Summary
  lines.push('');
  lines.push(`Osan Tama (Income): *$${data.totalIn.toFixed(2)}*`);
  lines.push(`Osan Sai (Expenses): *$${data.totalOut.toFixed(2)}*`);
  lines.push(divider);
  lines.push(
    `*Lukru (Profit): $${data.profit.toFixed(2)}*${data.profit < 0 ? ' ⚠' : ''}`
  );

  // Comparison with previous month
  if (data.prevMonthProfit !== null) {
    const diff = data.profit - data.prevMonthProfit;
    const pct =
      data.prevMonthProfit !== 0
        ? Math.round((diff / Math.abs(data.prevMonthProfit)) * 100)
        : 0;
    const arrow = diff >= 0 ? '↑' : '↓';
    lines.push(
      `${arrow} ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct}%) vs fulan liu ba`
    );
  }

  lines.push('');
  lines.push(`Total transasaun: ${data.txCount}`);

  // Top categories
  if (data.topCategories.length > 0) {
    lines.push('');
    lines.push(divider);
    lines.push('*Kategoria Prinsipal:*');
    data.topCategories.forEach((cat, i) => {
      const label = CATEGORY_LABELS[cat.category] || cat.category;
      lines.push(`${i + 1}. ${label}: $${cat.total.toFixed(2)}`);
    });
  }

  // VAT
  if (data.vatCollected > 0) {
    lines.push('');
    lines.push(divider);
    lines.push(`VAT Koletadu: $${data.vatCollected.toFixed(2)}`);
  }

  // Footer
  lines.push('');
  lines.push(divider);
  lines.push('_Relatóriu jera husi Kaixa_');

  return lines.join('\n');
}
