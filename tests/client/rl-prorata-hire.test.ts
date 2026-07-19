import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';
import { calculateProRataHours } from '@/lib/payroll/run-payroll-helpers';
import { TL_WORKING_HOURS } from '@/lib/payroll/constants-tl';

/**
 * REAL-LIFE SCENARIO: Mid-month new hire proration (KEY = prorata-hire)
 *
 * A café ("Kafé Lafaek") runs monthly payroll for September 2026 (Sept 1–30).
 *  - Ana Boavida is a long-tenured cook hired in 2020 → full period.
 *  - Bendito Sarmento is a new waiter hired 2026-09-16 → exactly half the
 *    calendar month worked (Sept 16–30 = 15 of 30 days).
 *
 * TL context: a mid-period hire should be paid pro-rata for days actually
 * worked. Xefe's proration path is calculateProRataHours(hireDate, periodStart,
 * periodEnd, defaultHours), which the RunPayroll calculator uses to seed each
 * row's regularHours before calling calculateTLPayroll.
 *
 * The monthly full-time hours default the calculator uses:
 *   (44 h/week * 52 weeks) / 12 months = 190.6667 h/month.
 */

const PERIOD_START = '2026-09-01';
const PERIOD_END = '2026-09-30'; // 30-day month → clean exact-half at Sept 16
const FULL_MONTHLY_HOURS = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;

// Ana hired long before the period; Bendito hired on the 16th (day 16 of 30).
const ANA_HIRE = '2020-03-02';
const BENDITO_HIRE = '2026-09-16';

const HOURS_TOL = 0.05;
const MONEY_TOL = 0.02;

function baseInput(overrides: Partial<TLPayrollInput>): TLPayrollInput {
  return {
    employeeId: 'test',
    monthlySalary: 600,
    payFrequency: 'monthly',
    isHourly: false,
    hourlyRate: undefined,
    regularHours: FULL_MONTHLY_HOURS,
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
    hireDate: '2000-01-01',
    ...overrides,
  };
}

describe('real-life: mid-month new hire proration (prorata-hire)', () => {
  it('calculateProRataHours: full-period employee keeps full hours', () => {
    const anaHours = calculateProRataHours(
      ANA_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS,
    );
    expect(anaHours).toBeCloseTo(FULL_MONTHLY_HOURS, 4);
  });

  it('calculateProRataHours: mid-period hire gets ~half the standard hours', () => {
    const benditoHours = calculateProRataHours(
      BENDITO_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS,
    );
    // Sept 16–30 = 15 days of 30 → exactly half of 190.6667 ≈ 95.33.
    expect(benditoHours).toBeGreaterThan(0);
    expect(benditoHours).toBeCloseTo(FULL_MONTHLY_HOURS / 2, 1);
    expect(Math.abs(benditoHours - FULL_MONTHLY_HOURS / 2)).toBeLessThan(HOURS_TOL);
  });

  it('HOURLY worker: prorated hours flow through to ~half the regular pay', () => {
    // An hourly waiter at $3.00/h — the proration genuinely reduces cash pay.
    const rate = 3.0;
    const fullHours = calculateProRataHours(
      ANA_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS,
    );
    const halfHours = calculateProRataHours(
      BENDITO_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS,
    );

    const full = calculateTLPayroll(
      baseInput({ isHourly: true, hourlyRate: rate, regularHours: fullHours }),
    );
    const mid = calculateTLPayroll(
      baseInput({ isHourly: true, hourlyRate: rate, regularHours: halfHours }),
    );

    // Full month ≈ 3 * 190.6667 = 572.00; mid-hire ≈ half of that.
    expect(full.regularPay).toBeCloseTo(rate * FULL_MONTHLY_HOURS, 1);
    expect(Math.abs(mid.regularPay - full.regularPay / 2)).toBeLessThanOrEqual(MONEY_TOL);
  });

  it('SALARIED monthly worker: mid-month hire is prorated via pre-hire absence', () => {
    // Salaried pay is a fixed monthly amount (calculateRegularPay ignores hours),
    // so usePayrollCalculator now prorates a mid-period hire by keeping the full
    // hours as the baseline and booking the pre-hire days as absence — the
    // absence deduction then reduces the pay. This test mirrors that seeding.
    const proratedHalf = calculateProRataHours(
      BENDITO_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS,
    );
    const preHireAbsence = Number((FULL_MONTHLY_HOURS - proratedHalf).toFixed(2));
    expect(preHireAbsence).toBeCloseTo(FULL_MONTHLY_HOURS / 2, 1); // ≈ half the month

    const midHire = calculateTLPayroll(
      baseInput({ monthlySalary: 600, regularHours: FULL_MONTHLY_HOURS, absenceHours: preHireAbsence }),
    );
    const fullMonth = calculateTLPayroll(
      baseInput({ monthlySalary: 600, regularHours: FULL_MONTHLY_HOURS, absenceHours: 0 }),
    );

    // Engine regularPay stays the fixed monthly figure...
    expect(fullMonth.wagesPaid).toBeCloseTo(600, 2);
    // ...but the pre-hire absence docks ~half, so the mid-month hire is paid ~half.
    expect(midHire.absenceDeduction).toBeGreaterThan(0);
    expect(midHire.wagesPaid).toBeCloseTo(300, 0);
    expect(midHire.wagesPaid).toBeLessThan(fullMonth.wagesPaid - 250);
    // Full-period employee (preHireAbsence === 0) is unaffected — full pay.
    const fullPeriodAbsence = Number(
      (FULL_MONTHLY_HOURS - calculateProRataHours(ANA_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS)).toFixed(2),
    );
    expect(fullPeriodAbsence).toBe(0);
  });
});
