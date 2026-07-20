/**
 * Payroll pipeline reconciliation.
 *
 * Everywhere else these stages are proven in isolation. This test pushes ONE
 * de-identified firm dataset through the WHOLE chain in a single pass and proves
 * the paperwork agrees with itself and with the firm:
 *
 *   engine (calculateTLPayroll)
 *     -> frozen PayrollRecord (as usePayrollCalculator.buildPayrollRecords writes it)
 *       -> ATTL monthly WIT return   (buildMonthlyWITReturn)
 *       -> INSS DR return            (buildMonthlyINSSReturn)
 *       -> payroll GL journal        (buildPayrollJournalLines)
 *
 * Pure vitest — no emulator, no Firebase. The input is the real de-identified
 * firm workpaper fixture; a rich subset (overtime, holiday, unpaid absence,
 * non-resident/INSS-exempt, subsídio anual, WIT above and below the resident
 * $500 threshold) is treated as ONE month.
 */
import { describe, expect, it } from 'vitest';
import {
  calculateHourlyRate,
  calculateTLPayroll,
  type TLPayrollCalculationConfig,
  type TLPayrollInput,
  type TLPayrollResult,
} from '@/lib/payroll/calculations-tl';
import { addMoney, roundMoney, subtractMoney, sumMoney } from '@/lib/currency';
import {
  buildMonthlyINSSReturn,
  buildMonthlyWITReturn,
  type StatutoryEmployeeMaster,
} from '@/lib/tax/statutory-returns';
import { requireStatutoryEmployerIdentity } from '@/lib/tax/statutory-payroll-record';
import {
  buildPayrollJournalLines,
  type AccountResolver,
  type PayrollJournalSummary,
} from '@/lib/accounting/calculations';
import { summarizePayrollForAccounting } from '@/lib/payroll/accounting-summary';
import type { PayrollRecord } from '@/types/payroll';
import {
  deidentifiedFirmPayrollCases,
  type DeidentifiedFirmPayrollCase,
} from './fixtures/deidentified-firm-payroll';

// ---------------------------------------------------------------------------
// Engine input — same accounting-workpaper convention the parity test uses.
// ---------------------------------------------------------------------------

const SOURCE_WORKPAPER_CONFIG = {
  hourlyRate: { monthlyHoursDivisor: 190, rounding: 'up' },
  overtime: { standard: 1.5, sundayHoliday: 2, rounding: 'aggregate' },
} satisfies TLPayrollCalculationConfig;

const PERIOD = '2025-06'; // a full calendar month
const PIPELINE_RUN_ID = 'pipeline-run-2025-06';
const TENANT_ID = 'pipeline-tenant';

/**
 * The subset pushed through the pipeline, chosen for breadth. All rows have
 * absenceDays === 0, so the engine reproduces the firm's displayed cents (the
 * parity suite proves this) — keeping the firm comparison meaningful. Coverage:
 *   - resident, OT + holiday, WIT nil (below $500):           firm-period-1-01
 *   - resident, OT + holiday, unpaid absence, WIT nil:        firm-period-1-02
 *   - resident, WIT above threshold:                          firm-period-1-06, 1-13
 *   - non-resident, INSS-exempt, flat 10% WIT, no INSS:       firm-period-1-29, 1-30, 3-28
 *   - resident, heavy holiday hours + absence:                firm-period-2-05, 2-10
 *   - resident, subsídio anual + WIT:                         firm-period-3-03, 3-06, 3-12
 * firm-period-3-12 is a known engine-vs-firm 1-cent WIT case (see
 * FIRM_CENT_DIFFERENCES) — deliberately included so the firm reconciliation
 * exercises, rather than hides, the allowance.
 */
const SELECTED_CASE_IDS = [
  'firm-period-1-01',
  'firm-period-1-02',
  'firm-period-1-06',
  'firm-period-1-13',
  'firm-period-1-29',
  'firm-period-1-30',
  'firm-period-2-05',
  'firm-period-2-10',
  'firm-period-3-03',
  'firm-period-3-06',
  'firm-period-3-12',
  'firm-period-3-28',
] as const;

/**
 * Engine-vs-firm displayed-cent differences, mirrored from
 * real-firm-payroll-parity.test.ts (actual = firm + diff). Only rows present in
 * SELECTED_CASE_IDS matter; the rest are carried for robustness if the subset
 * changes. Of the six known cases, only firm-period-3-12 is in this subset.
 */
const FIRM_CENT_DIFFERENCES: Record<
  string,
  Partial<Record<'grossAfterAttendance' | 'wit' | 'inssEmployee' | 'inssEmployer', number>>
> = {
  'firm-period-1-28': { grossAfterAttendance: 0.01 },
  'firm-period-3-12': { wit: 0.01 },
  // firm-period-2-12/2-13/3-02/3-14 differ only on `net`, which is not compared
  // against firm figures here, so they carry no gross/WIT/INSS allowance.
};

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

