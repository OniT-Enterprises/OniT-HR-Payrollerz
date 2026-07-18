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

/** Summary a payroll run hands to accounting to post its journal. */
export interface PayrollJournalSummary {
  totalGrossPay: number;
  totalINSSEmployer: number;
  totalIncomeTax: number;
  totalINSSEmployee: number;
  totalNetPay: number;
  totalAdvanceRepayments?: number;
  totalOtherDeductions?: number;
  allocations?: Array<{
    projectCode: string;
    fundingSource: string;
    grossPay: number;
    inssEmployer: number;
  }>;
}

/** Resolves a chart-of-accounts code to its stored id and name. */
export type AccountResolver = (code: string) => { id: string; name: string };

/**
 * The chart-of-accounts codes a payroll journal needs, given a summary.
 * The four payable accounts are always required (their lines drop out later if
 * the amount is zero); the two deduction control accounts only when used.
 */
export function payrollJournalAccountCodes(
  summary: PayrollJournalSummary,
): string[] {
  const codes = ['5110', '5150', '2210', '2220', '2230', '2240'];
  if ((summary.totalAdvanceRepayments || 0) > 0) codes.push('1220');
  if ((summary.totalOtherDeductions || 0) > 0) codes.push('2200');
  return codes;
}

/**
 * Build the balanced double-entry lines for a payroll run — pure and
 * synchronous so it can be verified without Firestore. Gross wages (5110) and
 * employer INSS (5150) are debited (optionally split by project allocation);
 * net pay (2210), WIT (2220), employee INSS (2230), employer INSS (2240), and
 * any advance (1220) / other (2200) deductions are credited. Zero-amount lines
 * are dropped and lines renumbered. The result always balances by
 * construction: debits (gross + employer INSS) equal credits (net + WIT +
 * employee INSS + employer INSS + advances + other).
 */
