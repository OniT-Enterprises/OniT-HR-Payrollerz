/**
 * Second real-firm payroll parity corpus (see fixture provenance).
 *
 * 38 de-identified monthly rows from seven additional completed schedules,
 * covering non-resident flat WIT + INSS exemption, absence-as-amount,
 * commission/food/annual subsidies, back pay, and post-tax fee
 * reimbursements. Assertions are tiered like the first corpus: engine values
 * must match the firm's cent-displayed outputs within 2 cents.
 *
 * The 14 employerRateAnomaly rows pin an intentional divergence: the firm
 * applied a 4.8% employer INSS rate where DL 20/2017 prescribes 6%. Xefe
 * asserts its own 6% and records the firm value; resolving what 4.8%
 * represented is an open question for the firm's accountants.
 */
import { describe, expect, it } from "vitest";
import {
  calculateHourlyRate,
  calculateTLPayroll,
  type TLPayrollInput,
} from "@/lib/payroll/calculations-tl";
import {
  deidentifiedFirmPayrollCases2,
  type DeidentifiedFirmPayrollCase2,
} from "./fixtures/deidentified-firm-payroll-2";

const TOLERANCE = 0.02;

function runCase(row: DeidentifiedFirmPayrollCase2) {
  const hourlyRate = calculateHourlyRate(row.monthlySalary);
  const input: TLPayrollInput = {
    employeeId: row.caseId,
    monthlySalary: row.monthlySalary,
    payFrequency: "monthly",
    isHourly: false,
    regularHours: 190.67,
    overtimeHours: 0,
    nightShiftHours: 0,
    holidayHours: 0,
    restDayHours: 0,
    absenceHours: row.absenceAmount > 0 ? row.absenceAmount / hourlyRate : 0,
    lateArrivalMinutes: 0,
    sickDaysUsed: 0,
    ytdSickDaysUsed: 0,
    bonus: 0,
    bonusINSSCategory: null,
    commission: row.commission,
    perDiem: 0,
    foodAllowance: row.foodSubsidy,
    transportAllowance: 0,
    otherEarnings: row.extraEarnings,
    subsidioAnual: row.annualSubsidy,
    nonCashBenefits: 0,
    nonCashBenefitINSSCategory: null,
    taxInfo: {
      isResident: row.resident,
      hasTaxExemption: false,
      inssExempt: row.inssExempt,
    },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: row.otherDeductions,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 6,
    hireDate: "2020-01-01",
  };
  return calculateTLPayroll(input);
}

describe("real firm payroll parity — corpus 2", () => {
  const representable = deidentifiedFirmPayrollCases2.filter((c) => c.representable);

  it("covers a meaningful corpus", () => {
    expect(deidentifiedFirmPayrollCases2.length).toBe(38);
    expect(representable.length).toBe(36);
    // The corpus must keep exercising the non-resident path
    expect(representable.some((c) => !c.resident)).toBe(true);
    expect(representable.some((c) => c.inssExempt)).toBe(true);
  });

  for (const row of representable) {
    it(`${row.caseId} matches the firm's worked schedule`, () => {
      const result = runCase(row);

      expect(Math.abs(result.wagesPaid - row.expectedGross)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(result.incomeTax - row.expectedWit)).toBeLessThanOrEqual(TOLERANCE);
      if (row.expectedInssEmployee != null) {
        expect(Math.abs(result.inssEmployee - row.expectedInssEmployee)).toBeLessThanOrEqual(TOLERANCE);
      }
      if (row.expectedNet != null) {
        // The firm adds the salary-fee reimbursement to net after withholding
        const netWithFee = result.netPay + row.feeReimbursement;
        expect(Math.abs(netWithFee - row.expectedNet)).toBeLessThanOrEqual(TOLERANCE);
      }

      if (row.expectedInssEmployer != null) {
        if (row.employerRateAnomaly) {
          // Firm applied 4.8%; Xefe stays on the statutory 6% (DL 20/2017).
          expect(Math.abs(row.expectedInssEmployer - row.expectedGross * 0.048)).toBeLessThanOrEqual(0.05);
          expect(Math.abs(result.inssEmployer - row.expectedGross * 0.06)).toBeLessThanOrEqual(TOLERANCE);
        } else {
          expect(Math.abs(result.inssEmployer - row.expectedInssEmployer)).toBeLessThanOrEqual(TOLERANCE);
        }
      }
    });
  }
});
