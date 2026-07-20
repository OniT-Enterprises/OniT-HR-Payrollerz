/**
 * Juros de mora on late INSS contribution payment — DL 20/2017 Art. 39:
 * 1% of the amount owed per month OR FRACTION of a month of delay.
 *
 * Pure, Firebase-free module (unit-tested; CI has no VITE_FIREBASE_* env).
 * This is an ESTIMATE surfaced as a warning — never a ledger entry; INSS
 * assesses the definitive figure.
 */

import { applyRate, multiplyMoney } from '@/lib/currency';

export const INSS_LATE_INTEREST_RATE_PER_MONTH = 0.01;
export const INSS_LATE_INTEREST_LEGAL_BASIS = 'DL 20/2017 Art. 39';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseUTC(iso: string): Date {
  if (!ISO_DATE_RE.test(iso)) {
    throw new RangeError('Dates must use YYYY-MM-DD format.');
  }
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addMonthsUTC(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(targetDay, lastDay));
  return result;
}

/**
 * "Month or fraction" count of delay: the smallest n ≥ 1 such that
 * dueDate + n months ≥ asOf. Returns 0 when not past due.
 * (1 day late already accrues one full month of interest.)
 */
export function monthsOrFractionLate(dueDateISO: string, asOfISO: string): number {
  const due = parseUTC(dueDateISO);
  const asOf = parseUTC(asOfISO);
  if (asOf.getTime() <= due.getTime()) return 0;
  let months = 1;
  while (addMonthsUTC(due, months).getTime() < asOf.getTime()) {
    months += 1;
  }
  return months;
}

export interface InssLateInterestEstimate {
  monthsLate: number;
  ratePerMonth: number;
  /** Undefined when the contribution base is unknown. */
  estimatedInterest?: number;
  legalBasis: string;
}

/**
 * Estimate the Art. 39 arrears interest on a late INSS payment.
 * `baseAmount` is the total contribution payable (worker 4% + employer 6%);
 * pass undefined when unknown to get the months/rate note without an amount.
 */
export function calculateInssLateInterest(
  dueDateISO: string,
  asOfISO: string,
  baseAmount?: number,
): InssLateInterestEstimate | null {
  const monthsLate = monthsOrFractionLate(dueDateISO, asOfISO);
  if (monthsLate === 0) return null;

  const hasBase =
    typeof baseAmount === 'number' && Number.isFinite(baseAmount) && baseAmount > 0;

  return {
    monthsLate,
    ratePerMonth: INSS_LATE_INTEREST_RATE_PER_MONTH,
    estimatedInterest: hasBase
      ? multiplyMoney(applyRate(baseAmount, INSS_LATE_INTEREST_RATE_PER_MONTH), monthsLate)
      : undefined,
    legalBasis: INSS_LATE_INTEREST_LEGAL_BASIS,
  };
}
