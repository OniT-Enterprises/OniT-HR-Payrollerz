import { describe, expect, it } from 'vitest';
import {
  calculateHourlyRate,
  calculateTLPayroll,
  type TLPayrollEarning,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';

/**
 * Real-life scenario: a payslip must preserve DISTINCT line items —
 * Normal hours, Overtime, Night, Holiday — each carrying its own hours,
 * hourly rate, and amount. Corpus clients rejected payslips that collapsed
 * these into a single "other" line, so this regression pins the pure
 * earnings-line builder (calculateTLPayroll -> result.earnings), not the PDF.
 *
 * Synthetic employee: "Aderito Guterres", resident, $572/month.
 * Under Xefe's default hourly convention (44h/wk * 52/12 = 190.6667 divisor)
 * $572 / 190.6667 = exactly $3.00/hr, so the law-derived multipliers land clean:
 *   - Normal  : rate = $3.00               (regular hour)
 *   - Overtime: 1.5x  -> $4.50/hr          (Labour Law Art. 27)
 *   - Night   : +25% premium -> $0.75/hr   (21:00-06:00 subset premium ONLY)
 *   - Holiday : 2.0x  -> $6.00/hr          (public-holiday work)
 */

const HOURLY = 3.0;
const OT_HOURS = 10;
const NIGHT_HOURS = 8;
const HOLIDAY_HOURS = 5;

function buildInput(): TLPayrollInput {
  return {
    employeeId: 'emp-aderito-guterres',
    monthlySalary: 572,
    payFrequency: 'monthly',
    isHourly: false,
    regularHours: 190,
    overtimeHours: OT_HOURS,
    nightShiftHours: NIGHT_HOURS,
    holidayHours: HOLIDAY_HOURS,
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
    hireDate: '2020-01-01',
  };
}

const CENT = 0.02;
const byType = (earnings: TLPayrollEarning[], type: string) =>
  earnings.find((e) => e.type === type);

describe('payslip line items: normal / overtime / night / holiday stay distinct', () => {
  const result = calculateTLPayroll(buildInput());

  it('derives exactly $3.00/hr under the default hourly convention', () => {
    expect(calculateHourlyRate(572)).toBeCloseTo(HOURLY, 2);
  });

  it('emits four distinct earning lines, none collapsed to "other"', () => {
    const types = result.earnings.map((e) => e.type);
    expect(types).toEqual(['regular', 'overtime', 'night_shift', 'holiday']);
    expect(types).not.toContain('other');
    // No two lines share a type (nothing merged/collapsed).
    expect(new Set(types).size).toBe(types.length);
  });

  it('normal line: hours, rate and amount = base salary', () => {
    const line = byType(result.earnings, 'regular')!;
    expect(line.hours).toBe(190);
    expect(line.rate).toBeCloseTo(HOURLY, 2);
    expect(line.amount).toBeCloseTo(572, 2);
  });

  it('overtime line: 10h @ 1.5x = $4.50/hr -> $45.00', () => {
    const line = byType(result.earnings, 'overtime')!;
    expect(line.hours).toBe(OT_HOURS);
    expect(line.rate).toBeCloseTo(HOURLY * 1.5, 2);
    expect(line.amount).toBeCloseTo(HOURLY * 1.5 * OT_HOURS, CENT); // 45.00
  });

  it('night line: 8h @ +25% premium only = $0.75/hr -> $6.00', () => {
    const line = byType(result.earnings, 'night_shift')!;
    expect(line.hours).toBe(NIGHT_HOURS);
    // Premium is +0.25, NOT 1.25 — regular pay already covers the base hour.
    expect(line.rate).toBeCloseTo(HOURLY * 0.25, 2);
    expect(line.amount).toBeCloseTo(HOURLY * 0.25 * NIGHT_HOURS, CENT); // 6.00
  });

  it('holiday line: 5h @ 2.0x = $6.00/hr -> $30.00', () => {
    const line = byType(result.earnings, 'holiday')!;
    expect(line.hours).toBe(HOLIDAY_HOURS);
    expect(line.rate).toBeCloseTo(HOURLY * 2.0, 2);
    expect(line.amount).toBeCloseTo(HOURLY * 2.0 * HOLIDAY_HOURS, CENT); // 30.00
  });

  it('every line carries hours, rate and a positive amount (no bare "amount" rows)', () => {
    for (const line of result.earnings) {
      expect(line.hours, `${line.type}.hours`).toBeGreaterThan(0);
      expect(line.rate, `${line.type}.rate`).toBeGreaterThan(0);
      expect(line.amount, `${line.type}.amount`).toBeGreaterThan(0);
      expect(typeof line.description).toBe('string');
      expect(typeof line.descriptionTL).toBe('string');
    }
  });
});
