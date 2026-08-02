/**
 * Art. 32 untaken-annual-leave payout (mined answer A3).
 *
 * Xefe had NO payout line for a leaver's untaken annual leave, so a final payslip
 * silently omitted money that a practising TL accounting firm treats as owed.
 * Evidence for every number asserted here is in
 * docs/MINED_ANSWERS_TERMINATION_AUG2026.md §A3:
 *   - a written advisory: "Unused leave (Art. 32): 1 day/month worked or 12/year;
 *     paid in full if not used; double pay if the employer unjustly prevents leave"
 *   - a real final-pay worksheet carrying "Ferias não Gozadas" as its own gross
 *     line, which the firm's own accountant revised from (salary x 2)/12 to
 *     (salary/22) x 2 — i.e. to the ordinary DAILY rate.
 */
import { describe, it, expect } from 'vitest';
import {
  accruedAnnualLeaveDays,
  calculateUntakenLeavePayout,
  leavePayoutDailyRate,
  monthsInEntitlementYear,
  calculateSubsidioAnual,
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';
import { TL_ANNUAL_LEAVE } from '@/lib/payroll/constants-tl';

describe('leavePayoutDailyRate', () => {
  it('divides the monthly salary by 22 working days by default', () => {
    // The convention the observed worksheet used for this line specifically.
    expect(leavePayoutDailyRate(220)).toBe(10);
    expect(leavePayoutDailyRate(315)).toBeCloseTo(14.32, 2);
  });

  it('honours a tenant working-days convention', () => {
    expect(leavePayoutDailyRate(220, { workingDaysPerMonth: 20 })).toBe(11);
  });

  it('rejects a non-positive divisor rather than dividing by zero', () => {
    expect(() => leavePayoutDailyRate(220, { workingDaysPerMonth: 0 })).toThrow(RangeError);
    expect(() => leavePayoutDailyRate(220, { workingDaysPerMonth: -5 })).toThrow(RangeError);
  });
});

describe('accruedAnnualLeaveDays', () => {
  it('accrues one day per month worked', () => {
    // Long-serving worker leaving in February: Jan + Feb = 2 months -> 2 days.
    // This is the observed worksheet's case, and it is why the multiplier there
    // was 2.
    expect(
      accruedAnnualLeaveDays('2016-05-01', new Date('2026-02-28T00:00:00'), {
        terminationDate: '2026-02-28',
      }),
    ).toBe(2);
  });

  it('caps at the 12-day statutory year', () => {
    expect(accruedAnnualLeaveDays('2016-05-01', new Date('2026-12-31T00:00:00'))).toBe(12);
    expect(accruedAnnualLeaveDays('2016-05-01', new Date('2026-12-31T00:00:00'))).toBe(
      TL_ANNUAL_LEAVE.daysPerYear,
    );
  });

  it('prorates a current-year hire from the hire month', () => {
    // Hired 1 Oct, leaving 31 Dec: Oct + Nov + Dec = 3 months -> 3 days.
    expect(
      accruedAnnualLeaveDays('2026-10-01', new Date('2026-12-31T00:00:00'), {
        terminationDate: '2026-12-31',
      }),
    ).toBe(3);
  });

  it('is zero for a year entirely before the hire', () => {
    expect(accruedAnnualLeaveDays('2027-01-01', new Date('2026-06-30T00:00:00'))).toBe(0);
  });

  it('uses the SAME month count as the Art. 44 subsidio', () => {
    // The two entitlements must not drift: the observed worksheet paid 2/12 of a
    // month's subsidio and 2 days of leave off one and the same month count.
    const hire = '2016-05-01';
    const asOf = new Date('2026-02-28T00:00:00');
    const opts = { terminationDate: '2026-02-28' };
    const months = monthsInEntitlementYear(hire, asOf, opts);
    expect(months).toBe(2);
    expect(accruedAnnualLeaveDays(hire, asOf, opts)).toBe(months);
    // 2/12 of $220 = $36.67
    expect(calculateSubsidioAnual(220, hire, asOf, opts)).toBeCloseTo(36.67, 2);
  });
});

describe('calculateUntakenLeavePayout', () => {
  it('pays untaken days at the daily rate', () => {
    // $220/22 = $10/day x 2 days = $20.00 — the corrected worksheet basis.
    expect(calculateUntakenLeavePayout(220, 2)).toBe(20);
  });

  it('is NOT the superseded (salary x days)/12 basis', () => {
    // The firm's first draft used (salary x 2)/12 = $36.67 and its own accountant
    // replaced it. Guard against regressing to the monthly-fraction reading.
    expect(calculateUntakenLeavePayout(220, 2)).not.toBeCloseTo(36.67, 2);
  });

  it('applies the Art. 32(5) penalty only when employer fault is asserted', () => {
    expect(calculateUntakenLeavePayout(220, 2, { employerPreventedLeave: true })).toBe(40);
    // Default must be the plain rate: fault is never inferred from a balance.
    expect(calculateUntakenLeavePayout(220, 2, {})).toBe(20);
    expect(calculateUntakenLeavePayout(220, 2)).toBe(20);
  });

  it('pays nothing for absent, zero, negative or non-finite inputs', () => {
    expect(calculateUntakenLeavePayout(220, 0)).toBe(0);
    expect(calculateUntakenLeavePayout(220, -3)).toBe(0);
    expect(calculateUntakenLeavePayout(220, Number.NaN)).toBe(0);
    expect(calculateUntakenLeavePayout(0, 5)).toBe(0);
  });

  it('handles a fractional day balance', () => {
    expect(calculateUntakenLeavePayout(220, 2.5)).toBe(25);
  });
});

function leaverInput(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: 'e1',
    monthlySalary: 220,
    payFrequency: 'monthly',
    isHourly: false,
    regularHours: 0,
    overtimeHours: 0,
    nightShiftHours: 0,
    holidayHours: 0,
    restDayHours: 0,
    absenceHours: 0,
    lateArrivalMinutes: 0,
    sickDaysUsed: 0,
    ytdSickDaysUsed: 0,
    bonus: 0,
    bonusINSSCategory: null,
    commission: 0,
    perDiem: 0,
    foodAllowance: 0,
    transportAllowance: 0,
    otherEarnings: 0,
    nonCashBenefits: 0,
    nonCashBenefitINSSCategory: null,
    taxInfo: { isResident: true, hasTIN: true },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: 0,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 2,
    hireDate: '2016-05-01',
    ...overrides,
  } as TLPayrollInput;
}

