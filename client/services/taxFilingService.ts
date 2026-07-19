/**
 * Tax Filing Service - ATTL Compliance
 *
 * Handles generation and tracking of:
 * - Monthly WIT (Wage Income Tax) returns
 * - Annual WIT returns
 * - Employee WIT certificates
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { employeeService, type Employee, type AuditContext } from './employeeService';
import { auditLogService } from './auditLogService';
import { payrollService } from './payrollService';
import { holidayService } from './holidayService';
import type {
  TaxFiling,
  TaxFilingTask,
  TaxFilingType,
  TaxFilingStatus,
  SubmissionMethod,
  MonthlyWITReturn,
  MonthlyWITEmployeeRecord,
  AnnualWITReturn,
  AnnualWITEmployeeRecord,
  MonthlyINSSReturn,
  MonthlyINSSEmployeeRecord,
  EmployeeWITCertificate,
  FilingDueDate,
} from '@/types/tax-filing';
import type { CompanyDetails } from '@/types/settings';
export type { TaxFilingType, MonthlyWITReturn, AnnualWITReturn, MonthlyINSSReturn, SubmissionMethod, CompanyDetails };
import { adjustToNextBusinessDayTL } from '@/lib/payroll/tl-holidays';
import { getTodayTL, parseDateISO } from '@/lib/dateUtils';
import { roundMoney, addMoney } from '@/lib/currency';
import {
  getAnnualWITDueDateBase,
  getFilingStatusFromDays,
  getMonthlyWITDueDateBase,
  resolveTaskStatus,
} from '@/lib/tax/compliance';
import {
  MissingStatutoryPayrollDataError,
  requireStatutoryEmployerIdentity,
  requireStatutoryISODate,
  requireStatutoryPayrollAmount,
  requireStatutoryPayrollEmployeeId,
  requireStatutoryPayrollResidency,
  requireStatutoryText,
  withStatutoryEmployeeContext,
  type TLStatutoryPayrollRecord,
} from '@/lib/tax/statutory-payroll-record';

// ============================================
// CONSTANTS
// ============================================

const MONTHLY_INSS_STATEMENT_DUE_DAY = 10; // remuneration statement (following month)
const MONTHLY_INSS_PAYMENT_DUE_DAY = 20; // payment window ends (following month)

// ============================================
// HELPER FUNCTIONS
// ============================================

function getMonthlyINSSStatementDueDateBase(period: string): string {
  const [year, month] = period.split('-').map(Number);
  let dueMonth = month + 1;
  let dueYear = year;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(MONTHLY_INSS_STATEMENT_DUE_DAY).padStart(2, '0')}`;
}

function getMonthlyINSSPaymentDueDateBase(period: string): string {
  const [year, month] = period.split('-').map(Number);
  let dueMonth = month + 1;
  let dueYear = year;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(MONTHLY_INSS_PAYMENT_DUE_DAY).padStart(2, '0')}`;
}

/**
 * Calculate days until due date
 */
