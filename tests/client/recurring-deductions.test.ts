import { describe, expect, it } from 'vitest';
import {
  aggregateRecurringInputs,
  buildSettlementPlan,
  engineSlotForType,
  resolveScheduledDeductions,
  withheldRecurringByEmployee,
  type RecurringDeductionLike,
} from '@/lib/payroll/recurring-deductions';

/**
 * Deductions & Advances register wiring (client/lib/payroll/recurring-deductions.ts):
 * how register docs become engine inputs for a run, and how a PAID run settles
 * back into the register (balance decrement + once-per-period-month stamp).
 * Synthetic data only.
 */

const PERIOD = { periodStart: '2026-07-01', periodEnd: '2026-07-31' };

function doc(overrides: Partial<RecurringDeductionLike>): RecurringDeductionLike {
  return {
    id: 'ded-1',
    employeeId: 'emp-1',
    type: 'loan_repayment',
    amount: 50,
    isPercentage: false,
    percentage: 0,
    startDate: '2026-01-01',
    endDate: '',
    remainingBalance: 0,
    totalAmount: 0,
    status: 'active',
    ...overrides,
  };
}

describe('resolveScheduledDeductions + aggregateRecurringInputs', () => {
  it('aggregates per employee per engine slot', () => {
    const inputs = aggregateRecurringInputs(
      resolveScheduledDeductions(
        [
          doc({ id: 'a', type: 'loan_repayment', amount: 50 }),
          doc({ id: 'b', type: 'loan_repayment', amount: 25 }),
          doc({ id: 'c', type: 'advance_repayment', amount: 40, totalAmount: 200, remainingBalance: 200 }),
          doc({ id: 'd', type: 'court_order', amount: 100 }),
          doc({ id: 'e', type: 'other', amount: 10 }),
          doc({ id: 'f', employeeId: 'emp-2', type: 'court_order', amount: 75 }),
        ],
        PERIOD,
      ),
    );

    expect(inputs['emp-1']).toEqual({
      loanRepayment: 75,
      advanceRepayment: 40,
      courtOrders: 100,
      otherDeductions: 10,
    });
    expect(inputs['emp-2']).toEqual({
      loanRepayment: 0,
      advanceRepayment: 0,
      courtOrders: 75,
      otherDeductions: 0,
    });
  });

  it('caps a balance-tracked advance at min(installment, remainingBalance) and skips it once exhausted', () => {
    const nearlyRepaid = doc({
      type: 'advance_repayment',
      amount: 50,
      totalAmount: 300,
      remainingBalance: 12.5,
    });
    const scheduled = resolveScheduledDeductions([nearlyRepaid], PERIOD);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].amount).toBeCloseTo(12.5, 2);

    const exhausted = doc({
      type: 'advance_repayment',
      amount: 50,
      totalAmount: 300,
      remainingBalance: 0,
    });
    expect(resolveScheduledDeductions([exhausted], PERIOD)).toHaveLength(0);
  });

  it('treats a register loan without a total (remainingBalance written as 0) as open-ended, not exhausted', () => {
    // DeductionsAdvances.tsx writes remainingBalance: 0 / totalAmount: 0 for
    // every non-advance type — that must NOT read as "fully repaid".
    const uiLoan = doc({ type: 'loan_repayment', amount: 60, remainingBalance: 0, totalAmount: 0 });
    const scheduled = resolveScheduledDeductions([uiLoan], PERIOD);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].amount).toBe(60);
    expect(scheduled[0].tracksBalance).toBe(false);
  });

  it('skips docs that are not active', () => {
    expect(
      resolveScheduledDeductions(
        [doc({ status: 'paused' }), doc({ id: 'x', status: 'completed' })],
        PERIOD,
      ),
    ).toHaveLength(0);
  });

  it('skips docs already taken this period month (lastAppliedPeriod) but takes other months', () => {
    expect(
      resolveScheduledDeductions([doc({ lastAppliedPeriod: '2026-07' })], PERIOD),
    ).toHaveLength(0);
    expect(
      resolveScheduledDeductions([doc({ lastAppliedPeriod: '2026-06' })], PERIOD),
    ).toHaveLength(1);
  });

  it('skips docs outside their start/end date window', () => {
    expect(
      resolveScheduledDeductions([doc({ startDate: '2026-08-01' })], PERIOD),
    ).toHaveLength(0);
    expect(
      resolveScheduledDeductions([doc({ endDate: '2026-06-30' })], PERIOD),
    ).toHaveLength(0);
    expect(
      resolveScheduledDeductions(
        [doc({ startDate: '2026-07-15', endDate: '2026-07-20' })],
        PERIOD,
      ),
    ).toHaveLength(1);
  });

  it('never feeds statutory/attendance types back into the engine', () => {
    expect(engineSlotForType('income_tax')).toBeNull();
    expect(engineSlotForType('inss_employee')).toBeNull();
    expect(engineSlotForType('absence')).toBeNull();
    expect(engineSlotForType('late_arrival')).toBeNull();
    expect(
      resolveScheduledDeductions([doc({ type: 'income_tax', amount: 99 })], PERIOD),
    ).toHaveLength(0);
    // Unknown custom types fall into otherDeductions.
    expect(engineSlotForType('health_insurance')).toBe('otherDeductions');
  });

  it('resolves percentage docs against monthly salary, and skips them without a base', () => {
    const pct = doc({ type: 'court_order', amount: 0, isPercentage: true, percentage: 20 });
    const withBase = resolveScheduledDeductions([pct], {
      ...PERIOD,
      salaryByEmployee: { 'emp-1': 800 },
    });
    expect(withBase).toHaveLength(1);
    expect(withBase[0].amount).toBeCloseTo(160, 2);

    // No salary base: never guess at input-build time…
    expect(resolveScheduledDeductions([pct], PERIOD)).toHaveLength(0);
    // …but settlement mode resolves them unbounded (records bound them).
    const unbounded = resolveScheduledDeductions([pct], {
      ...PERIOD,
      unboundedPercentages: true,
    });
    expect(unbounded).toHaveLength(1);
    expect(unbounded[0].amount).toBe(Number.POSITIVE_INFINITY);
    // Infinity never leaks into engine inputs.
    expect(aggregateRecurringInputs(unbounded)).toEqual({});
  });
});