describe('calculateTLPayroll — untaken leave in the payslip', () => {
  it('adds a distinct gross earning line', () => {
    const r = calculateTLPayroll(leaverInput({ untakenLeaveDays: 2, terminationDate: '2026-02-28' }));
    const line = r.earnings.find(e => e.type === 'untaken_leave');
    expect(line).toBeDefined();
    expect(line?.amount).toBe(20);
    expect(r.untakenLeavePayout).toBe(20);
  });

  it('is inside the WIT base but OUTSIDE the INSS base', () => {
    // The load-bearing asymmetry from the mined worksheet: the contribution base
    // is salary + annual subsidy only, while the tax base takes the whole gross.
    const withLeave = calculateTLPayroll(
      leaverInput({ untakenLeaveDays: 2, terminationDate: '2026-02-28' }),
    );
    const withoutLeave = calculateTLPayroll(leaverInput({ terminationDate: '2026-02-28' }));

    expect(withLeave.taxableIncome - withoutLeave.taxableIncome).toBeCloseTo(20, 2);
    expect(withLeave.inssBase).toBeCloseTo(withoutLeave.inssBase, 2);
    expect(withLeave.inssEmployee).toBeCloseTo(withoutLeave.inssEmployee, 2);
    expect(withLeave.inssEmployer).toBeCloseTo(withoutLeave.inssEmployer, 2);
  });

  it('increases cash gross and net pay by the payout', () => {
    const withLeave = calculateTLPayroll(
      leaverInput({ untakenLeaveDays: 2, terminationDate: '2026-02-28' }),
    );
    const withoutLeave = calculateTLPayroll(leaverInput({ terminationDate: '2026-02-28' }));
    expect(withLeave.cashGrossPay - withoutLeave.cashGrossPay).toBeCloseTo(20, 2);
    expect(withLeave.netPay).toBeGreaterThan(withoutLeave.netPay);
  });

  it('adds no line when there is no untaken balance', () => {
    const r = calculateTLPayroll(leaverInput({ terminationDate: '2026-02-28' }));
    expect(r.earnings.find(e => e.type === 'untaken_leave')).toBeUndefined();
    expect(r.untakenLeavePayout).toBe(0);
  });

  it('warns when a payout is made without a termination date', () => {
    const r = calculateTLPayroll(leaverInput({ untakenLeaveDays: 2 }));
    expect(r.untakenLeavePayout).toBe(20);
    expect(r.warnings.some(w => /Art\. 32 payout normally arises only when employment ends/.test(w))).toBe(true);
  });
});
