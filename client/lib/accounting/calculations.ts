import type { JournalEntryLine } from '@/types/accounting';
import type { InvoiceItem, InvoiceStatus, BillStatus } from '@/types/money';
import { computeLineTotals, lineNetAmount } from '@/lib/invoiceTemplates';
import {
  addMoney,
  compareMoney,
  percentOf,
  roundMoney,
  subtractMoney,
  sumMoney,
} from '@/lib/currency';

export interface InvoiceCalculation {
  items: Array<Omit<InvoiceItem, 'id'> & { id?: string }>;
  subtotal: number;
  discountTotal: number;
  taxAmount: number;
  total: number;
}

/**
 * Single source of truth for invoice line and document totals.
 * Line amounts are net of per-line discounts. Tax is rounded per line with the
 * line's own vatRate (invoice default when unset), matching what appears on
 * the invoice and avoiding a preview/save mismatch on mixed-rate invoices.
 * The default rate is intentionally NOT stamped onto lines, so changing the
 * invoice-level rate later still applies to lines without an explicit rate.
 */
export function calculateInvoiceAmounts(
  items: Array<Omit<InvoiceItem, 'id'> & { id?: string }>,
  defaultTaxRate: number,
): InvoiceCalculation {
  const calculatedItems = items.map((item) => {
    const amount = lineNetAmount(item);
    const taxRate = Number.isFinite(item.vatRate as number)
      ? (item.vatRate as number)
      : defaultTaxRate;
    const vatAmount = percentOf(amount, taxRate);

    return {
      ...item,
      amount,
      vatAmount,
      netAmount: amount,
      grossAmount: addMoney(amount, vatAmount),
    };
  });

  const { subtotal, discountTotal } = computeLineTotals(calculatedItems);
  const taxAmount = sumMoney(calculatedItems.map((item) => item.vatAmount ?? 0));

  return {
    items: calculatedItems,
    subtotal,
    discountTotal,
    taxAmount,
    total: addMoney(subtotal, taxAmount),
  };
}

export function calculateTaxedTotal(amount: number, taxRate: number) {
  const netAmount = roundMoney(amount);
  const taxAmount = percentOf(netAmount, taxRate);
  return {
    netAmount,
    taxAmount,
    total: addMoney(netAmount, taxAmount),
  };
}

export function calculateInvoicePaymentState(
  total: number,
  amountPaid: number,
  requestedAmount: number,
): { amount: number; amountPaid: number; balanceDue: number; status: Extract<InvoiceStatus, 'paid' | 'partial'> } {
  const amount = validatePaymentAmount(requestedAmount, subtractMoney(total, amountPaid));
  const nextAmountPaid = addMoney(amountPaid, amount);
  const balanceDue = subtractMoney(total, nextAmountPaid);

  return {
    amount,
    amountPaid: nextAmountPaid,
    balanceDue,
    status: balanceDue === 0 ? 'paid' : 'partial',
  };
}

export function calculateBillPaymentState(
  total: number,
  amountPaid: number,
  requestedAmount: number,
): { amount: number; amountPaid: number; balanceDue: number; status: Extract<BillStatus, 'paid' | 'partial'> } {
  const amount = validatePaymentAmount(requestedAmount, subtractMoney(total, amountPaid));
  const nextAmountPaid = addMoney(amountPaid, amount);
  const balanceDue = subtractMoney(total, nextAmountPaid);

  return {
    amount,
    amountPaid: nextAmountPaid,
    balanceDue,
    status: balanceDue === 0 ? 'paid' : 'partial',
  };
}

/** Validate the three-way settlement used by supplier-withholding postings. */
export function calculateBillPaymentPostingAmounts(
  grossAmountInput: number,
  cashPaidInput?: number,
  withholdingTaxInput?: number,
): { grossAmount: number; cashPaid: number; withholdingTax: number } {
  const grossAmount = roundMoney(grossAmountInput);
  const cashPaid = roundMoney(cashPaidInput ?? grossAmount);
  const withholdingTax = roundMoney(withholdingTaxInput ?? 0);
  if (grossAmount <= 0 || cashPaid < 0 || withholdingTax < 0) {
    throw new Error('Bill settlement amounts must be non-negative and gross AP cleared must be positive.');
  }
  if (compareMoney(addMoney(cashPaid, withholdingTax), grossAmount) !== 0) {
    throw new Error('Bill settlement must balance gross AP cleared to cash plus withholding tax.');
  }
  return { grossAmount, cashPaid, withholdingTax };
}

