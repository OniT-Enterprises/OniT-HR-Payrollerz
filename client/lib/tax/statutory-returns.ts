/**
 * Pure, Firebase-free aggregation of paid payroll records into the statutory
 * monthly returns Xefe files: the ATTL Wage Income Tax (WIT) return and the
 * INSS Declaração de Remunerações (DR).
 *
 * Extracted verbatim from taxFilingService so the records -> return arithmetic
 * is unit-testable without Firestore (CI runs with no VITE_FIREBASE_* env). The
 * service now only fetches the paid runs, records, employee master rows and
 * approved parental leave, then calls these builders — the per-employee maps,
 * strict requireStatutoryPayroll* readers, money math and rounding live here
 * unchanged, so the builder output is byte-identical to the old inline code.
 *
 * NOTE ON SIGNATURE: the returns need employee-master fields the payroll record
 * does not carry (WIT/INSS full names, the INSS/NISS number, hire/termination
 * dates for the DR day columns) and, for the DR, approved parental leave. Those
 * are Firestore-sourced, so the service resolves them and passes them in as
 * plain data — this module stays Firebase-free and the math stays pure.
 */

import { addMoney, roundMoney } from '@/lib/currency';
import type {
  MonthlyINSSEmployeeRecord,
  MonthlyINSSReturn,
  MonthlyWITEmployeeRecord,
  MonthlyWITReturn,
} from '@/types/tax-filing';
import {
  calculateContractDaysInMonth,
  calculateParentalLeaveDaysInMonth,
  calculateUnjustifiedAbsenceDays,
  deriveAbsenceHoursFromDeduction,
  type ParentalLeaveInterval,
} from './inss-declaration-days';
import {
  MissingStatutoryPayrollDataError,
  requireStatutoryPayrollAmount,
  requireStatutoryPayrollEmployeeId,
  requireStatutoryPayrollResidency,
  requireStatutoryText,
  withStatutoryEmployeeContext,
  type TLStatutoryEmployerIdentity,
  type TLStatutoryPayrollRecord,
} from './statutory-payroll-record';

/**
 * A paid payroll record as read by the statutory filing generators. Extends the
 * strict-reader record shape with the earnings/deductions/hourlyRate the INSS DR
 * needs to recover the subsídio-anual split and unpaid-absence hours.
 */
export interface TaxablePayrollRecord extends TLStatutoryPayrollRecord {
  id?: string;
  payrollRunId?: string;
  earnings?: { type?: string; amount?: number }[];
  // Used to recover unpaid-absence hours for the INSS DR day declarations:
  // the persisted record stores no absenceHours, only the 'absence' deduction
  // amount (= hourlyRate × absenceHours) alongside the record's hourlyRate.
  deductions?: { type?: string; amount?: number }[];
  hourlyRate?: number;
}

/**
 * The subset of employee master data the statutory returns read. Kept as a
 * minimal structural shape so this module never imports the Firebase-backed
 * employeeService; the real Employee type is assignable to it.
 */
export interface StatutoryEmployeeMaster {
  id?: string;
  personalInfo: { firstName: string; lastName: string };
  documents?: { socialSecurityNumber?: { number?: string } };
  jobDetails?: { hireDate?: string };
  status?: string;
  terminationDate?: string;
}

function assertEmployeeMasterCoverage(
  expectedEmployeeIds: Iterable<string>,
  employees: StatutoryEmployeeMaster[],
): void {
  const found = new Set(
    employees.map((employee) => employee.id).filter((id): id is string => typeof id === 'string' && id.length > 0)
  );
  for (const employeeId of expectedEmployeeIds) {
    if (!found.has(employeeId)) {
      throw new MissingStatutoryPayrollDataError('matching employee master data');
    }
  }
}

// ============================================
// MONTHLY WIT RETURN
// ============================================

/**
 * Aggregate paid payroll records into a monthly ATTL WIT return. `employees`
 * are the employee-master rows for the records' employees (in the order the
 * caller resolved them — that order drives the return's employee list).
 */
