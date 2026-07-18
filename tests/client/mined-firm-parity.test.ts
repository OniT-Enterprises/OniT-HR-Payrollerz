import { describe, expect, it } from 'vitest';
import {
  calculateTLPayroll,
  type TLPayrollInput,
} from '@/lib/payroll/calculations-tl';
import { addMoney } from '@/lib/currency';
import { calculateTLWithholding } from '@/lib/tax/withholding-tl';

function aggregateINSSInput(): TLPayrollInput {
  return {
    employeeId: 'aggregate-inss',
    monthlySalary: 6_976.7,
    payFrequency: 'monthly',
    isHourly: false,
    regularHours: 190,
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
    subsidioAnual: 0,
    nonCashBenefits: 0,
    nonCashBenefitINSSCategory: null,
    taxInfo: {
      isResident: true,
      hasTaxExemption: true,
      inssExempt: false,
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

/**
 * Independent aggregate from correspondence, retained separately from the 86
 * row-level workbook fixture. No employee or employer identity is included.
 */
describe('de-identified firm-vs-Xefe aggregate INSS parity', () => {
  it('reproduces the independently stated 4% + 6% computation', () => {
    const result = calculateTLPayroll(aggregateINSSInput());

    expect(result.inssEmployee).toBe(279.07);
    expect(result.inssEmployer).toBe(418.6);
    expect(addMoney(result.inssEmployee, result.inssEmployer)).toBe(697.67);
  });
});

/**
 * De-identified supplier-payment computations from operational tax schedules.
 * Entity names, invoice references, engagements, and dates are omitted.
 */
describe('de-identified firm-vs-Xefe supplier withholding parity', () => {
  it.each([
    {
      caseId: 'construction-consulting-01',
      gross: 71_940,
      expectedTax: 2_877.6,
    },
    { caseId: 'construction-consulting-02', gross: 12_000, expectedTax: 480 },
    {
      caseId: 'construction-consulting-03',
      gross: 37_042.9,
      expectedTax: 1_481.72,
    },
  ])('$caseId reproduces the firm\'s 4% schedule', ({ gross, expectedTax }) => {
    const result = calculateTLWithholding({
      grossAmount: gross,
      category: 'construction_consulting',
      recipientResidence: 'resident',
      recipientHasTimorLestePermanentEstablishment: false,
      payerIsIndividual: false,
      taxRegime: 'domestic',
    });
    expect(result.withholdingTax).toBe(expectedTax);
    expect(result.rate).toBe(0.04);
  });

  it('reproduces a 10% non-resident professional-service computation', () => {
    const result = calculateTLWithholding({
      grossAmount: 11_555.56,
      category: 'general_service',
      recipientResidence: 'non_resident',
      recipientHasTimorLestePermanentEstablishment: false,
      payerIsIndividual: false,
      taxRegime: 'domestic',
    });
    expect(result.withholdingTax).toBe(1_155.56);
    expect(result.netPayment).toBe(10_400);
  });
});

