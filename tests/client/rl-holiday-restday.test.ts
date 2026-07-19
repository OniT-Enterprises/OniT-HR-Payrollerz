import { describe, expect, it } from 'vitest';
import {
  calculateHourlyRate,
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';

/**
 * Real-life scenario: a shop supervisor ("Julieta Ximenes") on $600/month is
 * asked to open the shop on a public holiday (8h) and again on her weekly rest
 * day (Sunday, 8h) during a stocktake month.
 *
 * TL legal rule asserted here (Labour Law 4/2012 Art. 27):
 *  - Work on a public holiday or the weekly rest day is paid at 2.0x the
 *    hourly rate — a full double-pay line ON TOP of the fixed monthly salary.
 *  - Holiday and rest-day lines are independent and additive; neither reduces
 *    regular pay, and zero hours must produce zero premium.
 *
 * Uses the default annualized hourly convention: 44h/week x 52 / 12 =
 * 190.6667h/month, so hourlyRate = 600 / 190.6667 = 3.1469 -> $3.15 (cents).
 * Every expected figure below is exact at that rate.
 *
 * All names/numbers are synthetic.
 */

const MONTHLY_SALARY = 600;
// Default convention (no config): 600 / (44 * 52 / 12) rounded to cents = 3.15
const HOURLY_RATE = calculateHourlyRate(MONTHLY_SALARY);

function supervisorInput(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: 'supervisor-julieta-ximenes',
    monthlySalary: MONTHLY_SALARY,
    payFrequency: 'monthly',
    isHourly: false,
    hourlyRate: undefined,
    regularHours: 190.6667,
    overtimeHours: 0,
    nightShiftHours: 0,
    holidayHours: 8,
    restDayHours: 8,
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
    subsidioAnual: 0,
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
    hireDate: '2020-03-01',
    ...overrides,
  };
}

describe('rl-holiday-restday: 2.0x premium for public-holiday and rest-day work', () => {
  it('derives the expected default hourly rate ($3.15 at $600/month)', () => {
    expect(HOURLY_RATE).toBeCloseTo(3.15, 2);
  });

  it('pays public-holiday hours at exactly 2.0x the hourly rate', () => {
    const r = calculateTLPayroll(supervisorInput());
    // Law: holidayHours x hourlyRate x 2.0 = 8 x 3.15 x 2.0 = 50.40
    expect(r.holidayPay).toBeCloseTo(8 * HOURLY_RATE * 2.0, 2);
    expect(r.holidayPay).toBeCloseTo(50.4, 2);
  });

  it('pays weekly rest-day hours at exactly 2.0x the hourly rate', () => {
    const r = calculateTLPayroll(supervisorInput());
    // Law: restDayHours x hourlyRate x 2.0 = 8 x 3.15 x 2.0 = 50.40
    expect(r.restDayPay).toBeCloseTo(8 * HOURLY_RATE * 2.0, 2);
    expect(r.restDayPay).toBeCloseTo(50.4, 2);
  });

  it('pays zero premium when holiday and rest-day hours are zero', () => {
    const r = calculateTLPayroll(supervisorInput({ holidayHours: 0, restDayHours: 0 }));
    expect(r.holidayPay).toBeCloseTo(0, 2);
    expect(r.restDayPay).toBeCloseTo(0, 2);
    // Nothing but the fixed salary in gross.
    expect(r.grossPay).toBeCloseTo(MONTHLY_SALARY, 2);
  });

  it('adds the premiums ON TOP of the fixed monthly salary (no cannibalising)', () => {
    const withPremiums = calculateTLPayroll(supervisorInput());
    const withoutPremiums = calculateTLPayroll(
      supervisorInput({ holidayHours: 0, restDayHours: 0 }),
    );

    // Salaried regular pay is the fixed monthly amount either way.
    expect(withPremiums.regularPay).toBeCloseTo(MONTHLY_SALARY, 2);
    expect(withPremiums.regularPay).toBeCloseTo(withoutPremiums.regularPay, 2);

    // The gross delta is exactly the two 2.0x lines: 50.40 + 50.40 = 100.80
    const grossDelta = withPremiums.grossPay - withoutPremiums.grossPay;
    expect(grossDelta).toBeCloseTo(100.8, 2);
    expect(withPremiums.grossPay).toBeCloseTo(700.8, 2);
  });

  it('emits holiday and rest_day earning lines carrying the 2.0x rate', () => {
    const r = calculateTLPayroll(supervisorInput());

    const holidayLine = r.earnings.find((e) => e.type === 'holiday');
    expect(holidayLine).toBeDefined();
    expect(holidayLine!.hours).toBe(8);
    expect(holidayLine!.rate).toBeCloseTo(HOURLY_RATE * 2.0, 2);
    expect(holidayLine!.amount).toBeCloseTo(50.4, 2);

    const restDayLine = r.earnings.find((e) => e.type === 'rest_day');
    expect(restDayLine).toBeDefined();
    expect(restDayLine!.hours).toBe(8);
    expect(restDayLine!.rate).toBeCloseTo(HOURLY_RATE * 2.0, 2);
    expect(restDayLine!.amount).toBeCloseTo(50.4, 2);
  });
});
