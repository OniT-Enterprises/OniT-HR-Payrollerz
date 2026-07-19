import { describe, expect, it } from "vitest";
import {
  buildJournalEntry,
  getDefaultMappings,
} from "@/services/quickbooksExportService";
import type { PayrollRun, PayrollRecord } from "@/types/payroll";
import type { TLPayrollRun, TLPayrollRecord } from "@/types/payroll-tl";
import type { QBExportOptions } from "@/types/quickbooks";

const options: QBExportOptions = {
  format: "csv",
  includeEmployeeDetail: false,
  groupByDepartment: false,
  useCustomMappings: false,
};

const run: PayrollRun = {
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  payDate: "2026-07-05",
  payFrequency: "monthly",
  status: "approved",
  totalGrossPay: 1500,
  totalNetPay: 1300,
  totalDeductions: 200,
  totalEmployerTaxes: 90,
  totalEmployerContributions: 90,
  employeeCount: 1,
  createdBy: "tester",
};

// A record whose gross is made of far more than plain regular + overtime pay:
// regular 1000 + overtime 150 + allowance 100 + bonus 50 + subsidio 200 = 1500.
// Deductions: WIT 100 + employee INSS 60 + loan repayment 40 = 200, so
// net = 1500 - 200 = 1300; employer INSS 90.
const genericRecord = {
  payrollRunId: "run1",
  employeeId: "e1",
  employeeName: "Silva, Maria",
  employeeNumber: "001",
  department: "Ops",
  position: "Staff",
  regularHours: 160,
  overtimeHours: 10,
  doubleTimeHours: 0,
  holidayHours: 0,
  ptoHoursUsed: 0,
  sickHoursUsed: 0,
  hourlyRate: 6.25,
  overtimeRate: 1.5,
  earnings: [
    { type: "regular", description: "Base", amount: 1000 },
    { type: "overtime", description: "OT", amount: 150 },
    { type: "allowance", description: "Transport", amount: 100 },
    { type: "bonus", description: "Bonus", amount: 50 },
    { type: "subsidio_anual", description: "13th", amount: 200 },
  ],
  totalGrossPay: 1500,
  deductions: [
    { type: "income_tax", description: "WIT", amount: 100, isPreTax: false, isPercentage: false },
    { type: "inss_employee", description: "INSS 4%", amount: 60, isPreTax: false, isPercentage: false },
    { type: "loan_repayment", description: "Loan", amount: 40, isPreTax: false, isPercentage: false },
  ],
  totalDeductions: 200,
  employerContributions: [],
  totalEmployerContributions: 0,
  employerTaxes: [{ type: "inss_employer", description: "INSS 6%", amount: 90 }],
  totalEmployerTaxes: 90,
  netPay: 1300,
  totalEmployerCost: 1590,
  ytdGrossPay: 1500,
  ytdNetPay: 1300,
  ytdIncomeTax: 100,
  ytdINSSEmployee: 60,
} as unknown as PayrollRecord;

describe("quickbooks payroll journal export", () => {
  it("balances debits and credits when a record has allowances, bonus and subsidio", () => {
    const entry = buildJournalEntry(run, [genericRecord], getDefaultMappings(), options);

    expect(entry.totalDebits).toBeGreaterThan(0);
    // The regression: previously only regular + overtime were debited while the
    // full net (reflecting every earning) was credited, so the two diverged.
    expect(entry.totalDebits).toBe(entry.totalCredits);
    // gross (1500) + employer INSS (90) on each side.
    expect(entry.totalDebits).toBe(1590);
  });

  it("debits the full gross composition and credits the non-statutory deductions", () => {
    const entry = buildJournalEntry(run, [genericRecord], getDefaultMappings(), options);

    const debit = (code: string) =>
      entry.lines.find((l) => l.accountCode === code)?.debit ?? 0;
    const credit = (code: string) =>
      entry.lines.find((l) => l.accountCode === code)?.credit ?? 0;

    // Base 1000 (5110), overtime 150 (5120), remainder 350 (5160) == gross.
    expect(debit("5110")).toBe(1000);
    expect(debit("5120")).toBe(150);
    expect(debit("5160")).toBe(350);
    // Loan repayment surfaces as other payroll deductions payable (2260).
    expect(credit("2260")).toBe(40);
    expect(credit("2210")).toBe(1300); // net pay
    expect(credit("2220")).toBe(100); // WIT
    expect(credit("2230")).toBe(60); // employee INSS
  });

  it("balances for TL records that carry earnings beyond salary and overtime", () => {
    const tlRun = { ...run } as unknown as TLPayrollRun;
    // monthlySalary 1000, overtime estimate 150 (10h * 10 * 1.5), plus a
    // night-shift / holiday premium pushing gross to 1400. Net 1200 after
    // WIT 90 + employee INSS 56 + other 54.
    const tlRecord = {
      payrollRunId: "run1",
      employeeId: "e2",
      employeeName: "Do Carmo, José",
      employeeNumber: "002",
      department: "Ops",
      position: "Staff",
      isResident: true,
      regularHours: 160,
      overtimeHours: 10,
      nightShiftHours: 20,
      holidayHours: 0,
      restDayHours: 0,
      absenceHours: 0,
      lateArrivalMinutes: 0,
      sickDaysUsed: 0,
      hourlyRate: 10,
      dailyRate: 80,
      monthlySalary: 1000,
      earnings: [],
      grossPay: 1400,
      taxableIncome: 900,
      inssBase: 1400,
      deductions: [],
      incomeTax: 90,
      inssEmployee: 56,
      totalDeductions: 200,
      inssEmployer: 84,
      netPay: 1200,
      totalEmployerCost: 1484,
      ytdGrossPay: 1400,
      ytdNetPay: 1200,
      ytdIncomeTax: 90,
      ytdINSSEmployee: 56,
      ytdSickDaysUsed: 0,
      paymentMethod: "bank_transfer",
    } as unknown as TLPayrollRecord;

    const entry = buildJournalEntry(tlRun, [tlRecord], getDefaultMappings(), options);
    expect(entry.totalDebits).toBe(entry.totalCredits);
    // gross 1400 + employer INSS 84.
    expect(entry.totalDebits).toBe(1484);
  });
});