function getDaysUntilDue(dueDate: string): number {
  const today = parseDateISO(getTodayTL());
  const due = parseDateISO(dueDate);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

interface TaxablePayrollRecord extends TLStatutoryPayrollRecord {
  id?: string;
  payrollRunId?: string;
  earnings?: { type?: string; amount?: number }[];
}

/**
 * Bulk-fetch all payroll records for a tenant in a single query,
 * then group by payrollRunId. Avoids N+1 queries when processing
 * multiple payroll runs.
 */
async function bulkFetchPayrollRecordsByTenant(
  tenantId: string,
  runIds: Set<string>
): Promise<Map<string, TaxablePayrollRecord[]>> {
  const grouped = new Map<string, TaxablePayrollRecord[]>();
  const runIdList = Array.from(runIds);

  if (runIdList.length === 0) {
    return grouped;
  }

  for (let i = 0; i < runIdList.length; i += 10) {
    const chunk = runIdList.slice(i, i + 10);
    const snapshot = await getDocs(
      query(collection(db, 'payrollRecords'), where('payrollRunId', 'in', chunk), where('tenantId', '==', tenantId))
    );

    for (const docSnap of snapshot.docs) {
      const raw = docSnap.data();
      const runId = raw.payrollRunId as string;
      if (!runId || !runIds.has(runId)) continue;

      const data = { ...raw };
      const record = {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as TaxablePayrollRecord & {
        employeeId?: string;
        payrollRunId?: string;
      };

      const existing = grouped.get(runId) || [];
      existing.push(record);
      grouped.set(runId, existing);
    }
  }

  return grouped;
}

function assertEmployeeMasterCoverage(expectedEmployeeIds: Iterable<string>, employees: Employee[]): void {
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
// TAX FILING SERVICE
// ============================================

class TaxFilingService {
  private holidayOverrideCache = new Map<
    string,
    Promise<{ additionalHolidays: Set<string>; removedHolidays: Set<string> }>
  >();

  private getHolidayOverridesForYear(tenantId: string, year: number) {
    const key = `${tenantId}:${year}`;
    const cached = this.holidayOverrideCache.get(key);
    if (cached) return cached;

    const load = holidayService.listTenantHolidayOverrides(tenantId, year).then((overrides) => {
      const additionalHolidays = new Set<string>();
      const removedHolidays = new Set<string>();

      for (const o of overrides) {
        const date = typeof o.date === 'string' ? o.date.slice(0, 10) : '';
        if (!date) continue;
        if (o.isHoliday) additionalHolidays.add(date);
        else removedHolidays.add(date);
      }

      return { additionalHolidays, removedHolidays };
    });

    this.holidayOverrideCache.set(key, load);
    return load;
  }

  private async adjustDueDateTL(isoDate: string, tenantId: string): Promise<string> {
    const normalized = isoDate.trim().slice(0, 10);
    if (!tenantId) return adjustToNextBusinessDayTL(normalized);
    const year = parseInt(normalized.slice(0, 4), 10);
    const overrides = await this.getHolidayOverridesForYear(tenantId, year);
    return adjustToNextBusinessDayTL(normalized, overrides);
  }

  private async getMonthlyWITDueDate(period: string, tenantId: string): Promise<string> {
    return this.adjustDueDateTL(getMonthlyWITDueDateBase(period), tenantId);
  }

  private async getMonthlyINSSStatementDueDate(period: string, tenantId: string): Promise<string> {
    return this.adjustDueDateTL(getMonthlyINSSStatementDueDateBase(period), tenantId);
  }

  private async getMonthlyINSSPaymentDueDate(period: string, tenantId: string): Promise<string> {
    return this.adjustDueDateTL(getMonthlyINSSPaymentDueDateBase(period), tenantId);
  }

  private async getAnnualWITDueDate(taxYear: number, tenantId: string): Promise<string> {
    return this.adjustDueDateTL(getAnnualWITDueDateBase(taxYear), tenantId);
  }

  private get collectionRef() {
    return collection(db, 'taxFilings');
  }

  // ----------------------------------------
  // GENERATE MONTHLY WIT RETURN
  // ----------------------------------------

  /**
   * Generate monthly WIT return data from payroll records
   */
  async generateMonthlyWITReturn(
    period: string,
    company: Partial<CompanyDetails>,
    tenantId: string
  ): Promise<MonthlyWITReturn> {
    const employer = requireStatutoryEmployerIdentity(company);

    // Get payroll records for this period
    const periodRuns = await payrollService.runs.getPaidPayrollRunsByPayDateRange(
      tenantId,
      `${period}-01`,
      `${period}-31`
    );

    // Bulk-fetch all payroll records for the relevant runs in a single query
    const periodRunIds = new Set(periodRuns.filter((r) => !!r.id).map((r) => r.id!));
    const recordsByRun = await bulkFetchPayrollRecordsByTenant(tenantId, periodRunIds);
    const periodRecords = Array.from(recordsByRun.values()).flat();

    const totalsByEmployee = new Map<
      string,
      {
        grossWages: number;
        taxableWages: number;
        witWithheld: number;
        isResident: boolean;
      }
    >();
    periodRecords.forEach((rec) => {
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

    const employees = await employeeService.getEmployeesByIds(tenantId, Array.from(totalsByEmployee.keys()));
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

  // ----------------------------------------
  // GENERATE ANNUAL WIT RETURN
  // ----------------------------------------

  /**
   * Generate monthly INSS return data from payroll records
   */
  async generateMonthlyINSSReturn(
    period: string,
    company: Partial<CompanyDetails>,
    tenantId: string
  ): Promise<MonthlyINSSReturn> {
    const employer = requireStatutoryEmployerIdentity(company);

    const periodRuns = await payrollService.runs.getPaidPayrollRunsByPayDateRange(
      tenantId,
      `${period}-01`,
      `${period}-31`
    );

    // Bulk-fetch all payroll records for the relevant runs in a single query
    const periodRunIds = new Set(periodRuns.filter((r) => !!r.id).map((r) => r.id!));
    const recordsByRunMap = await bulkFetchPayrollRecordsByTenant(tenantId, periodRunIds);
    const periodRecords = Array.from(recordsByRunMap.values()).flat();

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
      }
    >();
    periodRecords.forEach((rec) => {
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
      };

      const { wagesPaid, incomeTaxAmount, netPayAmount } = withStatutoryEmployeeContext(recLabel, () => ({
        wagesPaid: requireStatutoryPayrollAmount(rec, 'wagesPaid'),
        incomeTaxAmount: requireStatutoryPayrollAmount(rec, 'incomeTax'),
        netPayAmount: requireStatutoryPayrollAmount(rec, 'netPay'),
      }));
      totalsByEmployee.set(employeeId, {
        grossWages: addMoney(accumulated.grossWages, wagesPaid),
        employeeINSS: addMoney(accumulated.employeeINSS, employeeINSS),
        employerINSS: addMoney(accumulated.employerINSS, employerINSS),
        contributionBase: addMoney(accumulated.contributionBase, contributionBase),
        incomeTax: addMoney(accumulated.incomeTax, incomeTaxAmount),
        annualSubsidy: addMoney(accumulated.annualSubsidy, annualSubsidy),
        netPay: addMoney(accumulated.netPay, netPayAmount),
        isResident,
      });
    });

    const employees = await employeeService.getEmployeesByIds(tenantId, Array.from(totalsByEmployee.keys()));
    assertEmployeeMasterCoverage(totalsByEmployee.keys(), employees);

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
      });

      totalContributionBase = addMoney(totalContributionBase, contributionBase);
      totalEmployeeContributions = addMoney(totalEmployeeContributions, employeeContribution);
      totalEmployerContributions = addMoney(totalEmployerContributions, employerContribution);
    }

    const [year, month] = period.split('-').map(Number);
    const periodStartDate = `${period}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEndDate = `${period}-${lastDay}`;

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

  /**
   * Generate annual WIT return data
   */
  async generateAnnualWITReturn(
    taxYear: number,
    company: Partial<CompanyDetails>,
    tenantId: string
  ): Promise<AnnualWITReturn> {
    const employer = requireStatutoryEmployerIdentity(company);

    const yearRuns = await payrollService.runs.getPaidPayrollRunsByPayDateRange(
      tenantId,
      `${taxYear}-01-01`,
      `${taxYear}-12-31`
    );

    // Bulk-fetch all payroll records for the relevant runs in a single query
    const yearRunIds = new Set(yearRuns.filter((r) => !!r.id).map((r) => r.id!));
    const recordsByRun = await bulkFetchPayrollRecordsByTenant(tenantId, yearRunIds);

    // Build a lookup for run payDate by run ID
    const runPayDateMap = new Map(yearRuns.map((r) => [r.id!, r.payDate]));
    const employeeIds = new Set<string>();

    for (const records of recordsByRun.values()) {
      for (const record of records) {
        employeeIds.add(requireStatutoryPayrollEmployeeId(record));
      }
    }

    const employees = await employeeService.getEmployeesByIds(tenantId, Array.from(employeeIds));
    const employeesById = new Map(
      employees.filter((employee) => employee.id).map((employee) => [employee.id!, employee])
    );

    // Aggregate employee data for the year
    const employeeAggregates: Map<
      string,
      {
        employee: Employee;
        totalGrossWages: number;
        totalWIT: number;
        monthsWorked: Set<number>;
        isResident: boolean;
      }
    > = new Map();

    for (const [runId, records] of recordsByRun) {
      const payDate = requireStatutoryISODate(runPayDateMap.get(runId), 'payroll run payDate');
      const runMonth = parseInt(payDate.substring(5, 7), 10);

      for (const rec of records) {
        const employeeId = requireStatutoryPayrollEmployeeId(rec);
        const employee = employeesById.get(employeeId);
        if (!employee) {
          throw new MissingStatutoryPayrollDataError('matching employee master data');
        }
        const isResident = requireStatutoryPayrollResidency(rec);

        const existing = employeeAggregates.get(employeeId) || {
          employee,
          totalGrossWages: 0,
          totalWIT: 0,
          monthsWorked: new Set<number>(),
          isResident,
        };
        if (existing.isResident !== isResident) {
          throw new MissingStatutoryPayrollDataError('a consistent isResident classification within the tax year');
        }

        existing.totalGrossWages = addMoney(existing.totalGrossWages, requireStatutoryPayrollAmount(rec, 'wagesPaid'));
        existing.totalWIT = addMoney(existing.totalWIT, requireStatutoryPayrollAmount(rec, 'incomeTax'));
        existing.monthsWorked.add(runMonth);

        employeeAggregates.set(employeeId, existing);
      }
    }

    // Build employee records
    const employeeRecords: AnnualWITEmployeeRecord[] = [];
    let totalGrossWagesPaid = 0;
    let totalWITWithheld = 0;

    for (const [, data] of employeeAggregates) {
      const { employee, totalGrossWages, totalWIT, monthsWorked } = data;

      // Determine start/end dates if applicable
      const hireDate = requireStatutoryISODate(employee.jobDetails.hireDate, 'employment start date');
      const hireYear = Number(hireDate.slice(0, 4));
      const startDate = hireYear === taxYear ? hireDate : undefined;

      const terminationDate =
        employee.status === 'terminated'
          ? requireStatutoryISODate(employee.terminationDate, 'employment end date for terminated employee')
          : undefined;
      const endDate = terminationDate?.startsWith(`${taxYear}-`) ? terminationDate : undefined;

      employeeRecords.push({
        employeeId: employee.id!,
        fullName: `${requireStatutoryText(employee.personalInfo.firstName, 'employee first name')} ${requireStatutoryText(employee.personalInfo.lastName, 'employee last name')}`,
        tinNumber: undefined, // TL employees typically don't have individual TINs
        isResident: data.isResident,
        startDate,
        endDate,
        monthsWorked: monthsWorked.size,
        totalGrossWages: roundMoney(totalGrossWages),
        totalWITWithheld: roundMoney(totalWIT),
      });

      totalGrossWagesPaid = addMoney(totalGrossWagesPaid, totalGrossWages);
      totalWITWithheld = addMoney(totalWITWithheld, totalWIT);
    }

    return {
      ...employer,
      taxYear,
      totalEmployeesInYear: employeeRecords.length,
      totalGrossWagesPaid: roundMoney(totalGrossWagesPaid),
      totalWITWithheld: roundMoney(totalWITWithheld),
      employees: employeeRecords,
    };
  }

  // ----------------------------------------
  // GENERATE EMPLOYEE WIT CERTIFICATE
  // ----------------------------------------

  /**
   * Generate WIT certificate for a single employee
   */
  async generateEmployeeWITCertificate(
    employeeId: string,
    taxYear: number,
    company: Partial<CompanyDetails>,
    signatory: { name: string; position: string },
    tenantId: string
  ): Promise<EmployeeWITCertificate> {
    const employee = await employeeService.getEmployeeById(tenantId, employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Get annual data for this employee
    const annualReturn = await this.generateAnnualWITReturn(taxYear, company, tenantId);
    const employeeRecord = annualReturn.employees.find((e) => e.employeeId === employeeId);

    if (!employeeRecord) {
      throw new Error('No payroll records found for this employee in the specified year');
    }

    return {
      employerName: annualReturn.employerName,
      employerTIN: annualReturn.employerTIN,
      employerAddress: annualReturn.employerAddress,
      employeeId: employee.id!,
      employeeName: `${requireStatutoryText(employee.personalInfo.firstName, 'employee first name')} ${requireStatutoryText(employee.personalInfo.lastName, 'employee last name')}`,
      employeeTIN: undefined, // TL employees typically don't have individual TINs
      employeeAddress: requireStatutoryText(employee.personalInfo.address, 'employee address'),
      taxYear,
      employmentStartDate: requireStatutoryISODate(employee.jobDetails.hireDate, 'employment start date'),
      employmentEndDate: employeeRecord.endDate,
      totalGrossWages: employeeRecord.totalGrossWages,
      totalWITWithheld: employeeRecord.totalWITWithheld,
      certificationDate: getTodayTL(),
      authorizedSignatory: requireStatutoryText(signatory.name, 'authorized signatory name'),
      signatoryPosition: requireStatutoryText(signatory.position, 'authorized signatory position'),
    };
  }

  // ----------------------------------------
  // CRUD OPERATIONS
  // ----------------------------------------

  /**
   * Get all tax filings
   */
  async getAllFilings(tenantId: string, type?: TaxFilingType): Promise<TaxFiling[]> {
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      ...(type ? [where('type', '==', type)] : []),
      orderBy('period', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as TaxFiling;
    });
  }

  /**
   * Get filing by ID
   */
  async getFilingById(id: string): Promise<TaxFiling | null> {
    const docRef = doc(db, 'taxFilings', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as TaxFiling;
  }

  /**
   * Get filing by period
   */
  async getFilingByPeriod(type: TaxFilingType, period: string, tenantId: string): Promise<TaxFiling | null> {
    const q = query(
      this.collectionRef,
      where('tenantId', '==', tenantId),
      where('type', '==', type),
      where('period', '==', period)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as TaxFiling;
  }

  /**
   * Save a tax filing (create or update)
   */
  async saveFiling(
    type: TaxFilingType,
    period: string,
    dataSnapshot: MonthlyWITReturn | AnnualWITReturn | MonthlyINSSReturn,
    userId: string,
    tenantId: string,
    audit?: AuditContext
  ): Promise<string> {
    const existing = await this.getFilingByPeriod(type, period, tenantId);
    const preserveFiled = existing?.status === 'filed';

    const statementDueDate =
      type === 'inss_monthly' ? await this.getMonthlyINSSStatementDueDate(period, tenantId) : undefined;
    const paymentDueDate =
      type === 'inss_monthly' ? await this.getMonthlyINSSPaymentDueDate(period, tenantId) : undefined;
    const dueDate =
      type === 'monthly_wit'
        ? await this.getMonthlyWITDueDate(period, tenantId)
        : type === 'annual_wit'
          ? await this.getAnnualWITDueDate(parseInt(period), tenantId)
          : statementDueDate!;

    const daysUntilDue = getDaysUntilDue(dueDate);
    const status: TaxFilingStatus = preserveFiled ? 'filed' : getFilingStatusFromDays(daysUntilDue);

    const baseFilingData = {
      tenantId,
      type,
      period,
      status,
      dueDate,
      dataSnapshot,
      totalWages:
        type === 'monthly_wit'
          ? (dataSnapshot as MonthlyWITReturn).totalGrossWages
          : type === 'annual_wit'
            ? (dataSnapshot as AnnualWITReturn).totalGrossWagesPaid
            : (dataSnapshot as MonthlyINSSReturn).totalContributionBase,
      totalWITWithheld:
        type === 'monthly_wit' || type === 'annual_wit'
          ? (dataSnapshot as MonthlyWITReturn | AnnualWITReturn).totalWITWithheld
          : 0,
      employeeCount:
        type === 'monthly_wit'
          ? (dataSnapshot as MonthlyWITReturn).totalEmployees
          : type === 'annual_wit'
            ? (dataSnapshot as AnnualWITReturn).totalEmployeesInYear
            : (dataSnapshot as MonthlyINSSReturn).totalEmployees,
      updatedAt: serverTimestamp(),
    };

    const filingData =
      type === 'inss_monthly'
        ? {
            ...baseFilingData,
            status:
              existing?.statementStatus ??
              (existing?.status === 'filed' ? 'filed' : undefined) ??
              getFilingStatusFromDays(getDaysUntilDue(statementDueDate!)),
            dueDate: statementDueDate!,
            statementStatus:
              existing?.statementStatus ??
              (existing?.status === 'filed' ? 'filed' : undefined) ??
              getFilingStatusFromDays(getDaysUntilDue(statementDueDate!)),
            paymentStatus:
              existing?.paymentStatus ??
              (existing?.status === 'filed' ? 'filed' : undefined) ??
              getFilingStatusFromDays(getDaysUntilDue(paymentDueDate!)),
            statementDueDate: statementDueDate!,
            paymentDueDate: paymentDueDate!,
            totalINSSEmployee: (dataSnapshot as MonthlyINSSReturn).totalEmployeeContributions,
            totalINSSEmployer: (dataSnapshot as MonthlyINSSReturn).totalEmployerContributions,
          }
        : baseFilingData;

    let filingId: string;

    if (existing) {
      await updateDoc(doc(db, 'taxFilings', existing.id), filingData);
      filingId = existing.id;
    } else {
      const newDoc = await addDoc(this.collectionRef, {
        ...filingData,
        createdAt: serverTimestamp(),
        createdBy: userId,
      });
      filingId = newDoc.id;
    }

    // Log to audit trail if context provided
    if (audit) {
      await auditLogService
        .logTaxAction({
          ...audit,
          tenantId,
          action: type === 'inss_monthly' ? 'tax.inss_generated' : 'tax.wit_generated',
          filingId,
          period,
          metadata: {
            type,
            totalWages: filingData.totalWages,
            totalWIT: filingData.totalWITWithheld,
            employeeCount: filingData.employeeCount,
          },
        })
        .catch((err) => console.error('Audit log failed:', err));
    }

    return filingId;
  }

  /**
   * Mark a filing as filed
   */
  async markAsFiled(
    filingId: string,
    method: SubmissionMethod,
    receiptNumber?: string,
    notes?: string,
    userId?: string,
    audit?: AuditContext,
    task?: TaxFilingTask
  ): Promise<void> {
    const filing = await this.getFilingById(filingId);
    if (!filing) {
      throw new Error('Tax filing not found');
    }

    const today = getTodayTL();

    if (filing.type === 'inss_monthly') {
      const statementDueDate = filing.statementDueDate || filing.dueDate;
      const paymentDueDate =
        filing.paymentDueDate || (await this.getMonthlyINSSPaymentDueDate(filing.period, filing.tenantId));
      const statementStatus = resolveTaskStatus({
        explicitStatus: filing.statementStatus,
        legacyStatus: filing.status,
        daysUntilDue: getDaysUntilDue(statementDueDate),
      });
      const paymentStatus = resolveTaskStatus({
        explicitStatus: filing.paymentStatus,
        legacyStatus: filing.status,
        daysUntilDue: getDaysUntilDue(paymentDueDate),
      });

      const markTask = task || 'statement';
      const nextStatementStatus = markTask === 'statement' ? 'filed' : statementStatus;
      const nextPaymentStatus = markTask === 'payment' ? 'filed' : paymentStatus;

      const inssUpdate: Record<string, unknown> = {
        statementDueDate,
        paymentDueDate,
        statementStatus: nextStatementStatus,
        paymentStatus: nextPaymentStatus,
        status: nextStatementStatus, // keep legacy top-level status aligned to statement
        dueDate: statementDueDate,
        filedBy: userId,
        updatedAt: serverTimestamp(),
      };

      if (markTask === 'statement') {
        inssUpdate.filedDate = today;
        inssUpdate.statementFiledDate = today;
        inssUpdate.submissionMethod = method;
        inssUpdate.statementSubmissionMethod = method;
        inssUpdate.receiptNumber = receiptNumber;
        inssUpdate.statementReceiptNumber = receiptNumber;
        inssUpdate.notes = notes;
        inssUpdate.statementNotes = notes;
      } else {
        inssUpdate.paymentFiledDate = today;
        inssUpdate.paymentSubmissionMethod = method;
        inssUpdate.paymentReceiptNumber = receiptNumber;
        inssUpdate.paymentNotes = notes;
      }

      await updateDoc(doc(db, 'taxFilings', filingId), inssUpdate);
    } else {
      await updateDoc(doc(db, 'taxFilings', filingId), {
        status: 'filed',
        filedDate: today,
        submissionMethod: method,
        receiptNumber,
        notes,
        filedBy: userId,
        updatedAt: serverTimestamp(),
      });
    }

    // Log to audit trail if context provided
    if (audit) {
      const action =
        filing.type === 'annual_wit'
          ? 'tax.annual_filed'
          : filing.type === 'inss_monthly'
            ? 'tax.inss_filed'
            : 'tax.wit_filed';

      await auditLogService
        .logTaxAction({
          ...audit,
          tenantId: filing.tenantId,
          action,
          filingId,
          period: filing.period,
          metadata: {
            task,
            submissionMethod: method,
            receiptNumber,
            totalWIT: filing.totalWITWithheld,
            totalINSSEmployee: filing.totalINSSEmployee,
            totalINSSEmployer: filing.totalINSSEmployer,
          },
        })
        .catch((err) => console.error('Audit log failed:', err));
    }
  }

  // ----------------------------------------
  // FILING TRACKER
  // ----------------------------------------

  /**
   * Get upcoming and overdue filings
   */
  async getFilingsDueSoon(tenantId: string, months: number = 3): Promise<FilingDueDate[]> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Build all periods to check
    const periods: { year: number; month: number; period: string }[] = [];
    for (let i = -2; i <= months; i++) {
      let year = currentYear;
      let month = currentMonth + i - 1;
      if (month < 1) {
        month += 12;
        year -= 1;
      } else if (month > 12) {
        month -= 12;
        year += 1;
      }
      periods.push({
        year,
        month,
        period: `${year}-${String(month).padStart(2, '0')}`,
      });
    }

    // Fetch all filings and due dates in parallel
    const monthlyResults = await Promise.all(
      periods.map(async ({ period }) => {
        const [witDueDate, inssDueDate, inssPaymentDueDate, witFiling, inssFiling] = await Promise.all([
          this.getMonthlyWITDueDate(period, tenantId),
          this.getMonthlyINSSStatementDueDate(period, tenantId),
          this.getMonthlyINSSPaymentDueDate(period, tenantId),
          this.getFilingByPeriod('monthly_wit', period, tenantId),
          this.getFilingByPeriod('inss_monthly', period, tenantId),
        ]);
        return {
          period,
          witDueDate,
          inssDueDate,
          inssPaymentDueDate,
          witFiling,
          inssFiling,
        };
      })
    );

    const dueDates: FilingDueDate[] = [];

    for (const { period, witDueDate, inssDueDate, inssPaymentDueDate, witFiling, inssFiling } of monthlyResults) {
      // WIT
      const witDays = getDaysUntilDue(witDueDate);
      const witStatus: TaxFilingStatus = witFiling?.status === 'filed' ? 'filed' : witDays < 0 ? 'overdue' : 'pending';
      dueDates.push({
        type: 'monthly_wit',
        period,
        dueDate: witDueDate,
        status: witStatus,
        daysUntilDue: witDays,
        isOverdue: witDays < 0 && witStatus !== 'filed',
        filing: witFiling || undefined,
      });

      // INSS statement
      const inssDays = getDaysUntilDue(inssDueDate);
      const inssStatus = resolveTaskStatus({
        explicitStatus: inssFiling?.statementStatus,
        legacyStatus: inssFiling?.status,
        daysUntilDue: inssDays,
      });
      dueDates.push({
        type: 'inss_monthly',
        task: 'statement',
        period,
        dueDate: inssDueDate,
        status: inssStatus,
        daysUntilDue: inssDays,
        isOverdue: inssDays < 0 && inssStatus !== 'filed',
        filing: inssFiling || undefined,
      });

      // INSS payment
      const inssPayDays = getDaysUntilDue(inssPaymentDueDate);
      const inssPayStatus = resolveTaskStatus({
        explicitStatus: inssFiling?.paymentStatus,
        legacyStatus: inssFiling?.status,
        daysUntilDue: inssPayDays,
      });
      dueDates.push({
        type: 'inss_monthly',
        task: 'payment',
        period,
        dueDate: inssPaymentDueDate,
        status: inssPayStatus,
        daysUntilDue: inssPayDays,
        isOverdue: inssPayDays < 0 && inssPayStatus !== 'filed',
        filing: inssFiling || undefined,
      });
    }

    // Check annual WIT for previous year if we're in Q1
    if (currentMonth <= 3) {
      const period = String(currentYear - 1);
      const [dueDate, filing] = await Promise.all([
        this.getAnnualWITDueDate(currentYear - 1, tenantId),
        this.getFilingByPeriod('annual_wit', period, tenantId),
      ]);
      const daysUntilDue = getDaysUntilDue(dueDate);
      const status: TaxFilingStatus = filing?.status === 'filed' ? 'filed' : daysUntilDue < 0 ? 'overdue' : 'pending';
      dueDates.push({
        type: 'annual_wit',
        period,
        dueDate,
        status,
        daysUntilDue,
        isOverdue: daysUntilDue < 0 && status !== 'filed',
        filing: filing || undefined,
      });
    }

    dueDates.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return dueDates;
  }

  /**
   * Get filing status summary for dashboard
   */
  async getFilingStatusSummary(tenantId: string): Promise<{
    pending: number;
    overdue: number;
    filedThisMonth: number;
    nextDue: FilingDueDate | null;
  }> {
    const dueDates = await this.getFilingsDueSoon(tenantId, 2);

    const pending = dueDates.filter((d) => d.status === 'pending').length;
    const overdue = dueDates.filter((d) => d.isOverdue).length;
    const filedThisMonth = dueDates.filter(
      (d) =>
        d.status === 'filed' && d.filing?.filedDate && new Date(d.filing.filedDate).getMonth() === new Date().getMonth()
    ).length;

    const nextDue = dueDates.find((d) => d.status === 'pending' && d.daysUntilDue >= 0) || null;

    return {
      pending,
      overdue,
      filedThisMonth,
      nextDue,
    };
  }
}

// ============================================
// EXPORT SERVICE INSTANCE
// ============================================

export const taxFilingService = new TaxFilingService();
