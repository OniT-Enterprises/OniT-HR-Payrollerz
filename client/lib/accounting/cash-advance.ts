/**
 * Accountable staff expense advances.
 *
 * This intentionally excludes salary loans and supplier deposits. It covers
 * money issued to a named worker before receipts, then cleared by documented
 * business expenses and/or money returned to the company.
 */

import { addMoney, compareMoney, roundMoney, subtractMoney } from '@/lib/currency';
import type { ExpenseCategory } from '@/types/money';

export type CashAdvanceFundingMethod = 'cash' | 'bank_transfer';
export type CashAdvanceStatus = 'open' | 'cleared';
export type CashAdvanceClearingType = 'expense' | 'return';

export const CASH_ADVANCE_EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'rent',
  'utilities',
  'supplies',
  'equipment',
  'transport',
  'fuel',
  'meals',
  'professional_services',
  'insurance',
  'taxes_licenses',
  'marketing',
  'communication',
  'maintenance',
  'other',
] as const;

export interface CashAdvanceInput {
  employeeId: string;
  purpose: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  fundingMethod: CashAdvanceFundingMethod;
  issueReference: string;
  issueProofUrl: string;
  notes?: string;
}

export interface CashAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  purpose: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  expenseCleared: number;
  cashReturned: number;
  outstanding: number;
  status: CashAdvanceStatus;
  fundingMethod: CashAdvanceFundingMethod;
  issueReference: string;
  issueProofUrl: string;
  notes?: string;
  journalEntryId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CashAdvanceClearingInput {
  type: CashAdvanceClearingType;
  date: string;
  amount: number;
  description: string;
  proofUrl: string;
  expenseCategory?: ExpenseCategory;
  returnMethod?: CashAdvanceFundingMethod;
  reference?: string;
}

export interface CashAdvanceClearing extends CashAdvanceClearingInput {
  id: string;
  advanceId: string;
  journalEntryId: string;
  createdBy: string;
  createdAt: Date;
}

export interface CashAdvancePosition {
  amount: number;
  expenseCleared: number;
  cashReturned: number;
  outstanding: number;
  status: CashAdvanceStatus;
}

function parseISODate(value: string, label: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${label} must use YYYY-MM-DD format.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) throw new Error(`${label} is not a valid calendar date.`);
  return value;
}

function requiredText(value: string, label: string): string {
  const text = value.trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function positiveAmount(value: number, label: string): number {
  const amount = roundMoney(value);
  if (!Number.isFinite(value) || amount <= 0) {
    throw new Error(`${label} must be at least $0.01.`);
  }
  return amount;
}

export function validateCashAdvanceInput(input: CashAdvanceInput): CashAdvanceInput {
  const employeeId = requiredText(input.employeeId, 'Employee');
  const purpose = requiredText(input.purpose, 'Advance purpose');
  const issueDate = parseISODate(input.issueDate, 'Issue date');
  const dueDate = parseISODate(input.dueDate, 'Clear-by date');
  if (dueDate < issueDate) throw new Error('Clear-by date cannot be before the issue date.');
  const amount = positiveAmount(input.amount, 'Advance amount');
  if (!['cash', 'bank_transfer'].includes(input.fundingMethod)) {
    throw new Error('Select how the advance was issued.');
  }
  const issueReference = requiredText(input.issueReference, 'Voucher or transfer reference');
  const issueProofUrl = requiredText(input.issueProofUrl, 'Issue proof');
  const notes = input.notes?.trim();
  return {
    employeeId,
    purpose,
    issueDate,
    dueDate,
    amount,
    fundingMethod: input.fundingMethod,
    issueReference,
    issueProofUrl,
    ...(notes ? { notes } : {}),
  };
}

export function calculateCashAdvancePosition(
  amountInput: number,
  expenseClearedInput: number,
  cashReturnedInput: number,
): CashAdvancePosition {
  const amount = roundMoney(amountInput);
  const expenseCleared = roundMoney(expenseClearedInput);
  const cashReturned = roundMoney(cashReturnedInput);
  if (
    ![amountInput, expenseClearedInput, cashReturnedInput].every(Number.isFinite)
    || amount <= 0
    || expenseCleared < 0
    || cashReturned < 0
  ) {
    throw new Error('Cash advance balances are invalid.');
  }
  const cleared = addMoney(expenseCleared, cashReturned);
  if (compareMoney(cleared, amount) > 0) {
    throw new Error('Cash advance clearing exceeds the amount issued.');
  }
  const outstanding = subtractMoney(amount, cleared);
  return {
    amount,
    expenseCleared,
    cashReturned,
    outstanding,
    status: outstanding === 0 ? 'cleared' : 'open',
  };
}

export function validateCashAdvanceClearing(
  advance: Pick<CashAdvance, 'issueDate' | 'outstanding' | 'status'>,
  input: CashAdvanceClearingInput,
): CashAdvanceClearingInput {
  if (advance.status !== 'open' || compareMoney(advance.outstanding, 0) <= 0) {
    throw new Error('This cash advance is already cleared.');
  }
  if (!['expense', 'return'].includes(input.type)) {
    throw new Error('Select expense receipt or cash returned.');
  }
  const date = parseISODate(input.date, 'Clearing date');
  if (date < advance.issueDate) throw new Error('Clearing date cannot be before the advance issue date.');
  const amount = positiveAmount(input.amount, 'Clearing amount');
  if (compareMoney(amount, advance.outstanding) > 0) {
    throw new Error('Clearing amount exceeds the outstanding advance.');
  }
  const description = requiredText(input.description, 'Description');
  const proofUrl = requiredText(input.proofUrl, 'Receipt or return proof');

  if (input.type === 'expense') {
    if (
      !input.expenseCategory
      || !CASH_ADVANCE_EXPENSE_CATEGORIES.includes(input.expenseCategory)
    ) {
      throw new Error('Select a valid expense category.');
    }
    return {
      type: 'expense',
      date,
      amount,
      description,
      proofUrl,
      expenseCategory: input.expenseCategory,
    };
  }
  if (!input.returnMethod || !['cash', 'bank_transfer'].includes(input.returnMethod)) {
    throw new Error('Select how the unused money was returned.');
  }
  const reference = requiredText(input.reference || '', 'Return reference');
  return {
    type: 'return',
    date,
    amount,
    description,
    proofUrl,
    returnMethod: input.returnMethod,
    reference,
  };
}

export function applyCashAdvanceClearing(
  current: Pick<CashAdvancePosition, 'amount' | 'expenseCleared' | 'cashReturned'>,
  clearing: Pick<CashAdvanceClearingInput, 'type' | 'amount'>,
): CashAdvancePosition {
  return calculateCashAdvancePosition(
    current.amount,
    addMoney(current.expenseCleared, clearing.type === 'expense' ? clearing.amount : 0),
    addMoney(current.cashReturned, clearing.type === 'return' ? clearing.amount : 0),
  );
}