describe('buildSettlementPlan (run marked PAID)', () => {
  it('stamps the period month, decrements balances, and completes an advance at zero', () => {
    const scheduled = resolveScheduledDeductions(
      [
        doc({ id: 'adv', type: 'advance_repayment', amount: 50, totalAmount: 300, remainingBalance: 50 }),
        doc({ id: 'loan', type: 'loan_repayment', amount: 60 }),
      ],
      PERIOD,
    );
    const plan = buildSettlementPlan(
      scheduled,
      { 'emp-1': { advanceRepayment: 50, loanRepayment: 60 } },
      '2026-07',
    );

    const adv = plan.find((p) => p.id === 'adv')!;
    expect(adv.appliedAmount).toBeCloseTo(50, 2);
    expect(adv.remainingBalance).toBe(0);
    expect(adv.status).toBe('completed');
    expect(adv.lastAppliedPeriod).toBe('2026-07');

    const loan = plan.find((p) => p.id === 'loan')!;
    expect(loan.appliedAmount).toBeCloseTo(60, 2);
    expect(loan.remainingBalance).toBeUndefined(); // open-ended: no balance to track
    expect(loan.status).toBeUndefined();
  });

  it('decrements by what the records ACTUALLY withheld (post 30%-cap), not the scheduled installment', () => {
    const scheduled = resolveScheduledDeductions(
      [doc({ id: 'adv', type: 'advance_repayment', amount: 200, totalAmount: 400, remainingBalance: 400 })],
      PERIOD,
    );
    // The engine's 30% cap squeezed the $200 installment to $110.
    const plan = buildSettlementPlan(
      scheduled,
      { 'emp-1': { advanceRepayment: 110 } },
      '2026-07',
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].appliedAmount).toBeCloseTo(110, 2);
    expect(plan[0].remainingBalance).toBeCloseTo(290, 2);
    expect(plan[0].status).toBeUndefined();
  });

  it('does not stamp docs the run withheld nothing for (they stay eligible next month)', () => {
    const scheduled = resolveScheduledDeductions(
      [doc({ id: 'loan', type: 'loan_repayment', amount: 60 })],
      PERIOD,
    );
    // Cap squeezed the voluntary loan to $0 — no line in the records.
    expect(buildSettlementPlan(scheduled, { 'emp-1': {} }, '2026-07')).toHaveLength(0);
    expect(buildSettlementPlan(scheduled, {}, '2026-07')).toHaveLength(0);
  });

  it('allocates balance-tracked docs before open-ended docs in the same slot', () => {
    const scheduled = resolveScheduledDeductions(
      [
        doc({ id: 'open-loan', type: 'loan_repayment', amount: 60 }),
        doc({ id: 'tracked-loan', type: 'loan_repayment', amount: 40, totalAmount: 100, remainingBalance: 100 }),
      ],
      PERIOD,
    );
    // Only $50 of the $100 scheduled survived the cap.
    const plan = buildSettlementPlan(
      scheduled,
      { 'emp-1': { loanRepayment: 50 } },
      '2026-07',
    );
    const tracked = plan.find((p) => p.id === 'tracked-loan')!;
    expect(tracked.appliedAmount).toBeCloseTo(40, 2);
    expect(tracked.remainingBalance).toBeCloseTo(60, 2);
    const open = plan.find((p) => p.id === 'open-loan')!;
    expect(open.appliedAmount).toBeCloseTo(10, 2);
  });
});

describe('withheldRecurringByEmployee', () => {
  it('sums record deduction lines per slot and ignores statutory/attendance lines', () => {
    const withheld = withheldRecurringByEmployee([
      {
        employeeId: 'emp-1',
        deductions: [
          { type: 'income_tax', amount: 50 },
          { type: 'inss_employee', amount: 40 },
          { type: 'absence', amount: 20 },
          { type: 'loan_repayment', amount: 30 },
          { type: 'court_order', amount: 100 },
          { type: 'other', amount: 5 },
        ],
      },
      { employeeId: 'emp-2', deductions: [{ type: 'advance_repayment', amount: 25 }] },
    ]);

    expect(withheld['emp-1']).toEqual({
      loanRepayment: 30,
      courtOrders: 100,
      otherDeductions: 5,
    });
    expect(withheld['emp-2']).toEqual({ advanceRepayment: 25 });
  });
});