function validatePaymentAmount(requestedAmount: number, balanceDue: number): number {
  if (!Number.isFinite(requestedAmount)) {
    throw new Error('Payment amount must be a finite number');
  }

  const amount = roundMoney(requestedAmount);
  if (amount <= 0) {
    throw new Error('Payment amount must be at least $0.01');
  }
  if (compareMoney(amount, roundMoney(balanceDue)) > 0) {
    throw new Error('Payment exceeds remaining balance');
  }

  return amount;
}

/** Normalize and validate a journal entry at currency precision. */
export function normalizeJournalAmounts(
  lines: JournalEntryLine[],
  statedDebit: number,
  statedCredit: number,
): { lines: JournalEntryLine[]; totalDebit: number; totalCredit: number } {
  if (lines.length === 0) {
    throw new Error('Journal entry must include at least one line');
  }

  const normalizedLines = lines.map((line) => {
    if (!Number.isFinite(line.debit) || !Number.isFinite(line.credit)) {
      throw new Error('Journal entry line amounts must be finite numbers');
    }

    const debit = roundMoney(line.debit);
    const credit = roundMoney(line.credit);
    if (debit < 0 || credit < 0) {
      throw new Error('Journal entry line amounts cannot be negative');
    }
    if ((debit > 0) === (credit > 0)) {
      throw new Error('Each journal entry line must contain either a debit or a credit amount');
    }

    return { ...line, debit, credit };
  });

  const totalDebit = sumMoney(normalizedLines.map((line) => line.debit));
  const totalCredit = sumMoney(normalizedLines.map((line) => line.credit));

  if (compareMoney(totalDebit, roundMoney(statedDebit)) !== 0
    || compareMoney(totalCredit, roundMoney(statedCredit)) !== 0) {
    throw new Error('Journal entry totals do not match line amounts');
  }
  if (compareMoney(totalDebit, totalCredit) !== 0) {
    throw new Error('Journal entry must balance: debits must equal credits');
  }

  return { lines: normalizedLines, totalDebit, totalCredit };
}

/** Accumulate a signed account balance without floating-point drift. */
export function addToMoneyMap(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, addMoney(map.get(key) ?? 0, amount));
}

/**
 * Account code is the canonical fallback for legacy GL rows whose accountId
 * was stored as the code. The code map contains both legacy and current rows.
 */
export function getAccountNet(
  byId: Map<string, number>,
  byCode: Map<string, number>,
  accountId: string,
  accountCode: string,
): number {
  return byCode.get(accountCode) ?? byId.get(accountId) ?? 0;
}

/** Whole calendar days past due, independent of browser timezone/DST. */
export function getDaysPastDue(dueDate: string, asOfDate: string): number {
  const parseUtc = (value: string): number => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error(`Invalid ISO date: ${value}`);
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };

  return Math.floor((parseUtc(asOfDate) - parseUtc(dueDate)) / 86_400_000);
}

/**
 * Lenient variant for report rows: legacy documents may hold non-ISO due
 * dates, and one bad row must not take down a whole aging report. Falls back
 * to Date parsing and treats unparseable values as not yet due.
 */
export function getDaysPastDueLenient(dueDate: unknown, asOfDate: string): number {
  if (typeof dueDate === 'string') {
    const isoPrefix = /^(\d{4}-\d{2}-\d{2})/.exec(dueDate);
    if (isoPrefix) return getDaysPastDue(isoPrefix[1], asOfDate);
  }

  const parsed = dueDate instanceof Date ? dueDate : new Date(String(dueDate ?? ''));
  if (Number.isNaN(parsed.getTime())) return 0;

  const iso = [
    String(parsed.getFullYear()).padStart(4, '0'),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
  return getDaysPastDue(iso, asOfDate);
}

export function getFiscalDateParts(date: string): { year: number; period: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid accounting date: ${date}`);
  const year = Number(match[1]);
  const period = Number(match[2]);
  if (period < 1 || period > 12) throw new Error(`Invalid accounting date: ${date}`);
  return { year, period };
}

/** Parse common US and European bank-statement amount formats. */
export function parseBankAmount(value: string): number {
  let cleaned = value
    .trim()
    .replace(/[\s'"$€]/g, '')
    .replace(/^\((.*)\)$/, '-$1');

  const comma = cleaned.lastIndexOf(',');
  const dot = cleaned.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    cleaned = comma > dot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (comma >= 0) {
    const decimalDigits = cleaned.length - comma - 1;
    cleaned = decimalDigits > 0 && decimalDigits <= 2
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (dot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Dot-only European thousands grouping ("1.234" = 1234); bank amounts
    // never carry 3-decimal precision, so grouped dots are separators.
    cleaned = cleaned.replace(/\./g, '');
  }

  const amount = Number(cleaned);
  return Number.isFinite(amount) ? roundMoney(amount) : 0;
}