export function buildMonthlyWITReturn(
  records: TaxablePayrollRecord[],
  employees: StatutoryEmployeeMaster[],
  employer: TLStatutoryEmployerIdentity,
  period: string
): MonthlyWITReturn {
  const totalsByEmployee = new Map<
    string,
    {
      grossWages: number;
      taxableWages: number;
      witWithheld: number;
      isResident: boolean;
    }
  >();
  records.forEach((rec) => {
    const recLabel = typeof rec.employeeId === 'string' ? rec.employeeId : undefined;
    const { employeeId, isResident, wagesPaid, witTaxableAmount, witWithheld } =
      withStatutoryEmployeeContext(recLabel, () => ({
        employeeId: requireStatutoryPayrollEmployeeId(rec),
        isResident: requireStatutoryPayrollResidency(rec),
        wagesPaid: requireStatutoryPayrollAmount(rec, 'wagesPaid'),
        witTaxableAmount: requireStatutoryPayrollAmount(rec, 'witTaxableAmount'),
        witWithheld: requireStatutoryPayrollAmount(rec, 'incomeTax'),
      }));
    const existing = totalsByEmployee.get(employeeId);
    if (existing && existing.isResident !== isResident) {
      throw new MissingStatutoryPayrollDataError('a consistent isResident classification within the filing period');
    }
    const accumulated = existing || {
      grossWages: 0,
      taxableWages: 0,
      witWithheld: 0,
      isResident,
    };
    totalsByEmployee.set(employeeId, {
      grossWages: addMoney(accumulated.grossWages, wagesPaid),
      taxableWages: addMoney(accumulated.taxableWages, witTaxableAmount),
      witWithheld: addMoney(accumulated.witWithheld, witWithheld),
      isResident,
    });
  });

  assertEmployeeMasterCoverage(totalsByEmployee.keys(), employees);

  // Build employee records
  const employeeRecords: MonthlyWITEmployeeRecord[] = [];
  let totalGrossWages = 0;
  let totalTaxableWages = 0;
  let totalWITWithheld = 0;
  let residentCount = 0;
  let nonResidentCount = 0;

  for (const employee of employees) {
    const totals = employee.id ? totalsByEmployee.get(employee.id) : null;
    if (!totals) {
      throw new MissingStatutoryPayrollDataError('matching employee master data');
    }
    const grossWages = totals.grossWages;
    const witWithheld = totals.witWithheld;
    if (grossWages === 0) continue; // Skip employees with no pay this period

    const isResident = totals.isResident;
    const taxableWages = totals.taxableWages;

    employeeRecords.push({
      employeeId: employee.id!,
      fullName: `${requireStatutoryText(employee.personalInfo.firstName, 'employee first name')} ${requireStatutoryText(employee.personalInfo.lastName, 'employee last name')}`,
      tinNumber: undefined, // TL employees typically don't have individual TINs
      isResident,
      grossWages: roundMoney(grossWages),
      taxableWages,
      witWithheld: roundMoney(witWithheld),
    });

    totalGrossWages = addMoney(totalGrossWages, grossWages);
    totalTaxableWages = addMoney(totalTaxableWages, taxableWages);
    totalWITWithheld = addMoney(totalWITWithheld, witWithheld);

    if (isResident) {
      residentCount++;
    } else {
      nonResidentCount++;
    }
  }

  // Calculate period dates
  const [year, month] = period.split('-').map(Number);
  const periodStartDate = `${period}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEndDate = `${period}-${lastDay}`;

  return {
    ...employer,
    reportingPeriod: period,
    periodStartDate,
    periodEndDate,
    totalEmployees: employeeRecords.length,
    totalResidentEmployees: residentCount,
    totalNonResidentEmployees: nonResidentCount,
    totalGrossWages: roundMoney(totalGrossWages),
    totalTaxableWages: roundMoney(totalTaxableWages),
    totalWITWithheld: roundMoney(totalWITWithheld),
    employees: employeeRecords,
  };
}

// ============================================
// MONTHLY INSS RETURN (Declaração de Remunerações)
// ============================================

/**
 * Aggregate paid payroll records into a monthly INSS DR. `employees` are the
 * employee-master rows (in resolved order — drives the return's employee list);
 * `parentalLeavesByEmployee` are approved maternity/paternity intervals
 * overlapping the DR month, keyed by employeeId, for the Art. 12 day columns.
 */
export function buildMonthlyINSSReturn(
  records: TaxablePayrollRecord[],
  employees: StatutoryEmployeeMaster[],
  parentalLeavesByEmployee: Map<string, ParentalLeaveInterval[]>,
  employer: TLStatutoryEmployerIdentity,
  period: string
): MonthlyINSSReturn {
  const totalsByEmployee = new Map<
    string,
    {
      grossWages: number;
      employeeINSS: number;
      employerINSS: number;
      contributionBase: number;
      incomeTax: number;
      annualSubsidy: number;
      netPay: number;
      isResident: boolean;
      absenceHours: number;
    }
  >();
  records.forEach((rec) => {
    const recLabel = typeof rec.employeeId === 'string' ? rec.employeeId : undefined;
    const { employeeId, isResident, employeeINSS, employerINSS, contributionBase, annualSubsidy } =
      withStatutoryEmployeeContext(recLabel, () => {
        if (!Array.isArray(rec.earnings)) {
          throw new MissingStatutoryPayrollDataError('earnings');
        }
        return {
          employeeId: requireStatutoryPayrollEmployeeId(rec),
          isResident: requireStatutoryPayrollResidency(rec),
          employeeINSS: requireStatutoryPayrollAmount(rec, 'inssEmployee'),
          employerINSS: requireStatutoryPayrollAmount(rec, 'inssEmployer'),
          contributionBase: requireStatutoryPayrollAmount(rec, 'inssBase'),
          annualSubsidy: rec.earnings
            .filter((e) => e?.type === 'subsidio_anual')
            .reduce((sum, earning) => {
              if (typeof earning.amount !== 'number' || !Number.isFinite(earning.amount) || earning.amount < 0) {
                throw new MissingStatutoryPayrollDataError('subsidio_anual earning amount');
              }
              return addMoney(sum, earning.amount);
            }, 0),
        };
      });

    const existing = totalsByEmployee.get(employeeId);
    if (existing && existing.isResident !== isResident) {
      throw new MissingStatutoryPayrollDataError('a consistent isResident classification within the filing period');
    }
    const accumulated = existing || {
      grossWages: 0,
      employeeINSS: 0,
      employerINSS: 0,
      contributionBase: 0,
      incomeTax: 0,
      annualSubsidy: 0,
      netPay: 0,
      isResident,
      absenceHours: 0,
    };

    const { wagesPaid, incomeTaxAmount, netPayAmount } = withStatutoryEmployeeContext(recLabel, () => ({
      wagesPaid: requireStatutoryPayrollAmount(rec, 'wagesPaid'),
      incomeTaxAmount: requireStatutoryPayrollAmount(rec, 'incomeTax'),
      netPayAmount: requireStatutoryPayrollAmount(rec, 'netPay'),
    }));

    // Unpaid-absence hours for the DR "Faltas Injustificadas" column.
    // The saved record persists only the 'absence' deduction amount
    // (= hourlyRate × absenceHours) plus hourlyRate, so hours are recovered
    // by division. No absence line (or no usable rate) → 0 hours.
    const absenceDeductionTotal = Array.isArray(rec.deductions)
      ? rec.deductions
          .filter((d) => d?.type === 'absence')
          .reduce((sum, d) => addMoney(sum, typeof d.amount === 'number' ? d.amount : 0), 0)
      : 0;
    const recordAbsenceHours = deriveAbsenceHoursFromDeduction(absenceDeductionTotal, rec.hourlyRate);

    totalsByEmployee.set(employeeId, {
      grossWages: addMoney(accumulated.grossWages, wagesPaid),
      employeeINSS: addMoney(accumulated.employeeINSS, employeeINSS),
      employerINSS: addMoney(accumulated.employerINSS, employerINSS),
      contributionBase: addMoney(accumulated.contributionBase, contributionBase),
      incomeTax: addMoney(accumulated.incomeTax, incomeTaxAmount),
      annualSubsidy: addMoney(accumulated.annualSubsidy, annualSubsidy),
      netPay: addMoney(accumulated.netPay, netPayAmount),
      isResident,
      absenceHours: accumulated.absenceHours + recordAbsenceHours,
    });
  });

  assertEmployeeMasterCoverage(totalsByEmployee.keys(), employees);

  const [year, month] = period.split('-').map(Number);
  const periodStartDate = `${period}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEndDate = `${period}-${lastDay}`;

  const employeeRecords: MonthlyINSSEmployeeRecord[] = [];
  let totalContributionBase = 0;
  let totalEmployeeContributions = 0;
  let totalEmployerContributions = 0;

  for (const employee of employees) {
    if (!employee.id) {
      throw new MissingStatutoryPayrollDataError('matching employee master data');
    }

    const totals = totalsByEmployee.get(employee.id);
    if (!totals) {
      throw new MissingStatutoryPayrollDataError('matching employee payroll totals');
    }

    const employeeContribution = roundMoney(totals.employeeINSS);
    const employerContribution = roundMoney(totals.employerINSS);
    const contributionBase = roundMoney(totals.contributionBase);
    const totalContribution = addMoney(employeeContribution, employerContribution);

    if (employeeContribution === 0 && employerContribution === 0) continue;

    const grossWages = roundMoney(totals.grossWages);
    const incomeTax = roundMoney(totals.incomeTax);

    // DL 20/2017 Art. 12 day declarations: 30 only when the contract covers
    // the whole month; prorated for a mid-month hire/termination. A lingering
    // terminationDate on a rehired (non-terminated) employee is ignored —
    // same guard the annual WIT return uses.
    const contractDays = calculateContractDaysInMonth(
      period,
      employee.jobDetails?.hireDate,
      employee.status === 'terminated' ? employee.terminationDate : undefined
    );
    const unjustifiedAbsenceDays = calculateUnjustifiedAbsenceDays(totals.absenceHours, contractDays);
    const parentalLeaveDays = calculateParentalLeaveDaysInMonth(
      period,
      parentalLeavesByEmployee.get(employee.id) || []
    );

    employeeRecords.push({
      employeeId: employee.id,
      fullName: `${requireStatutoryText(employee.personalInfo.firstName, 'employee first name')} ${requireStatutoryText(employee.personalInfo.lastName, 'employee last name')}`,
      inssNumber: requireStatutoryText(
        employee.documents?.socialSecurityNumber?.number,
        'employee INSS/NISS number'
      ),
      contributionBase,
      employeeContribution,
      employerContribution,
      totalContribution,
      grossWages,
      annualSubsidy: roundMoney(totals.annualSubsidy),
      incomeTax,
      netPay: roundMoney(totals.netPay),
      isResident: totals.isResident,
      contractDays,
      unjustifiedAbsenceDays,
      parentalLeaveDays,
      // Worker NIF/TIN: the employee master carries no TIN field, so the DR
      // column stays blank rather than inventing a value.
    });

    totalContributionBase = addMoney(totalContributionBase, contributionBase);
    totalEmployeeContributions = addMoney(totalEmployeeContributions, employeeContribution);
    totalEmployerContributions = addMoney(totalEmployerContributions, employerContribution);
  }

  const totalContributions = addMoney(totalEmployeeContributions, totalEmployerContributions);

  return {
    ...employer,
    reportingPeriod: period,
    periodStartDate,
    periodEndDate,
    totalEmployees: employeeRecords.length,
    totalContributionBase: roundMoney(totalContributionBase),
    totalEmployeeContributions: roundMoney(totalEmployeeContributions),
    totalEmployerContributions: roundMoney(totalEmployerContributions),
    totalContributions: roundMoney(totalContributions),
    employees: employeeRecords,
  };
}
