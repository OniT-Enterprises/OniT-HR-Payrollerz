import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  calculateSubsidioAnual,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';
import { calculateProRataHours } from '@/lib/payroll/run-payroll-helpers';
import { TL_WORKING_HOURS } from '@/lib/payroll/constants-tl';
import { maxMoney, subtractMoney } from '@/lib/currency';
import { resolveLeaverFinalPay } from '@/hooks/usePayrollCalculator';

/**
 * REAL-LIFE SCENARIO: mid-period termination / final-pay run (KEY = termination-payroll)
 *
 * A Dili security firm terminates a guard, Abílio Ximenes, effective
 * 2026-09-15 (15 of 30 days of the September period). His final payroll run
 * must contain, per TL law:
 *  - prorated wages for the fraction of the period actually worked
 *    (booked as absence against the full-month baseline — same mechanism
 *    as mid-period hires, see rl-prorata-hire),
 *  - Art. 56 service compensation (1 month per completed 5-year block),
 *  - the Art. 44 prorated subsidio anual for the termination year, net of
 *    any 13th month already paid this year.
 *
 * The wizard seeds these via employee.terminationDate: the roster includes
 * in-period leavers, calculateProRataHours prorates BOTH employment edges,
 * and the engine input carries terminationDate so service_compensation fires.
 */

const PERIOD_START = '2026-09-01';
const PERIOD_END = '2026-09-30'; // 30-day month → clean half at Sept 15
const FULL_MONTHLY_HOURS = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;

const ABILIO_HIRE = '2019-06-01'; // 7+ years service → one completed 5-yr block
const ABILIO_TERMINATION = '2026-09-15';

function baseInput(overrides: Partial<TLPayrollInput>): TLPayrollInput {
  return {
    employeeId: 'abilio',
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
    monthsWorkedThisYear: 9,
    hireDate: ABILIO_HIRE,
    ...overrides,
  };
}

describe('real-life: mid-period termination final pay (termination-payroll)', () => {
  it('calculateProRataHours prorates the END edge: leaver keeps ~half the hours', () => {
    const hours = calculateProRataHours(
      ABILIO_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS, ABILIO_TERMINATION,
    );
    // Sept 1–15 = 15 of 30 days → half of 190.6667 ≈ 95.33.
    expect(hours).toBeCloseTo(FULL_MONTHLY_HOURS / 2, 1);
  });

  it('calculateProRataHours edge cases: ended before period → 0; ends after period → full; both edges', () => {
    // Terminated before the period even starts — not employed at all.
    expect(
      calculateProRataHours(ABILIO_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS, '2026-08-20'),
    ).toBe(0);
    // Termination after period end — normal full period.
    expect(
      calculateProRataHours(ABILIO_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS, '2026-10-15'),
    ).toBeCloseTo(FULL_MONTHLY_HOURS, 4);
    // No end date — unchanged hire-only behaviour.
    expect(
      calculateProRataHours(ABILIO_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS),
    ).toBeCloseTo(FULL_MONTHLY_HOURS, 4);
    // Hired AND terminated inside the same period (Sept 6 – Sept 20 = 15 days).
    expect(
      calculateProRataHours('2026-09-06', PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS, '2026-09-20'),
    ).toBeCloseTo(FULL_MONTHLY_HOURS / 2, 1);
  });

  it('terminationDate fires Art. 56 service compensation: WIT-taxable, NOT INSS-able', () => {
    // 2019-06-01 → 2026-09-15 = 7 completed years = one 5-yr block = 1 month.
    const result = calculateTLPayroll(
      baseInput({ terminationDate: ABILIO_TERMINATION }),
    );
    expect(result.serviceCompensation).toBeCloseTo(600, 2);
    const line = result.earnings.find((e) => e.type === 'service_compensation');
    expect(line).toBeDefined();
    expect(line!.isTaxable).toBe(true);
    expect(line!.isINSSBase).toBe(false); // not the DL 30/2021 indemnity

    // It raises gross and the WIT base but never the INSS base.
    const without = calculateTLPayroll(baseInput({}));
    expect(subtractMoney(result.grossPay, without.grossPay)).toBeCloseTo(600, 2);
    expect(result.inssBase).toBeCloseTo(without.inssBase, 2);
  });

  it('leaver subsidio: Art. 44 prorated to the termination month, netted against YTD paid', () => {
    // Entitlement: Jan..Sep = 9/12 of $600 = $450.
    const entitled = calculateSubsidioAnual(
      600, ABILIO_HIRE, new Date(`${ABILIO_TERMINATION}T00:00:00`),
      { terminationDate: ABILIO_TERMINATION },
    );
    expect(entitled).toBeCloseTo(450, 2);

    // The wizard nets what payroll already paid this year (ytdSubsidioAnual):
    // nothing paid → full $450; $450 paid → $0; overpaid → clamped at 0.
    const net = (paid: number) => maxMoney(0, subtractMoney(entitled, paid));
    expect(net(0)).toBeCloseTo(450, 2);
    expect(net(450)).toBe(0);
    expect(net(600)).toBe(0);

    // And the netted amount flows through payroll as a normal subsidio line.
    const result = calculateTLPayroll(
      baseInput({ terminationDate: ABILIO_TERMINATION, subsidioAnual: net(0) }),
    );
    expect(result.subsidioAnual).toBeCloseTo(450, 2);
  });

  it('full final-pay run reconciles: half wages + severance + subsidio − statutory = net', () => {
    // Mirror the wizard seeding: full baseline hours, unworked half booked as
    // absence (rl-prorata-hire mechanism), plus both termination items.
    const halfAbsence = Number(
      (FULL_MONTHLY_HOURS -
        calculateProRataHours(ABILIO_HIRE, PERIOD_START, PERIOD_END, FULL_MONTHLY_HOURS, ABILIO_TERMINATION)
      ).toFixed(2),
    );
    const result = calculateTLPayroll(
      baseInput({
        terminationDate: ABILIO_TERMINATION,
        subsidioAnual: 450,
        absenceHours: halfAbsence,
      }),
    );

    // Wages ≈ $300 (half month) — absence dock hits wagesPaid.
    expect(result.absenceDeduction).toBeGreaterThan(0);
    expect(result.wagesPaid).toBeCloseTo(300 + 600 + 450, 0); // wages + severance + subsidio
    // Line items sum exactly to net pay (payslip reconciliation) — the
    // absence dock is itself a deduction line item, so no extra subtraction.
    const earningsTotal = result.earnings
      .filter((e) => e.isCash !== false)
      .reduce((sum, e) => sum + e.amount, 0);
    const deductionsTotal = result.deductions.reduce((sum, d) => sum + d.amount, 0);
    expect(result.netPay).toBeCloseTo(earningsTotal - deductionsTotal, 1);
    expect(result.netPay).toBeGreaterThan(0);
  });
});

