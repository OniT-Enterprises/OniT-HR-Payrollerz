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

export function calculateInvoiceSettlementState(
  totalInput: number,
  amountPaidInput: number,
  creditedAmountInput: number,
  fallbackStatus: Extract<InvoiceStatus, 'sent' | 'viewed' | 'overdue'> = 'sent',
): {
  amountPaid: number;
  creditedAmount: number;
  balanceDue: number;
  status: Extract<InvoiceStatus, 'sent' | 'viewed' | 'overdue' | 'paid' | 'partial' | 'credited'>;
} {
  const total = roundMoney(totalInput);
  const amountPaid = roundMoney(amountPaidInput);
  const creditedAmount = roundMoney(creditedAmountInput);
  const balanceDue = subtractMoney(total, amountPaid, creditedAmount);

  if (total < 0 || amountPaid < 0 || creditedAmount < 0 || balanceDue < 0) {
    throw new Error('Invoice settlement amounts are inconsistent');
  }
  if (balanceDue === 0) {
    return {
      amountPaid,
      creditedAmount,
      balanceDue,
      status: amountPaid > 0 ? 'paid' : 'credited',
    };
  }
  return {
    amountPaid,
    creditedAmount,
    balanceDue,
    status: amountPaid > 0 || creditedAmount > 0 ? 'partial' : fallbackStatus,
  };
}

export function calculateInvoiceRefundState(
  total: number,
  amountPaid: number,
  creditedAmount: number,
  requestedAmount: number,
  fallbackStatus: Extract<InvoiceStatus, 'sent' | 'viewed' | 'overdue'> = 'sent',
) {
  const amount = validatePositiveMoney(requestedAmount, amountPaid, 'Refund');
  return {
    amount,
    ...calculateInvoiceSettlementState(
      total,
      subtractMoney(amountPaid, amount),
      creditedAmount,
      fallbackStatus,
    ),
  };
}

