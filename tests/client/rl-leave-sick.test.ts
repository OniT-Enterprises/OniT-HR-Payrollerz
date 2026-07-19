import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';
import { computeLeaveCredits } from '@/lib/payroll/run-payroll-helpers';

/**
 * Real-life scenario: "Aderito Sarmento", a salaried monthly employee, records
 * ZERO attendance on days he is on approved leave. A naive expected-minus-worked
 * absence calc would dock his pay for that leave. The payroll pipeline must:
 *   1. credit approved PAID (non-sick) leave as paidLeaveHours so it is NOT
 *      docked as absence  → net pay unchanged for the leave days;
 *   2. classify SICK leave as sickDays feeding the TL 100%/50% sick-pay rule;
 *   3. leave UNPAID leave in the absence deduction, by design.
 *
 * All names/numbers are synthetic. Money compared with <= $0.02 tolerance.
 */

const STANDARD_DAILY_HOURS = 8;
const EMP = 'EMP-ADERITO';
const MONTHLY_SALARY = 300; // above $115 min wage, below $500 WIT threshold
const EXPECTED_REGULAR_HOURS = 176; // 22 working days * 8h
const PERIOD_START = '2026-03-01';
const PERIOD_END = '2026-03-31';

// Mon-Fri inclusive weekday counter (UTC, deterministic).
function workingDaysBetween(start: string, end: string): number {
  let count = 0;
  const cur = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (cur <= stop) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

const isPaidLeaveType = (t: string) => t === 'annual' || t === 'personal';

// Mirror of the absence formula in usePayrollCalculator (line ~537): paid-leave
// hours are subtracted so they never become an absence deduction.
function absenceHoursFor(recordedRegularHours: number, paidLeaveHours: number) {
  return Math.max(0, EXPECTED_REGULAR_HOURS - recordedRegularHours - paidLeaveHours);
}

function baseInput(overrides: Partial<TLPayrollInput>): TLPayrollInput {
  return {
    employeeId: EMP,
    monthlySalary: MONTHLY_SALARY,
    payFrequency: 'monthly',
    isHourly: false,
    regularHours: EXPECTED_REGULAR_HOURS,
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
    taxInfo: { isResident: true, hasTaxExemption: false, inssExempt: false },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: 0,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 12,
    hireDate: '2020-01-01',
    ...overrides,
  };
}

describe('paid leave not docked; sick pay 100/50 (rl-leave-sick)', () => {
  it('credits 5 days of approved annual leave so it is NOT docked as absence', () => {
    // Annual leave Mon 9 Mar – Fri 13 Mar = 5 working days = 40h; recorded 0h then.
    const credits = computeLeaveCredits(
      [{ employeeId: EMP, leaveType: 'annual', startDate: '2026-03-09', endDate: '2026-03-13' }],
      PERIOD_START,
      PERIOD_END,
      STANDARD_DAILY_HOURS,
      isPaidLeaveType,
      workingDaysBetween,
    );
    const credit = credits.get(EMP);
    expect(credit?.paidLeaveHours).toBe(40);
    expect(credit?.sickDays).toBe(0);

    const recorded = EXPECTED_REGULAR_HOURS - 40; // 40h of leave = zero attendance
    const creditedAbsence = absenceHoursFor(recorded, credit!.paidLeaveHours);
    const uncreditedAbsence = absenceHoursFor(recorded, 0); // if leave were ignored

    expect(creditedAbsence).toBe(0);
    expect(uncreditedAbsence).toBe(40);

    const credited = calculateTLPayroll(baseInput({ absenceHours: creditedAbsence }));
    const uncredited = calculateTLPayroll(baseInput({ absenceHours: uncreditedAbsence }));

    // Paid leave is not docked: full salary, no absence deduction.
    expect(credited.absenceDeduction).toBe(0);
    expect(credited.regularPay).toBeCloseTo(300, 2);
    // Net = full salary less INSS 4% only (below $500 => no WIT).
    expect(credited.netPay).toBeCloseTo(288, 2);
    expect(credited.incomeTax).toBe(0);

    // The credit genuinely matters: ignoring it would have docked ~$62.80.
    expect(uncredited.absenceDeduction).toBeCloseTo(62.8, 2);
    expect(credited.netPay).toBeGreaterThan(uncredited.netPay);
  });

  it('classifies sick leave as sickDays and applies the 100%/50% split', () => {
    // Sick Mon 16 Mar – Wed 18 Mar = 3 working days.
    const credits = computeLeaveCredits(
      [{ employeeId: EMP, leaveType: 'sick', startDate: '2026-03-16', endDate: '2026-03-18' }],
      PERIOD_START,
      PERIOD_END,
      STANDARD_DAILY_HOURS,
      isPaidLeaveType,
      workingDaysBetween,
    );
    expect(credits.get(EMP)?.sickDays).toBe(3);
    expect(credits.get(EMP)?.paidLeaveHours).toBe(0);

    const dailyRate = 12.56; // $1.57/h * 8h

    // Fresh spell (days 1-3 of the year): all at 100%.
    const fresh = calculateTLPayroll(
      baseInput({ sickDaysUsed: 3, ytdSickDaysUsed: 0 }),
    );
    expect(fresh.sickPay).toBeCloseTo(dailyRate * 3, 2); // 37.68

    // Straddling the 6-day boundary: ytd 5 + this 3 => day6=100%, day7&8=50%.
    const straddle = calculateTLPayroll(
      baseInput({ sickDaysUsed: 3, ytdSickDaysUsed: 5 }),
    );
    expect(straddle.sickPay).toBeCloseTo(dailyRate * (1 + 0.5 + 0.5), 2); // 25.12

    // Beyond the 12-day annual cap earns nothing: ytd 10 + 3 => day11&12=50%, day13=0.
    const overCap = calculateTLPayroll(
      baseInput({ sickDaysUsed: 3, ytdSickDaysUsed: 10 }),
    );
    expect(overCap.sickPay).toBeCloseTo(dailyRate * (0.5 + 0.5), 2); // 12.56

    // Sick pay ADDS to earnings (it is pay, never a deduction).
    expect(fresh.grossPay).toBeCloseTo(300 + dailyRate * 3, 2);
    expect(fresh.earnings.some((e) => e.type === 'sick_pay')).toBe(true);
  });

  it('leaves UNPAID leave in the absence deduction (no credit)', () => {
    const credits = computeLeaveCredits(
      [{ employeeId: EMP, leaveType: 'unpaid', startDate: '2026-03-09', endDate: '2026-03-13' }],
      PERIOD_START,
      PERIOD_END,
      STANDARD_DAILY_HOURS,
      isPaidLeaveType,
      workingDaysBetween,
    );
    // Unpaid leave produces no credit entry, so its hours stay as absence.
    expect(credits.get(EMP)).toBeUndefined();

    const recorded = EXPECTED_REGULAR_HOURS - 40;
    expect(absenceHoursFor(recorded, 0)).toBe(40);
    const docked = calculateTLPayroll(baseInput({ absenceHours: 40 }));
    expect(docked.absenceDeduction).toBeCloseTo(62.8, 2);
    expect(docked.netPay).toBeLessThan(288);
  });
});