describe('resolveLeaverFinalPay: exact-once idempotency', () => {
  const common = {
    monthlySalary: 600,
    hireDate: ABILIO_HIRE,
    asOfDate: new Date('2026-09-30T00:00:00'),
    includeSubsidioAnual: false,
    subsidioConfig: { proRataForNewEmployees: true },
  };

  it('first final run: fires severance and pays the full prorated subsidio', () => {
    const r = resolveLeaverFinalPay({
      ...common,
      inPeriodTermination: ABILIO_TERMINATION,
      committed: { serviceCompensation: 0, subsidioAnual: 0 },
    });
    expect(r.terminationDate).toBe(ABILIO_TERMINATION); // severance WILL fire
    expect(r.subsidioAnual).toBeCloseTo(450, 2); // Jan..Sep = 9/12
  });

  it('second run over the same period: severance suppressed, subsidio netted to 0', () => {
    const r = resolveLeaverFinalPay({
      ...common,
      inPeriodTermination: ABILIO_TERMINATION,
      // The first run already recorded these amounts.
      committed: { serviceCompensation: 600, subsidioAnual: 450 },
    });
    expect(r.terminationDate).toBeUndefined(); // NO second severance
    expect(r.subsidioAnual).toBe(0); // NO second subsidio
  });

  it('partial prior subsidio (annual run before termination) is topped up, not doubled', () => {
    const r = resolveLeaverFinalPay({
      ...common,
      inPeriodTermination: ABILIO_TERMINATION,
      committed: { serviceCompensation: 0, subsidioAnual: 200 },
    });
    expect(r.terminationDate).toBe(ABILIO_TERMINATION);
    expect(r.subsidioAnual).toBeCloseTo(250, 2); // 450 entitlement − 200 already paid
  });

  it('non-leaver: no severance; subsidio follows the run toggle only', () => {
    const off = resolveLeaverFinalPay({
      ...common, inPeriodTermination: null,
      committed: { serviceCompensation: 0, subsidioAnual: 0 },
    });
    expect(off.terminationDate).toBeUndefined();
    expect(off.subsidioAnual).toBe(0);

    const on = resolveLeaverFinalPay({
      ...common, includeSubsidioAnual: true, inPeriodTermination: null,
      committed: { serviceCompensation: 0, subsidioAnual: 0 },
    });
    expect(on.terminationDate).toBeUndefined();
    expect(on.subsidioAnual).toBeCloseTo(600, 2); // full-year employee, full month
  });
});
