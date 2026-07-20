/**
 * GOLDEN MONTH — the strongest evidence class we have.
 *
 * One real Timor-Leste client-month (de-identified) whose THREE government
 * filings were recovered together from the firm's corpus and reconcile to the
 * cent: the payroll workbook, the INSS DR (declaração de remunerações), and the
 * ATTL Consolidated Monthly Taxes Form actually submitted. This test feeds that
 * month's per-employee figures through Xefe's OWN filing + journal builders and
 * proves Xefe assembles the exact paperwork the professionals filed:
 *
 *   frozen records  ->  ATTL WIT return   (buildMonthlyWITReturn)
 *                   ->  INSS DR return     (buildMonthlyINSSReturn)
 *                   ->  payroll GL journal (buildPayrollJournalLines)
 *   ... every total compared cell-by-cell against the FILED documents.
 *
 * Scope note (honesty): this reconciles the FILING + JOURNAL layer against the
 * real filed docs — the gap nothing else covered in one pass. The engine's
 * per-employee computation is proven separately (real-firm-payroll-parity,
 * the four ATTL assessment notices, and pipeline-reconciliation.test.ts). This
 * month's workbook computes ordinary pay as hours×rounded-rate rather than the
 * engine's base−absence model, so the two rounding conventions are not
 * cent-identical per employee — which is exactly why this test asserts the
 * filing layer against the filed numbers, not an engine replay.
 *
 * Pure vitest — no emulator, no Firebase.
 */
import { describe, expect, it } from 'vitest';
import { sumMoney, subtractMoney, roundMoney } from '@/lib/currency';
import {
  buildMonthlyWITReturn,
  buildMonthlyINSSReturn,
  type StatutoryEmployeeMaster,
  type TaxablePayrollRecord,
} from '@/lib/tax/statutory-returns';
import { requireStatutoryEmployerIdentity } from '@/lib/tax/statutory-payroll-record';
import {
  buildPayrollJournalLines,
  type AccountResolver,
  type PayrollJournalSummary,
} from '@/lib/accounting/calculations';
import {
  goldenMonthEmployees,
  FILED_TOTALS,
  GOLDEN_MONTH_PERIOD,
  type GoldenMonthEmployee,
} from './fixtures/golden-month-june';

const RESIDENT_WIT_THRESHOLD = 500; // Lei 8/2008 — resident $500/month exemption

/**
 * Freeze the firm's filed per-employee figures into a payroll record, exactly
 * as a Xefe payroll run would have stored them. The INSS base is ordinary pay
 * (what the DR declares); gross + WIT use full pay.
 */
function toRecord(e: GoldenMonthEmployee): TaxablePayrollRecord {
  const witTaxableAmount = e.isResident
    ? Math.max(0, roundMoney(subtractMoney(e.filedGross, RESIDENT_WIT_THRESHOLD)))
    : e.filedGross; // non-resident: flat 10% from the first dollar
  const earnings = [
    { type: 'regular', amount: e.filedOrdinary },
    ...(e.filedOvertime > 0 ? [{ type: 'overtime', amount: e.filedOvertime }] : []),
    ...(e.filedHoliday > 0 ? [{ type: 'holiday', amount: e.filedHoliday }] : []),
    ...(e.filedAnnualLeave > 0 ? [{ type: 'allowance', amount: e.filedAnnualLeave }] : []),
  ];
  return {
    employeeId: e.id,
    grossWages: e.filedGross,
    wagesPaid: e.filedGross,
    taxableIncome: e.filedGross,
    witTaxableAmount,
    inssBase: e.filedInssBase,
    contributionBase: e.filedInssBase,
    annualSubsidy: 0,
    incomeTax: e.filedWit,
    inssEmployee: e.filedInssEmployee,
    inssEmployer: e.filedInssEmployer,
    netPay: e.filedNet,
    isResident: e.isResident,
    earnings,
    deductions: [],
    hourlyRate: roundMoney(e.filedInssBase / 240),
  };
}

function makeEmployee(e: GoldenMonthEmployee): StatutoryEmployeeMaster {
  return {
    id: e.id,
    personalInfo: { firstName: 'Worker', lastName: e.id },
    documents: { socialSecurityNumber: { number: `NISS-${e.id}` } },
    jobDetails: { hireDate: '2019-01-01' }, // before the period → full-month days
    status: 'active',
  };
}

// --- run the whole filing chain ONCE against the golden month ---
const employer = requireStatutoryEmployerIdentity({
  tinNumber: 'TIN-GOLDEN-0001',
  legalName: 'Golden-Month Client Lda',
  registeredAddress: 'Dili, Timor-Leste',
});
const records = goldenMonthEmployees.map(toRecord);
const employees = goldenMonthEmployees.map(makeEmployee);
const recordById = new Map(records.map((r) => [r.employeeId, r]));

const witReturn = buildMonthlyWITReturn(records, employees, employer, GOLDEN_MONTH_PERIOD);
const inssReturn = buildMonthlyINSSReturn(records, employees, new Map(), employer, GOLDEN_MONTH_PERIOD);

const journalSummary: PayrollJournalSummary = {
  totalGrossPay: sumMoney(records.map((r) => r.wagesPaid ?? 0)),
  totalINSSEmployer: sumMoney(records.map((r) => r.inssEmployer ?? 0)),
  totalIncomeTax: sumMoney(records.map((r) => r.incomeTax ?? 0)),
  totalINSSEmployee: sumMoney(records.map((r) => r.inssEmployee ?? 0)),
  totalNetPay: sumMoney(records.map((r) => r.netPay ?? 0)),
};
const resolve: AccountResolver = (code) => ({ id: `acct-${code}`, name: `Account ${code}` });
const journal = buildPayrollJournalLines(journalSummary, resolve);
const creditByCode = (code: string) =>
  sumMoney(journal.lines.filter((l) => l.accountCode === code).map((l) => l.credit));