// The engine earning types the frozen record keeps verbatim; the rest collapse
// to 'allowance' or 'other' — copied 1:1 from usePayrollCalculator.
const DIRECT_EARNING_TYPES = new Set([
  'regular', 'overtime', 'double_time', 'holiday', 'night_shift', 'rest_day',
  'sick_pay', 'bonus', 'subsidio_anual', 'service_compensation',
  'non_cash_benefit', 'commission', 'tip', 'reimbursement', 'allowance',
]);
const ALLOWANCE_EARNING_TYPES = new Set([
  'per_diem', 'food_allowance', 'transport_allowance', 'housing_allowance', 'travel_allowance',
]);

function mapEarningType(type: string): PayrollRecord['earnings'][number]['type'] {
  return (DIRECT_EARNING_TYPES.has(type)
    ? type
    : ALLOWANCE_EARNING_TYPES.has(type)
      ? 'allowance'
      : 'other') as PayrollRecord['earnings'][number]['type'];
}

/**
 * Freeze an engine result into a PayrollRecord — mirrors buildPayrollRecords
 * field copies in client/hooks/usePayrollCalculator.ts (lines ~1373-1470). Only
 * the filing/journal-relevant fields carry real values; the rest are the same
 * denormalized snapshot the hook writes. (Does NOT refactor the hook.)
 */
function resultToRecord(
  result: TLPayrollResult,
  caseId: string,
  isResident: boolean,
  monthlySalary: number,
): PayrollRecord {
  return {
    payrollRunId: PIPELINE_RUN_ID,
    tenantId: TENANT_ID,
    employeeId: caseId,
    employeeName: `Worker ${caseId}`,
    employeeNumber: caseId,
    department: '',
    position: '',
    isResident,
    regularHours: 190,
    overtimeHours: 0,
    doubleTimeHours: 0,
    holidayHours: 0,
    ptoHoursUsed: 0,
    sickHoursUsed: 0,
    hourlyRate: calculateHourlyRate(monthlySalary, SOURCE_WORKPAPER_CONFIG.hourlyRate),
    overtimeRate: SOURCE_WORKPAPER_CONFIG.overtime.standard,
    earnings: result.earnings.map((earning) => ({
      type: mapEarningType(earning.type),
      description: earning.description,
      hours: earning.hours,
      rate: earning.rate,
      amount: earning.amount,
    })),
    totalGrossPay: result.grossPay,
    wagesPaid: result.wagesPaid,
    taxableIncome: result.taxableIncome,
    witTaxableAmount: result.witTaxableAmount,
    inssBase: result.inssBase,
    incomeTax: result.incomeTax,
    inssEmployee: result.inssEmployee,
    inssEmployer: result.inssEmployer,
    deductions: result.deductions.map((deduction) => ({
      type: deduction.type as PayrollRecord['deductions'][number]['type'],
      description: deduction.description,
      amount: deduction.amount,
      isPreTax: false,
      isPercentage: false,
    })),
    totalDeductions: result.totalDeductions,
    employerContributions: [],
    totalEmployerContributions: 0,
    employerTaxes: [
      { type: 'inss_employer', description: 'INSS employer contribution', amount: result.inssEmployer },
    ],
    totalEmployerTaxes: result.inssEmployer,
    netPay: result.netPay,
    totalEmployerCost: result.totalEmployerCost,
    ytdGrossPay: result.newYtdGrossPay,
    ytdNetPay: result.netPay,
    ytdIncomeTax: result.newYtdIncomeTax,
    ytdINSSEmployee: result.newYtdINSSEmployee,
  };
}

function makeEmployee(caseId: string): StatutoryEmployeeMaster {
  return {
    id: caseId,
    personalInfo: { firstName: 'Worker', lastName: caseId },
    documents: { socialSecurityNumber: { number: `NISS-${caseId}` } },
    jobDetails: { hireDate: '2000-01-01' },
    status: 'active',
  };
}

// ---------------------------------------------------------------------------
// Run the whole chain ONCE, then assert every hop reconciles.
// ---------------------------------------------------------------------------

const caseById = new Map(deidentifiedFirmPayrollCases.map((c) => [c.caseId, c]));
const cases: DeidentifiedFirmPayrollCase[] = SELECTED_CASE_IDS.map((id) => {
  const c = caseById.get(id);
  if (!c) throw new Error(`Fixture case ${id} not found`);
  return c;
});

const employer = requireStatutoryEmployerIdentity({
  tinNumber: 'TIN-DEMO-0001',
  legalName: 'De-identified Firm Lda',
  registeredAddress: 'Dili, Timor-Leste',
});