export function buildPayrollJournalLines(
  summary: PayrollJournalSummary,
  resolve: AccountResolver,
): { lines: JournalEntryLine[]; totalDebit: number; totalCredit: number } {
  const lines: JournalEntryLine[] = [];
  let lineNumber = 1;

  const salary = resolve('5110');
  const inssExpense = resolve('5150');

  const allocationRows = (summary.allocations ?? [])
    .map((row) => ({
      projectCode: row.projectCode?.trim() || 'Unassigned',
      fundingSource: row.fundingSource?.trim() || 'Unassigned',
      grossPay: addMoney(row.grossPay || 0),
      inssEmployer: addMoney(row.inssEmployer || 0),
    }))
    .filter((row) => row.grossPay > 0 || row.inssEmployer > 0);

  if (allocationRows.length > 0) {
    let allocatedGross = 0;
    let allocatedINSS = 0;
    for (const allocation of allocationRows) {
      if (allocation.grossPay > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountId: salary.id, accountCode: '5110', accountName: salary.name,
          debit: allocation.grossPay, credit: 0,
          description: `Gross salaries (${allocation.projectCode} | ${allocation.fundingSource})`,
          projectId: allocation.projectCode, departmentId: allocation.fundingSource,
        });
        allocatedGross = addMoney(allocatedGross, allocation.grossPay);
      }
      if (allocation.inssEmployer > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountId: inssExpense.id, accountCode: '5150', accountName: inssExpense.name,
          debit: allocation.inssEmployer, credit: 0,
          description: `INSS employer contribution (${allocation.projectCode} | ${allocation.fundingSource})`,
          projectId: allocation.projectCode, departmentId: allocation.fundingSource,
        });
        allocatedINSS = addMoney(allocatedINSS, allocation.inssEmployer);
      }
    }

    const grossRemainder = subtractMoney(summary.totalGrossPay, allocatedGross);
    if (grossRemainder < 0) {
      throw new Error('Payroll allocations exceed total wages expense');
    }
    if (grossRemainder > 0) {
      lines.push({
        lineNumber: lineNumber++,
        accountId: salary.id, accountCode: '5110', accountName: salary.name,
        debit: grossRemainder, credit: 0,
        description: 'Gross salaries (Unassigned)',
        projectId: 'Unassigned', departmentId: 'Unassigned',
      });
    }

    const inssRemainder = subtractMoney(summary.totalINSSEmployer, allocatedINSS);
    if (inssRemainder < 0) {
      throw new Error('Payroll allocations exceed total employer INSS expense');
    }
    if (inssRemainder > 0) {
      lines.push({
        lineNumber: lineNumber++,
        accountId: inssExpense.id, accountCode: '5150', accountName: inssExpense.name,
        debit: inssRemainder, credit: 0,
        description: 'INSS employer contribution (Unassigned)',
        projectId: 'Unassigned', departmentId: 'Unassigned',
      });
    }
  } else {
    lines.push({
      lineNumber: lineNumber++,
      accountId: salary.id, accountCode: '5110', accountName: salary.name,
      debit: summary.totalGrossPay, credit: 0, description: 'Gross salaries',
    });
    lines.push({
      lineNumber: lineNumber++,
      accountId: inssExpense.id, accountCode: '5150', accountName: inssExpense.name,
      debit: summary.totalINSSEmployer, credit: 0,
      description: 'INSS employer contribution (6%)',
    });
  }

  const salariesPayable = resolve('2210');
  lines.push({
    lineNumber: lineNumber++,
    accountId: salariesPayable.id, accountCode: '2210', accountName: salariesPayable.name,
    debit: 0, credit: summary.totalNetPay, description: 'Net salaries payable',
  });

  const witPayable = resolve('2220');
  lines.push({
    lineNumber: lineNumber++,
    accountId: witPayable.id, accountCode: '2220', accountName: witPayable.name,
    debit: 0, credit: summary.totalIncomeTax, description: 'Withholding Income Tax (WIT)',
  });

  const inssEmployeePayable = resolve('2230');
  lines.push({
    lineNumber: lineNumber++,
    accountId: inssEmployeePayable.id, accountCode: '2230', accountName: inssEmployeePayable.name,
    debit: 0, credit: summary.totalINSSEmployee, description: 'INSS employee contribution (4%)',
  });

  const inssEmployerPayable = resolve('2240');
  lines.push({
    lineNumber: lineNumber++,
    accountId: inssEmployerPayable.id, accountCode: '2240', accountName: inssEmployerPayable.name,
    debit: 0, credit: summary.totalINSSEmployer, description: 'INSS employer contribution (6%)',
  });

  if ((summary.totalAdvanceRepayments || 0) > 0) {
    const advances = resolve('1220');
    lines.push({
      lineNumber: lineNumber++,
      accountId: advances.id, accountCode: '1220', accountName: advances.name,
      debit: 0, credit: summary.totalAdvanceRepayments || 0,
      description: 'Employee loan and advance repayments',
    });
  }

  if ((summary.totalOtherDeductions || 0) > 0) {
    const other = resolve('2200');
    lines.push({
      lineNumber: lineNumber++,
      accountId: other.id, accountCode: '2200', accountName: other.name,
      debit: 0, credit: summary.totalOtherDeductions || 0,
      description: 'Other payroll deductions payable',
    });
  }

  // A run can legitimately owe no WIT (every resident under the $500/month
  // threshold) or no INSS (exempt payees); the validator rejects a line with
  // neither a debit nor a credit, so drop zero lines and renumber. Removing a
  // zero line cannot unbalance the entry.
  const journalLines = lines.filter(
    (line) => (line.debit || 0) > 0 || (line.credit || 0) > 0,
  );
  journalLines.forEach((line, index) => { line.lineNumber = index + 1; });

  return {
    lines: journalLines,
    totalDebit: sumMoney(journalLines.map((line) => line.debit)),
    totalCredit: sumMoney(journalLines.map((line) => line.credit)),
  };
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