const debitByCode = (code: string) =>
  sumMoney(journal.lines.filter((l) => l.accountCode === code).map((l) => l.debit));

describe('Golden month — Xefe reproduces the filed government paperwork', () => {
  it('fixture faithfully represents the filed month (sanity: sums == filed totals)', () => {
    expect(records).toHaveLength(FILED_TOTALS.workers);
    expect(sumMoney(records.map((r) => r.grossWages ?? 0))).toBe(FILED_TOTALS.grossWages);
    expect(sumMoney(records.map((r) => r.inssBase ?? 0))).toBe(FILED_TOTALS.inssDeclaredBase);
  });

  // ---- ATTL WIT form ----
  describe('ATTL WIT return == filed form', () => {
    it('total gross wages == filed 5488.08', () => {
      expect(witReturn.totalGrossWages).toBe(FILED_TOTALS.grossWages);
    });
    it('total WIT withheld == filed 300.00 (6 non-residents × 10% × $500)', () => {
      expect(witReturn.totalWITWithheld).toBe(FILED_TOTALS.witWithheld);
    });
    it('files all workers; residency split is 13 resident / 6 non-resident', () => {
      expect(witReturn.totalEmployees).toBe(FILED_TOTALS.workers);
      expect(witReturn.totalNonResidentEmployees).toBe(6);
      expect(witReturn.totalResidentEmployees).toBe(13);
    });
    it('each employee WIT row ties back to the filed figures', () => {
      for (const emp of witReturn.employees) {
        const e = goldenMonthEmployees.find((g) => g.id === emp.employeeId)!;
        expect(emp.grossWages, `gross ${emp.employeeId}`).toBe(e.filedGross);
        expect(emp.witWithheld, `WIT ${emp.employeeId}`).toBe(e.filedWit);
      }
    });
  });

  // ---- INSS DR (declaração de remunerações) ----
  describe('INSS DR == filed declaration', () => {
    it('declared base == filed 5224.69 (ORDINARY pay — NOT gross 5488.08)', () => {
      expect(inssReturn.totalContributionBase).toBe(FILED_TOTALS.inssDeclaredBase);
      expect(inssReturn.totalContributionBase).not.toBe(FILED_TOTALS.grossWages);
    });
    it('employee 4% total == filed 208.98', () => {
      expect(inssReturn.totalEmployeeContributions).toBe(FILED_TOTALS.inssEmployee);
    });
    it('employer 6% total == filed 313.48', () => {
      expect(inssReturn.totalEmployerContributions).toBe(FILED_TOTALS.inssEmployer);
    });
    it('10% grand total == filed 522.46 and all workers declared', () => {
      expect(inssReturn.totalContributions).toBe(
        roundMoney(FILED_TOTALS.inssEmployee + FILED_TOTALS.inssEmployer),
      );
      expect(inssReturn.totalEmployees).toBe(FILED_TOTALS.workers);
    });
    it('each employee DR row declares its ordinary base + 4%/6% from the filed docs', () => {
      for (const emp of inssReturn.employees) {
        const e = goldenMonthEmployees.find((g) => g.id === emp.employeeId)!;
        expect(emp.contributionBase, `base ${emp.employeeId}`).toBe(e.filedInssBase);
        expect(emp.employeeContribution, `4% ${emp.employeeId}`).toBe(e.filedInssEmployee);
        expect(emp.employerContribution, `6% ${emp.employeeId}`).toBe(e.filedInssEmployer);
      }
    });
  });

  // ---- Payroll GL journal ----
  describe('payroll journal balances and cross-ties to the filings', () => {
    it('debits == credits (balanced double entry)', () => {
      expect(journal.totalDebit).toBe(journal.totalCredit);
    });
    it('wage expense (5110 debit) == gross wages == ATTL total gross', () => {
      expect(debitByCode('5110')).toBe(FILED_TOTALS.grossWages);
      expect(debitByCode('5110')).toBe(witReturn.totalGrossWages);
    });
    it('net-pay payable == filed net 4979.10', () => {
      expect(creditByCode('2210')).toBe(FILED_TOTALS.netPay);
    });
    it('WIT payable credit == ATTL WIT withheld == 300.00', () => {
      expect(creditByCode('2220')).toBe(FILED_TOTALS.witWithheld);
      expect(creditByCode('2220')).toBe(witReturn.totalWITWithheld);
    });
    it('INSS-employee payable credit == DR 4% == 208.98', () => {
      expect(creditByCode('2230')).toBe(FILED_TOTALS.inssEmployee);
      expect(creditByCode('2230')).toBe(inssReturn.totalEmployeeContributions);
    });
    it('INSS-employer payable credit == DR 6% == 313.48', () => {
      expect(creditByCode('2240')).toBe(FILED_TOTALS.inssEmployer);
      expect(creditByCode('2240')).toBe(inssReturn.totalEmployerContributions);
    });
  });

  // ---- the whole-chain identity ----
  it('the filed month closes: gross − WIT − employee INSS == net (to the cent)', () => {
    const derivedNet = subtractMoney(
      FILED_TOTALS.grossWages,
      FILED_TOTALS.witWithheld,
      FILED_TOTALS.inssEmployee,
    );
    expect(derivedNet).toBe(FILED_TOTALS.netPay);
    expect(sumMoney(records.map((r) => r.netPay ?? 0))).toBe(FILED_TOTALS.netPay);
  });
});
