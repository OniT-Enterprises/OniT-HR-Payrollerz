import { describe, expect, it } from 'vitest';
import {
  applyCashAdvanceClearing,
  calculateCashAdvancePosition,
  validateCashAdvanceClearing,
  validateCashAdvanceInput,
  type CashAdvance,
} from '@/lib/accounting/cash-advance';
import type { ExpenseCategory } from '@/types/money';

const openAdvance: Pick<CashAdvance, 'issueDate' | 'outstanding' | 'status'> = {
  issueDate: '2026-07-01',
  outstanding: 300,
  status: 'open',
};

describe('accountable cash advances', () => {
  it('requires a named employee, clear-by date, reference, and issue evidence', () => {
    const input = {
      employeeId: ' emp-1 ',
      purpose: ' Field supplies ',
      issueDate: '2026-07-01',
      dueDate: '2026-07-10',
      amount: 300,
      fundingMethod: 'cash' as const,
      issueReference: ' VCH-001 ',
      issueProofUrl: ' https://storage.example/voucher.pdf ',
    };
    expect(validateCashAdvanceInput(input)).toEqual({
      ...input,
      employeeId: 'emp-1',
      purpose: 'Field supplies',
      issueReference: 'VCH-001',
      issueProofUrl: 'https://storage.example/voucher.pdf',
    });
    expect(() => validateCashAdvanceInput({ ...input, issueProofUrl: '' })).toThrow(/proof/i);
    expect(() => validateCashAdvanceInput({ ...input, dueDate: '2026-06-30' })).toThrow(/before/i);
  });

  it('keeps receipts, returned money, and outstanding balance distinct', () => {
    expect(calculateCashAdvancePosition(300, 125.55, 24.45)).toEqual({
      amount: 300,
      expenseCleared: 125.55,
      cashReturned: 24.45,
      outstanding: 150,
      status: 'open',
    });
  });

  it('marks the advance cleared only at exact cent equality', () => {
    expect(calculateCashAdvancePosition(300, 275.55, 24.45).status).toBe('cleared');
    expect(() => calculateCashAdvancePosition(300, 275.56, 24.45)).toThrow(/exceeds/i);
  });

  it('requires receipt evidence and an expense category', () => {
    const result = validateCashAdvanceClearing(openAdvance, {
      type: 'expense',
      date: '2026-07-05',
      amount: 125.55,
      description: 'Office materials',
      proofUrl: 'https://storage.example/receipt.pdf',
      expenseCategory: 'supplies',
    });
    expect(result.expenseCategory).toBe('supplies');
    expect(() => validateCashAdvanceClearing(openAdvance, {
      type: 'expense',
      date: '2026-07-05',
      amount: 20,
      description: 'Materials',
      proofUrl: 'proof',
    })).toThrow(/category/i);
    expect(() => validateCashAdvanceClearing(openAdvance, {
      type: 'expense',
      date: '2026-07-05',
      amount: 20,
      description: 'Materials',
      proofUrl: 'proof',
      expenseCategory: 'not_a_category' as ExpenseCategory,
    })).toThrow(/valid expense category/i);
  });

  it('requires return destination, reference, and proof for unused cash', () => {
    expect(validateCashAdvanceClearing(openAdvance, {
      type: 'return',
      date: '2026-07-05',
      amount: 50,
      description: 'Unused balance returned',
      proofUrl: 'https://storage.example/return.pdf',
      returnMethod: 'bank_transfer',
      reference: 'DEP-002',
    }).returnMethod).toBe('bank_transfer');
    expect(() => validateCashAdvanceClearing(openAdvance, {
      type: 'return',
      date: '2026-07-05',
      amount: 50,
      description: 'Unused balance returned',
      proofUrl: 'proof',
      returnMethod: 'cash',
      reference: '',
    })).toThrow(/reference/i);
  });

  it('rejects pre-issue clearing, over-clearing, and already-cleared records', () => {
    const input = {
      type: 'expense' as const,
      date: '2026-07-05',
      amount: 300.01,
      description: 'Materials',
      proofUrl: 'proof',
      expenseCategory: 'supplies' as const,
    };
    expect(() => validateCashAdvanceClearing(openAdvance, input)).toThrow(/exceeds/i);
    expect(() => validateCashAdvanceClearing(openAdvance, { ...input, amount: 20, date: '2026-06-30' })).toThrow(/before/i);
    expect(() => validateCashAdvanceClearing({ ...openAdvance, status: 'cleared', outstanding: 0 }, { ...input, amount: 20 })).toThrow(/already cleared/i);
  });

  it('applies partial expense and return clearings without money drift', () => {
    const afterExpense = applyCashAdvanceClearing(
      { amount: 300, expenseCleared: 0, cashReturned: 0 },
      { type: 'expense', amount: 233.33 },
    );
    const final = applyCashAdvanceClearing(
      afterExpense,
      { type: 'return', amount: 66.67 },
    );
    expect(final).toEqual({
      amount: 300,
      expenseCleared: 233.33,
      cashReturned: 66.67,
      outstanding: 0,
      status: 'cleared',
    });
  });
});