export function calculateInvoiceCreditState(
  total: number,
  amountPaid: number,
  creditedAmount: number,
  requestedAmount: number,
  fallbackStatus: Extract<InvoiceStatus, 'sent' | 'viewed' | 'overdue'> = 'sent',
) {
  const outstanding = subtractMoney(total, amountPaid, creditedAmount);
  const amount = validatePositiveMoney(requestedAmount, outstanding, 'Credit note');
  return {
    amount,
    ...calculateInvoiceSettlementState(
      total,
      amountPaid,
      addMoney(creditedAmount, amount),
      fallbackStatus,
    ),
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

function validatePositiveMoney(
  requestedAmount: number,
  availableAmount: number,
  label: string,
): number {
  if (!Number.isFinite(requestedAmount)) {
    throw new Error(`${label} amount must be a finite number`);
  }
  const amount = roundMoney(requestedAmount);
  if (amount <= 0) throw new Error(`${label} amount must be at least $0.01`);
  if (compareMoney(amount, roundMoney(availableAmount)) > 0) {
    throw new Error(`${label} exceeds the available amount`);
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
  if ((summary.totalOtherDeductions || 0) > 0) codes.push('2260');
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
    // Leaf account 2260 'Other Payroll Deductions Payable', not the 2200
    // 'Payroll Liabilities' parent header — postings belong on leaf accounts
    // so a remittance reconciliation against 2260 sees the real balance.
    const other = resolve('2260');
    lines.push({
      lineNumber: lineNumber++,
      accountId: other.id, accountCode: '2260', accountName: other.name,
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

export interface LiabilityPaymentLine {
  accountCode: string;
  amount: number;
  description: string;
}

/**
 * Build the payment side of an already-accrued liability. This is shared by
 * salary disbursements and statutory remittances so those workflows cannot
 * mark something paid while leaving cash and the payable unchanged.
 */
export function buildLiabilityPaymentJournalLines(
  liabilities: LiabilityPaymentLine[],
  paymentAccountCode: string,
  paymentDescription: string,
  resolve: AccountResolver,
): { lines: JournalEntryLine[]; totalDebit: number; totalCredit: number } {
  const normalized = liabilities
    .map((line) => ({ ...line, amount: roundMoney(line.amount) }))
    .filter((line) => line.amount > 0);

  if (normalized.length === 0) {
    throw new Error('A liability payment must clear at least $0.01.');
  }

  const total = sumMoney(normalized.map((line) => line.amount));
  const lines: JournalEntryLine[] = normalized.map((line, index) => {
    const account = resolve(line.accountCode);
    return {
      lineNumber: index + 1,
      accountId: account.id,
      accountCode: line.accountCode,
      accountName: account.name,
      debit: line.amount,
      credit: 0,
      description: line.description,
    };
  });

  const paymentAccount = resolve(paymentAccountCode);
  lines.push({
    lineNumber: lines.length + 1,
    accountId: paymentAccount.id,
    accountCode: paymentAccountCode,
    accountName: paymentAccount.name,
    debit: 0,
    credit: total,
    description: paymentDescription,
  });

  return { lines, totalDebit: total, totalCredit: total };
}

/** Dr 2210 Net Salaries Payable / Cr cash or bank. */
export function buildPayrollSettlementJournalLines(
  netPay: number,
  paymentAccountCode: string,
  reference: string,
  resolve: AccountResolver,
) {
  const cleanReference = reference.trim();
  if (!cleanReference) throw new Error('A payroll payment reference is required.');
  return buildLiabilityPaymentJournalLines(
    [{
      accountCode: '2210',
      amount: netPay,
      description: `Clear net salaries payable - ${cleanReference}`,
    }],
    paymentAccountCode,
    `Salary payment - ${cleanReference}`,
    resolve,
  );
}

/** Dr the fixed-asset account / Cr the selected funding or payable account. */
export function buildFixedAssetAcquisitionJournalLines(
  acquisitionCost: number,
  assetAccountCode: string,
  fundingAccountCode: string,
  assetName: string,
  resolve: AccountResolver,
): { lines: JournalEntryLine[]; totalDebit: number; totalCredit: number } {
  const amount = roundMoney(acquisitionCost);
  const name = assetName.trim();
  if (amount <= 0) throw new Error('Fixed-asset acquisition cost must be positive.');
  if (!name) throw new Error('Fixed-asset name is required.');
  if (!assetAccountCode || !fundingAccountCode) {
    throw new Error('Asset and funding accounts are required.');
  }
  if (assetAccountCode === fundingAccountCode) {
    throw new Error('Funding account must differ from the fixed-asset account.');
  }

  const asset = resolve(assetAccountCode);
  const funding = resolve(fundingAccountCode);
  const lines: JournalEntryLine[] = [
    {
      lineNumber: 1,
      accountId: asset.id,
      accountCode: assetAccountCode,
      accountName: asset.name,
      debit: amount,
      credit: 0,
      description: `Acquire fixed asset - ${name}`,
    },
    {
      lineNumber: 2,
      accountId: funding.id,
      accountCode: fundingAccountCode,
      accountName: funding.name,
      debit: 0,
      credit: amount,
      description: `Fund fixed asset - ${name}`,
    },
  ];
  return { lines, totalDebit: amount, totalCredit: amount };
}

/** Minimal invoice shape the journal builder needs. */
export interface InvoiceJournalInput {
  id?: string;
  invoiceNumber: string;
  customerName?: string;
  total: number;
  taxAmount?: number;
}

/**
 * Build the balanced journal for a sent invoice — pure and Firestore-free.
 * Debit trade receivables for the full total; credit revenue for the net and
 * VAT payable for the tax portion. Balances by construction: revenue + tax
 * always sum to the invoice total. Codes mirror MONEY_JOURNAL_MAPPINGS so the
 * service stays the single source of account codes.
 */
export function buildInvoiceJournalLines(
  invoice: InvoiceJournalInput,
  resolve: AccountResolver,
  codes: { receivable: string; revenue: string; tax: string },
): { lines: JournalEntryLine[]; totalDebit: number; totalCredit: number } {
  const taxAmount = roundMoney(invoice.taxAmount || 0);
  const revenueAmount = subtractMoney(invoice.total, taxAmount);
  const ar = resolve(codes.receivable);
  const revenue = resolve(codes.revenue);

  const lines: JournalEntryLine[] = [
    {
      lineNumber: 1,
      accountId: ar.id, accountCode: codes.receivable, accountName: ar.name,
      debit: invoice.total, credit: 0,
      description: `AR - ${invoice.invoiceNumber}`,
    },
    {
      lineNumber: 2,
      accountId: revenue.id, accountCode: codes.revenue, accountName: revenue.name,
      debit: 0, credit: revenueAmount,
      description: `Revenue - ${invoice.invoiceNumber}`,
    },
  ];

  if (taxAmount > 0) {
    const tax = resolve(codes.tax);
    lines.push({
      lineNumber: 3,
      accountId: tax.id, accountCode: codes.tax, accountName: tax.name,
      debit: 0, credit: taxAmount,
      description: `Sales tax payable - ${invoice.invoiceNumber}`,
    });
  }

  return {
    lines,
    totalDebit: sumMoney(lines.map((l) => l.debit)),
    totalCredit: sumMoney(lines.map((l) => l.credit)),
  };
}

/** Minimal bill-payment shape the journal builder needs. */
export interface BillPaymentJournalInput {
  amount: number;
  cashPaid?: number;
  withholdingTax?: number;
  method: string;
  vendorName: string;
  billNumber?: string;
  billId: string;
}

/**
 * Build the balanced journal for a bill payment — pure and Firestore-free.
 * Clears trade payables for the gross, and splits the settlement into cash paid
 * to the supplier plus supplier withholding tax owed to the state. The split is
 * balanced by calculateBillPaymentPostingAmounts (gross = cash + withheld), so
 * the entry always balances: AP debit == cash credit + withholding credit.
 * Cash goes to on-hand (1110) for cash method, bank (1120) otherwise.
 */
export function buildBillPaymentJournalLines(
  payment: BillPaymentJournalInput,
  resolve: AccountResolver,
  codes: { payable: string; cashOnHand: string; bank: string; withholding: string },
): { lines: JournalEntryLine[]; totalDebit: number; totalCredit: number } {
  const { grossAmount, cashPaid, withholdingTax } = calculateBillPaymentPostingAmounts(
    payment.amount,
    payment.cashPaid,
    payment.withholdingTax,
  );
  const cashCode = payment.method === 'cash' ? codes.cashOnHand : codes.bank;
  const refLabel = payment.billNumber || `Bill-${payment.billId.slice(0, 8)}`;
  const ap = resolve(codes.payable);

  const lines: JournalEntryLine[] = [
    {
      lineNumber: 1,
      accountId: ap.id, accountCode: codes.payable, accountName: ap.name,
      debit: grossAmount, credit: 0,
      description: `Clear AP - ${refLabel}`,
    },
  ];
  if (cashPaid > 0) {
    const cash = resolve(cashCode);
    lines.push({
      lineNumber: lines.length + 1,
      accountId: cash.id, accountCode: cashCode, accountName: cash.name,
      debit: 0, credit: cashPaid,
      description: `Payment to ${payment.vendorName}`,
    });
  }
  if (withholdingTax > 0) {
    const wht = resolve(codes.withholding);
    lines.push({
      lineNumber: lines.length + 1,
      accountId: wht.id, accountCode: codes.withholding, accountName: wht.name,
      debit: 0, credit: withholdingTax,
      description: `Supplier withholding tax - ${refLabel}`,
    });
  }

  return {
    lines,
    totalDebit: grossAmount,
    totalCredit: sumMoney(lines.map((l) => l.credit)),
  };
}

/** Account fields the financial-report derivations read. */
export interface ReportAccount {
  id?: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  isActive?: boolean;
}

interface StatementRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'revenue' | 'expense';
  amount: number;
  level: number;
  isTotal: boolean;
}

/**
 * Derive an income statement from account net balances (debit − credit) — the
 * pure core of the report, so it can be verified without Firestore. Revenue is
 * credit-normal (its net is negative) and shown as a positive amount; expenses
 * are debit-normal. Net income = total revenue − total expenses.
 */
export function deriveIncomeStatement(
  accounts: ReportAccount[],
  netOf: (account: ReportAccount) => number,
): {
  revenueItems: StatementRow[];
  totalRevenue: number;
  expenseItems: StatementRow[];
  totalExpenses: number;
  netIncome: number;
} {
  const revenueItems: StatementRow[] = [];
  const expenseItems: StatementRow[] = [];

  for (const account of accounts) {
    if (account.isActive === false) continue;
    if (account.type !== 'revenue' && account.type !== 'expense') continue;
    const net = netOf(account);
    if (Math.abs(net) < 0.01) continue;
    const amount = account.type === 'revenue' ? roundMoney(-net) : net;
    const row: StatementRow = {
      accountId: account.id ?? '',
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      amount,
      level: 0,
      isTotal: false,
    };
    (account.type === 'revenue' ? revenueItems : expenseItems).push(row);
  }

  revenueItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  expenseItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  const totalRevenue = sumMoney(revenueItems.map((r) => r.amount));
  const totalExpenses = sumMoney(expenseItems.map((r) => r.amount));

  return {
    revenueItems,
    totalRevenue,
    expenseItems,
    totalExpenses,
    netIncome: subtractMoney(totalRevenue, totalExpenses),
  };
}

interface SheetRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity';
  amount: number;
  level: number;
  isTotal: boolean;
}

/**
 * Derive a balance sheet from account net balances — pure core. Assets are
 * debit-normal; liabilities and equity are credit-normal (shown positive).
 * Revenue and expense net into a single "Accumulated Earnings" equity line
 * (the system has no year-end close). isBalanced asserts the fundamental
 * identity: assets = liabilities + equity.
 */
export function deriveBalanceSheet(
  accounts: ReportAccount[],
  netOf: (account: ReportAccount) => number,
): {
  assetItems: SheetRow[];
  totalAssets: number;
  liabilityItems: SheetRow[];
  totalLiabilities: number;
  equityItems: SheetRow[];
  totalEquity: number;
  isBalanced: boolean;
} {
  const assetItems: SheetRow[] = [];
  const liabilityItems: SheetRow[] = [];
  const equityItems: SheetRow[] = [];
  let currentYearRevenue = 0;
  let currentYearExpenses = 0;

  for (const account of accounts) {
    if (account.isActive === false) continue;
    const net = netOf(account);

    if (account.type === 'revenue' || account.type === 'expense') {
      if (account.type === 'revenue') {
        currentYearRevenue = addMoney(currentYearRevenue, roundMoney(-net));
      } else {
        currentYearExpenses = addMoney(currentYearExpenses, net);
      }
      continue;
    }

    if (Math.abs(net) < 0.01) continue;
    const amount = account.type === 'liability' || account.type === 'equity'
      ? roundMoney(-net)
      : net;
    const row: SheetRow = {
      accountId: account.id ?? '',
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      amount,
      level: 0,
      isTotal: false,
    };
    if (account.type === 'asset') assetItems.push(row);
    else if (account.type === 'liability') liabilityItems.push(row);
    else equityItems.push(row);
  }

  const currentYearEarnings = subtractMoney(currentYearRevenue, currentYearExpenses);
  if (Math.abs(currentYearEarnings) >= 0.01) {
    equityItems.push({
      accountId: '__current_year_earnings__',
      accountCode: '',
      accountName: 'Accumulated Earnings',
      accountType: 'equity',
      amount: currentYearEarnings,
      level: 0,
      isTotal: false,
    });
  }

  assetItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  liabilityItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  equityItems.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const totalAssets = sumMoney(assetItems.map((r) => r.amount));
  const totalLiabilities = sumMoney(liabilityItems.map((r) => r.amount));
  const totalEquity = sumMoney(equityItems.map((r) => r.amount));

  return {
    assetItems,
    totalAssets,
    liabilityItems,
    totalLiabilities,
    equityItems,
    totalEquity,
    isBalanced: Math.abs(subtractMoney(totalAssets, addMoney(totalLiabilities, totalEquity))) < 0.01,
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

/**
 * Collapse accounts sharing a code to a single entry. GL totals are aggregated
 * BY CODE (see getAccountNet), so a report that iterates a raw account list
 * would attribute a code's full total to every doc carrying that code, double-
 * counting the trial balance / income statement / balance sheet. New duplicate
 * codes are now prevented at creation, but existing data may already contain
 * them — reports dedupe defensively. Accounts without a code fall through
 * unchanged (keyed by id).
 */
export function dedupeAccountsByCode<T extends { id?: string; code?: string }>(
  accounts: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const account of accounts) {
    const key = account.code ? `code:${account.code}` : `id:${account.id ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(account);
  }
  return out;
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
