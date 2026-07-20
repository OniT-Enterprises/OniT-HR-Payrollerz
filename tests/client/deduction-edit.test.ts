import { describe, expect, it } from 'vitest';
import {
  buildDeductionEditUpdates,
  type DeductionEditValues,
} from '@/lib/payroll/deduction-edit';

const baseEdits: DeductionEditValues = {
  description: 'Advance repayment',
  amount: 50,
  isPercentage: false,
  percentage: 0,
  isPreTax: false,
  startDate: '2026-07-01',
  endDate: '',
  frequency: 'per_paycheck',
  totalAmount: 300,
};

describe('buildDeductionEditUpdates', () => {
  it('an installment-only edit never touches the balance, total, or status', () => {
    const updates = buildDeductionEditUpdates(
      { type: 'advance_repayment', status: 'active', totalAmount: 300, remainingBalance: 200 },
      { ...baseEdits, amount: 75 }, // installment 50 -> 75, total unchanged
    );
    expect(updates.amount).toBe(75);
    expect(updates).not.toHaveProperty('remainingBalance');
    expect(updates).not.toHaveProperty('totalAmount');
    expect(updates).not.toHaveProperty('status');
  });

  it('never emits the settlement guard or identity fields', () => {
    const updates = buildDeductionEditUpdates(
      { type: 'advance_repayment', status: 'active', totalAmount: 300, remainingBalance: 200 },
      { ...baseEdits, totalAmount: 500 },
    );
    expect(updates).not.toHaveProperty('lastAppliedPeriod');
    expect(updates).not.toHaveProperty('employeeId');
    expect(updates).not.toHaveProperty('type');
  });

  it('mirrors the create shape: percentage mode zeroes amount, flat mode zeroes percentage', () => {
    const pct = buildDeductionEditUpdates(
      { type: 'other', status: 'active' },
      { ...baseEdits, isPercentage: true, percentage: 5, amount: 50 },
    );
    expect(pct.amount).toBe(0);
    expect(pct.percentage).toBe(5);

    const flat = buildDeductionEditUpdates(
      { type: 'other', status: 'active' },
      { ...baseEdits, isPercentage: false, percentage: 5, amount: 50 },
    );
    expect(flat.amount).toBe(50);
    expect(flat.percentage).toBe(0);
  });

  it('raising the total keeps what was already repaid', () => {
    // 300 advanced, 200 still outstanding => 100 repaid.
    const updates = buildDeductionEditUpdates(
      { type: 'advance_repayment', status: 'active', totalAmount: 300, remainingBalance: 200 },
      { ...baseEdits, totalAmount: 500 },
    );
    expect(updates.totalAmount).toBe(500);
    expect(updates.remainingBalance).toBe(400); // 500 - 100 repaid
    expect(updates).not.toHaveProperty('status'); // active stays active
  });

  it('reactivates a fully repaid advance whose new total leaves money outstanding', () => {
    const updates = buildDeductionEditUpdates(
      { type: 'advance_repayment', status: 'completed', totalAmount: 300, remainingBalance: 0 },
      { ...baseEdits, totalAmount: 400 },
    );
    expect(updates.remainingBalance).toBe(100); // 400 - 300 repaid
    expect(updates.status).toBe('active');
  });

  it('completes the advance when the new total drops below what was already repaid', () => {
    // 300 advanced, 100 outstanding => 200 repaid; total cut to 150.
    const updates = buildDeductionEditUpdates(
      { type: 'advance_repayment', status: 'active', totalAmount: 300, remainingBalance: 100 },
      { ...baseEdits, totalAmount: 150 },
    );
    expect(updates.remainingBalance).toBe(0);
    expect(updates.status).toBe('completed');
  });

  it('a paused advance stays paused when its balance is recomputed', () => {
    const updates = buildDeductionEditUpdates(
      { type: 'advance_repayment', status: 'paused', totalAmount: 300, remainingBalance: 300 },
      { ...baseEdits, totalAmount: 400 },
    );
    expect(updates.remainingBalance).toBe(400);
    expect(updates).not.toHaveProperty('status'); // pause/resume has its own control
  });

  it('an untracked advance given a total starts with the full total outstanding', () => {
    // Created with totalAmount 0: untracked installments were never recorded
    // against a balance, so nothing counts as repaid.
    const updates = buildDeductionEditUpdates(
      { type: 'advance_repayment', status: 'active', totalAmount: 0, remainingBalance: 0 },
      { ...baseEdits, totalAmount: 250 },
    );
    expect(updates.totalAmount).toBe(250);
    expect(updates.remainingBalance).toBe(250);
  });

  it('refuses to drop the total off a balance-tracked advance', () => {
    expect(() =>
      buildDeductionEditUpdates(
        { type: 'advance_repayment', status: 'active', totalAmount: 300, remainingBalance: 200 },
        { ...baseEdits, totalAmount: 0 },
      ),
    ).toThrow(/total amount/i);
  });

  it('ignores totalAmount for non-advance types', () => {
    const updates = buildDeductionEditUpdates(
      { type: 'court_order', status: 'active', totalAmount: 0, remainingBalance: 0 },
      { ...baseEdits, totalAmount: 999 }, // stale form value must not leak
    );
    expect(updates).not.toHaveProperty('totalAmount');
    expect(updates).not.toHaveProperty('remainingBalance');
    expect(updates).not.toHaveProperty('status');
  });

  it('clamps corrupt data (remaining above total) instead of inventing repayments', () => {
    // remaining 400 > total 300 => alreadyRepaid clamps to 0.
    const updates = buildDeductionEditUpdates(
      { type: 'advance_repayment', status: 'active', totalAmount: 300, remainingBalance: 400 },
      { ...baseEdits, totalAmount: 500 },
    );
    expect(updates.remainingBalance).toBe(500);
  });

  it('handles cent amounts with money rounding', () => {
    // 100.10 advanced, 33.37 outstanding => 66.73 repaid; total raised to 150.55.
    const updates = buildDeductionEditUpdates(
      { type: 'advance_repayment', status: 'active', totalAmount: 100.1, remainingBalance: 33.37 },
      { ...baseEdits, totalAmount: 150.55 },
    );
    expect(updates.remainingBalance).toBe(83.82); // 150.55 - 66.73
  });

  it('normalizes a cleared end date to an empty string', () => {
    const updates = buildDeductionEditUpdates(
      { type: 'other', status: 'active' },
      { ...baseEdits, endDate: '' },
    );
    expect(updates.endDate).toBe('');
  });
});