const records: PayrollRecord[] = cases.map((c) =>
  resultToRecord(
    calculateTLPayroll(toPayrollInput(c), SOURCE_WORKPAPER_CONFIG),
    c.caseId,
    c.resident,
    c.monthlySalary,
  ),
);
const employees = cases.map((c) => makeEmployee(c.caseId));
const recordById = new Map(records.map((r) => [r.employeeId, r]));

const witReturn = buildMonthlyWITReturn(records, employees, employer, PERIOD);
const inssReturn = buildMonthlyINSSReturn(records, employees, new Map(), employer, PERIOD);

// The journal summary the payroll run hands accounting — built from the frozen
// record aggregates exactly as createFromPayroll does (its wage-expense basis is
// Σ wagesPaid; see summarizePayrollForAccounting / accountingService).
const journalSummary: PayrollJournalSummary = {
  totalGrossPay: sumMoney(records.map((r) => r.wagesPaid ?? 0)),
  totalINSSEmployer: sumMoney(records.map((r) => r.inssEmployer ?? 0)),
  totalIncomeTax: sumMoney(records.map((r) => r.incomeTax ?? 0)),
  totalINSSEmployee: sumMoney(records.map((r) => r.inssEmployee ?? 0)),
  totalNetPay: sumMoney(records.map((r) => r.netPay)),
};
const resolve: AccountResolver = (code) => ({ id: `acct-${code}`, name: `Account ${code}` });
const journal = buildPayrollJournalLines(journalSummary, resolve);
const creditByCode = (code: string) => journal.lines.find((l) => l.accountCode === code)?.credit ?? 0;
const debitByCode = (code: string) => journal.lines.find((l) => l.accountCode === code)?.debit ?? 0;

const sumRecords = (pick: (r: PayrollRecord) => number) => sumMoney(records.map(pick));
const within2Cents = (a: number, b: number) => Math.abs(subtractMoney(a, b)) <= 0.02;

