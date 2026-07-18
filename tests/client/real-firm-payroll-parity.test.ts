import { describe, expect, it } from 'vitest';
import {
  calculateHourlyRate,
  calculateTLPayroll,
  type TLPayrollCalculationConfig,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';
import { addMoney, subtractMoney, sumMoney } from '@/lib/currency';
import {
  deidentifiedFirmPayrollCases,
  type DeidentifiedFirmPayrollCase,
} from './fixtures/deidentified-firm-payroll';

/**
 * This is an accounting-workpaper convention, not a statutory default. The
 * matched source workbooks use ROUNDUP(monthly salary / 190, 2).
 */
const SOURCE_WORKPAPER_CONFIG = {
  hourlyRate: { monthlyHoursDivisor: 190, rounding: 'up' },
  overtime: { standard: 1.5, sundayHoliday: 2, rounding: 'aggregate' },
} satisfies TLPayrollCalculationConfig;

type ComparedComponent =
  | 'hourlyRate'
  | 'absenceDeduction'
  | 'overtimePay'
  | 'grossAfterAttendance'
  | 'wit'
  | 'inssEmployee'
  | 'net'
  | 'inssEmployer';

type ComponentDifferences = Partial<Record<ComparedComponent, number>>;

const EXPECTED_ONE_CENT_DIFFERENCES = {
  'firm-period-1-28': { grossAfterAttendance: 0.01 },
  'firm-period-2-12': { net: -0.01 },
  'firm-period-2-13': { net: 0.01 },
  'firm-period-3-02': { net: -0.01 },
  'firm-period-3-12': { wit: 0.01 },
  'firm-period-3-14': { net: 0.01 },
} satisfies Record<string, ComponentDifferences>;

function toPayrollInput(worked: DeidentifiedFirmPayrollCase): TLPayrollInput {
  return {
    employeeId: worked.caseId,
    monthlySalary: worked.monthlySalary,
    payFrequency: 'monthly',
    isHourly: false,
    regularHours: 190,
    overtimeHours: worked.overtimeHours,
    nightShiftHours: 0,
    holidayHours: worked.holidayHours,
    restDayHours: 0,
    absenceHours: worked.absenceHours,
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
    subsidioAnual: worked.annualSubsidy,
    nonCashBenefits: 0,
    nonCashBenefitINSSCategory: null,
    taxInfo: {
      isResident: worked.resident,
      hasTaxExemption: false,
      inssExempt: worked.inssExempt,
    },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: 0,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 12,
    hireDate: '2000-01-01',
  };
}

function calculateDifferences(
  worked: DeidentifiedFirmPayrollCase,
): ComponentDifferences {
  const calculated = calculateTLPayroll(
    toPayrollInput(worked),
    SOURCE_WORKPAPER_CONFIG,
  );
  const expected: Record<ComparedComponent, number> = {
    hourlyRate: worked.sourceHourlyRate,
    absenceDeduction: worked.expectedAbsenceDeduction,
    overtimePay: worked.expectedOvertimePay,
    grossAfterAttendance: worked.expectedGross,
    wit: worked.expectedWit,
    inssEmployee: worked.expectedInssEmployee,
    net: worked.expectedNet,
    inssEmployer: worked.expectedInssEmployer,
  };
  const actual: Record<ComparedComponent, number> = {
    hourlyRate: calculateHourlyRate(
      worked.monthlySalary,
      SOURCE_WORKPAPER_CONFIG.hourlyRate,
    ),
    absenceDeduction: calculated.absenceDeduction,
    overtimePay: addMoney(calculated.overtimePay, calculated.holidayPay),
    grossAfterAttendance: calculated.wagesPaid,
    wit: calculated.incomeTax,
    inssEmployee: calculated.inssEmployee,
    net: calculated.netPay,
    inssEmployer: calculated.inssEmployer,
  };

  return Object.fromEntries(
    (Object.keys(expected) as ComparedComponent[])
      .map((component) => [
        component,
        subtractMoney(actual[component], expected[component]),
      ] as const)
      .filter(([, difference]) => difference !== 0),
  ) as ComponentDifferences;
}

describe('real de-identified firm payroll workpaper parity', () => {
  it('contains three complete schedules without identity-bearing fields', () => {
    expect(deidentifiedFirmPayrollCases).toHaveLength(86);
    expect(new Set(deidentifiedFirmPayrollCases.map(({ caseId }) => caseId)).size)
      .toBe(86);
    expect(deidentifiedFirmPayrollCases.filter(({ caseId }) =>
      caseId.startsWith('firm-period-1-'))).toHaveLength(30);
    expect(deidentifiedFirmPayrollCases.filter(({ caseId }) =>
      caseId.startsWith('firm-period-2-'))).toHaveLength(28);
    expect(deidentifiedFirmPayrollCases.filter(({ caseId }) =>
      caseId.startsWith('firm-period-3-'))).toHaveLength(28);
  });

  it('does not silently apply the firm-specific hourly-rate convention', () => {
    expect(calculateHourlyRate(130)).toBe(0.68);
    expect(calculateHourlyRate(130, SOURCE_WORKPAPER_CONFIG.hourlyRate)).toBe(0.69);
  });

  it('matches all 85 representable rows at the documented precision', () => {
    const comparable = deidentifiedFirmPayrollCases.filter(
      ({ absenceDays }) => absenceDays === 0,
    );
    const observedDifferences = Object.fromEntries(
      comparable
        .map((worked) => [worked.caseId, calculateDifferences(worked)] as const)
        .filter(([, differences]) => Object.keys(differences).length > 0),
    );

    expect(comparable).toHaveLength(85);
    expect(observedDifferences).toEqual(EXPECTED_ONE_CENT_DIFFERENCES);
    expect(comparable.length - Object.keys(observedDifferences).length).toBe(79);
  });

  it('reconciles overtime lines to the combined workpaper total', () => {
    const worked = deidentifiedFirmPayrollCases.find(
      ({ caseId }) => caseId === 'firm-period-3-16',
    );
    expect(worked).toBeDefined();

    const calculated = calculateTLPayroll(
      toPayrollInput(worked!),
      SOURCE_WORKPAPER_CONFIG,
    );

    expect(calculated.overtimePay).toBe(2.67);
    expect(calculated.holidayPay).toBe(35.15);
    expect(addMoney(calculated.overtimePay, calculated.holidayPay)).toBe(37.82);
    expect(sumMoney(calculated.earnings.map(({ amount }) => amount)))
      .toBe(calculated.grossPay);
  });

  it('keeps the day-based source row unsupported instead of deriving fake hours', () => {
    expect(deidentifiedFirmPayrollCases
      .filter(({ absenceDays }) => absenceDays !== 0)
      .map(({ caseId, absenceDays, absenceHours, expectedAbsenceDeduction }) => ({
        caseId,
        absenceDays,
        absenceHours,
        expectedAbsenceDeduction,
      })))
      .toEqual([{
        caseId: 'firm-period-3-20',
        absenceDays: 1,
        absenceHours: 0,
        expectedAbsenceDeduction: 0,
      }]);
  });

  it('rejects an invalid configured monthly-hours divisor', () => {
    expect(() => calculateHourlyRate(130, {
      monthlyHoursDivisor: 0,
      rounding: 'up',
    })).toThrow(/positive finite/);
  });
});
