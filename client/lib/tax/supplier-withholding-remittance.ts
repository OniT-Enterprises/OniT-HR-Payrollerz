/**
 * Controls for paying supplier withholding tax already credited to account 2320.
 * Filing and payment are deliberately separate events: only an evidence-backed
 * remittance reduces the outstanding amount here.
 */

import {
  addMoney,
  compareMoney,
  roundMoney,
  subtractMoney,
  sumMoney,
} from '@/lib/currency';
import { getMonthlyWITDueDate } from './compliance';
import type { TLBillWithholdingTotals } from './bill-withholding';

export type SupplierWithholdingPaymentMethod = 'bank_transfer' | 'cash_at_bnu';

export interface SupplierWithholdingRemittance {
  id: string;
  period: string;
  paymentDate: string;
  amount: number;
  method: SupplierWithholdingPaymentMethod;
  paymentReference: string;
  proofUrl: string;
  notes?: string;
  journalEntryId: string;
  createdBy: string;
  createdAt: Date;
}

export interface SupplierWithholdingPeriodPosition {
  period: string;
  liability: number;
  remitted: number;
  outstanding: number;
  status: 'not_due' | 'unpaid' | 'partial' | 'paid';
}

export interface SupplierWithholdingRemittanceInput {
  period: string;
  paymentDate: string;
  amount: number;
  method: SupplierWithholdingPaymentMethod;
  paymentReference: string;
  proofUrl: string;
  notes?: string;
}

function parseISODate(value: string, field: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${field} must use YYYY-MM-DD format.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error(`${field} is not a valid calendar date.`);
  }
}

export function assertSupplierWithholdingPeriod(period: string): void {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) {
    throw new Error('Supplier withholding period must use YYYY-MM format.');
  }
}

export function totalSupplierWithholdingLiability(
  totals: TLBillWithholdingTotals,
): number {
  return sumMoney(Object.values(totals).map((line) => line.tax));
}

export function calculateSupplierWithholdingPosition(
  period: string,
  liabilityInput: number,
  remittances: ReadonlyArray<Pick<SupplierWithholdingRemittance, 'period' | 'amount'>>,
): SupplierWithholdingPeriodPosition {
  assertSupplierWithholdingPeriod(period);
  const liability = roundMoney(liabilityInput);
  if (!Number.isFinite(liabilityInput) || liability < 0) {
    throw new Error('Supplier withholding liability must be a non-negative amount.');
  }

  const remitted = sumMoney(remittances.map((remittance) => {
    if (remittance.period !== period) {
      throw new Error('A supplier withholding payment belongs to a different period.');
    }
    const amount = roundMoney(remittance.amount);
    if (!Number.isFinite(remittance.amount) || amount <= 0) {
      throw new Error('A supplier withholding payment contains an invalid amount.');
    }
    return amount;
  }));
  if (compareMoney(remitted, liability) > 0) {
    throw new Error('Supplier withholding payments exceed the liability for this period.');
  }
  const outstanding = subtractMoney(liability, remitted);

  return {
    period,
    liability,
    remitted,
    outstanding,
    status: liability === 0
      ? 'not_due'
      : outstanding === 0
        ? 'paid'
        : remitted === 0
          ? 'unpaid'
          : 'partial',
  };
}

export function validateSupplierWithholdingRemittance(
  input: SupplierWithholdingRemittanceInput,
  outstandingInput: number,
): SupplierWithholdingRemittanceInput {
  assertSupplierWithholdingPeriod(input.period);
  parseISODate(input.paymentDate, 'Payment date');
  const amount = roundMoney(input.amount);
  const outstanding = roundMoney(outstandingInput);
  if (!Number.isFinite(input.amount) || amount <= 0) {
    throw new Error('Payment amount must be at least $0.01.');
  }
  if (!Number.isFinite(outstandingInput) || outstanding < 0) {
    throw new Error('Outstanding supplier withholding is invalid.');
  }
  if (compareMoney(amount, outstanding) > 0) {
    throw new Error('Payment exceeds the outstanding supplier withholding for this period.');
  }
  if (!['bank_transfer', 'cash_at_bnu'].includes(input.method)) {
    throw new Error('Select how the supplier withholding tax was paid.');
  }
  const paymentReference = input.paymentReference.trim();
  const proofUrl = input.proofUrl.trim();
  if (!paymentReference) {
    throw new Error('Bank or BNU receipt reference is required.');
  }
  if (!proofUrl) {
    throw new Error('Upload the bank confirmation or BNU receipt before recording payment.');
  }

  const notes = input.notes?.trim();
  return {
    period: input.period,
    paymentDate: input.paymentDate,
    amount,
    method: input.method,
    paymentReference,
    proofUrl,
    ...(notes ? { notes } : {}),
  };
}

export function addSupplierWithholdingLiability(current: number, addition: number): number {
  const next = addMoney(current, addition);
  if (compareMoney(next, 0) < 0) {
    throw new Error('Supplier withholding period liability cannot be negative.');
  }
  return next;
}

/**
 * Withheld supplier tax follows the same monthly remittance cadence as WIT:
 * day 15 of the month after the withholding period (Law 8/2008), shifted to
 * the next Timor-Leste business day unless a custom adjuster is supplied.
 */
export function getSupplierWithholdingRemittanceDueDate(
  period: string,
  adjustDate?: (isoDate: string) => string,
): string {
  assertSupplierWithholdingPeriod(period);
  return adjustDate ? getMonthlyWITDueDate(period, adjustDate) : getMonthlyWITDueDate(period);
}

/**
 * Law 8/2008 Sec. 32.2: while withheld tax stays unremitted, the payer's
 * deduction for the underlying expense is suspended. True when the period
 * still has an outstanding balance after the remittance due date.
 */
export function isSupplierWithholdingRemittanceOverdue(
  position: Pick<SupplierWithholdingPeriodPosition, 'period' | 'outstanding'>,
  todayIso: string,
  adjustDate?: (isoDate: string) => string,
): boolean {
  parseISODate(todayIso, 'Current date');
  const outstanding = roundMoney(position.outstanding);
  if (!Number.isFinite(position.outstanding) || outstanding <= 0) {
    return false;
  }
  return todayIso > getSupplierWithholdingRemittanceDueDate(position.period, adjustDate);
}