describe('payroll pipeline reconciliation (one dataset, whole chain)', () => {
  it('freezes one record per selected fixture case', () => {
    expect(records).toHaveLength(cases.length);
    expect(new Set(records.map((r) => r.employeeId)).size).toBe(cases.length);
  });

  // -------------------------------------------------------------------------
  // WIT filing (ATTL) reconciles to the frozen records
  // -------------------------------------------------------------------------
  describe('WIT return', () => {
    it('files every paid employee (none skipped — all have wages)', () => {
      expect(witReturn.employees).toHaveLength(cases.length);
    });

    it('total gross wages == Σ frozen record wagesPaid (the field the builder aggregates)', () => {
      expect(witReturn.totalGrossWages).toBe(sumRecords((r) => r.wagesPaid ?? 0));
    });

    it('total WIT withheld == Σ frozen record incomeTax', () => {
      expect(witReturn.totalWITWithheld).toBe(sumRecords((r) => r.incomeTax ?? 0));
    });

    it('each employee row ties gross/taxable/withheld back to its frozen record', () => {
      for (const emp of witReturn.employees) {
        const rec = recordById.get(emp.employeeId);
        expect(rec, `WIT row for ${emp.employeeId} has a matching record`).toBeDefined();
        expect(emp.grossWages, `WIT grossWages ${emp.employeeId} == record wagesPaid`).toBe(
          roundMoney(rec!.wagesPaid ?? 0),
        );
        expect(emp.taxableWages, `WIT taxableWages ${emp.employeeId} == record witTaxableAmount`).toBe(
          rec!.witTaxableAmount ?? 0,
        );
        expect(emp.witWithheld, `WIT withheld ${emp.employeeId} == record incomeTax`).toBe(
          roundMoney(rec!.incomeTax ?? 0),
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  // INSS DR reconciles to the frozen records
  // -------------------------------------------------------------------------
  describe('INSS DR return', () => {
    it('declares only INSS-contributing employees (exempt non-residents dropped)', () => {
      const contributing = records.filter((r) => (r.inssEmployee ?? 0) > 0 || (r.inssEmployer ?? 0) > 0);
      expect(inssReturn.employees).toHaveLength(contributing.length);
    });

    it("each employee's declared contribution base == its frozen record inssBase", () => {
      for (const emp of inssReturn.employees) {
        const rec = recordById.get(emp.employeeId);
        expect(rec, `INSS row for ${emp.employeeId} has a matching record`).toBeDefined();
        expect(emp.contributionBase, `INSS base ${emp.employeeId} == record inssBase`).toBe(
          roundMoney(rec!.inssBase ?? 0),
        );
        expect(emp.employeeContribution, `INSS employee ${emp.employeeId} == record inssEmployee`).toBe(
          roundMoney(rec!.inssEmployee ?? 0),
        );
        expect(emp.employerContribution, `INSS employer ${emp.employeeId} == record inssEmployer`).toBe(
          roundMoney(rec!.inssEmployer ?? 0),
        );
      }
    });

    it('Σ employee INSS == Σ frozen record inssEmployee', () => {
      expect(inssReturn.totalEmployeeContributions).toBe(sumRecords((r) => r.inssEmployee ?? 0));
    });

    it('Σ employer INSS == Σ frozen record inssEmployer', () => {
      expect(inssReturn.totalEmployerContributions).toBe(sumRecords((r) => r.inssEmployer ?? 0));
    });
  });

  // -------------------------------------------------------------------------
  // Payroll GL journal balances and ties to the two filings + the records
  // -------------------------------------------------------------------------
  describe('payroll journal', () => {
    it('is balanced (total debit == total credit)', () => {
      expect(journal.totalDebit).toBe(journal.totalCredit);
    });

    it('wage-expense debit (5110) == Σ wagesPaid == WIT return total gross wages', () => {
      expect(debitByCode('5110')).toBe(journalSummary.totalGrossPay);
      expect(debitByCode('5110')).toBe(sumRecords((r) => r.wagesPaid ?? 0));
      expect(debitByCode('5110')).toBe(witReturn.totalGrossWages);
    });

    it('WIT-payable credit (2220) == WIT return total WIT withheld', () => {
      expect(creditByCode('2220')).toBe(witReturn.totalWITWithheld);
    });

    it('employee-INSS-payable credit (2230) == INSS DR employee-INSS total', () => {
      expect(creditByCode('2230')).toBe(inssReturn.totalEmployeeContributions);
    });

    it('employer-INSS-payable credit (2240) == INSS DR employer-INSS total', () => {
      expect(creditByCode('2240')).toBe(inssReturn.totalEmployerContributions);
    });

    it('net-pay credit (2210) == Σ frozen record netPay', () => {
      expect(creditByCode('2210')).toBe(sumRecords((r) => r.netPay));
    });

    it('the production accounting aggregator reproduces the same summary', () => {
      // Proves the frozen records agree with themselves: the numeric fields the
      // summary was built from equal what summarizePayrollForAccounting derives
      // from the records' typed earning/deduction lines.
      const derived = summarizePayrollForAccounting(records);
      expect(derived.totalWagesExpense).toBe(journalSummary.totalGrossPay);
      expect(derived.totalIncomeTax).toBe(journalSummary.totalIncomeTax);
      expect(derived.totalINSSEmployee).toBe(journalSummary.totalINSSEmployee);
      expect(derived.totalINSSEmployer).toBe(journalSummary.totalINSSEmployer);
      expect(derived.totalNetPay).toBe(journalSummary.totalNetPay);
      expect(derived.totalOtherDeductions).toBe(0);
      expect(derived.totalAdvanceRepayments).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // The pipeline aggregate agrees with the firm's own reported figures
  // -------------------------------------------------------------------------
  describe('firm figures', () => {
    const firmGross = sumMoney(cases.map((c) => c.expectedGross));
    const firmWit = sumMoney(cases.map((c) => c.expectedWit));
    const firmInssEmployee = sumMoney(cases.map((c) => c.expectedInssEmployee));
    const firmInssEmployer = sumMoney(cases.map((c) => c.expectedInssEmployer));

    const allowance = (component: 'grossAfterAttendance' | 'wit' | 'inssEmployee' | 'inssEmployer') =>
      sumMoney(cases.map((c) => FIRM_CENT_DIFFERENCES[c.caseId]?.[component] ?? 0));

    it('pipeline gross == firm reported gross (within 2 cents)', () => {
      expect(within2Cents(witReturn.totalGrossWages, firmGross)).toBe(true);
      // Exact once the documented engine-vs-firm cent allowance is applied.
      expect(witReturn.totalGrossWages).toBe(addMoney(firmGross, allowance('grossAfterAttendance')));
    });

    it('pipeline WIT == firm reported WIT (within 2 cents)', () => {
      expect(within2Cents(witReturn.totalWITWithheld, firmWit)).toBe(true);
      expect(witReturn.totalWITWithheld).toBe(addMoney(firmWit, allowance('wit')));
    });

    it('pipeline employee INSS == firm reported employee INSS (within 2 cents)', () => {
      expect(within2Cents(inssReturn.totalEmployeeContributions, firmInssEmployee)).toBe(true);
      expect(inssReturn.totalEmployeeContributions).toBe(addMoney(firmInssEmployee, allowance('inssEmployee')));
    });

    it('pipeline employer INSS == firm reported employer INSS (within 2 cents)', () => {
      expect(within2Cents(inssReturn.totalEmployerContributions, firmInssEmployer)).toBe(true);
      expect(inssReturn.totalEmployerContributions).toBe(addMoney(firmInssEmployer, allowance('inssEmployer')));
    });
  });
});
