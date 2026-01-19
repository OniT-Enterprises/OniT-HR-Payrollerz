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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { employeeService, type Employee, type AuditContext } from './employeeService';
import { auditLogService } from './auditLogService';
import { payrollService } from './payrollService';
import { holidayService } from './holidayService';
import type {
  TaxFiling,
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
import { TL_INCOME_TAX, TL_INSS } from '@/lib/payroll/constants-tl';
import { adjustToNextBusinessDayTL } from '@/lib/payroll/tl-holidays';

// ============================================
// CONSTANTS
// ============================================

const MONTHLY_WIT_DUE_DAY = 15; // 15th of following month
const ANNUAL_WIT_DUE_MONTH = 3; // March
const ANNUAL_WIT_DUE_DAY = 31;  // March 31st
const MONTHLY_INSS_STATEMENT_DUE_DAY = 10; // remuneration statement (following month)
const MONTHLY_INSS_PAYMENT_DUE_DAY = 20;   // payment window ends (following month)

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate WIT for an employee based on wages
 */
function calculateWIT(grossWages: number, isResident: boolean): { taxableWages: number; wit: number } {
  if (isResident) {
    // Residents: 10% on income above $500/month
    const taxableWages = Math.max(0, grossWages - TL_INCOME_TAX.residentThreshold);
    return {
      taxableWages,
      wit: taxableWages * TL_INCOME_TAX.rate,
    };
  } else {
    // Non-residents: 10% on all income
    return {
      taxableWages: grossWages,
      wit: grossWages * TL_INCOME_TAX.rate,
    };
  }
}

/**
 * Calculate due date for monthly WIT return
 */
function getMonthlyWITDueDateBase(period: string): string {
  const [year, month] = period.split('-').map(Number);
  // Due 15th of following month
  let dueMonth = month + 1;
  let dueYear = year;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(MONTHLY_WIT_DUE_DAY).padStart(2, '0')}`;
}

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
 * Calculate due date for annual WIT return
 */
function getAnnualWITDueDateBase(taxYear: number): string {
  // Due March 31st of following year
  return `${taxYear + 1}-${String(ANNUAL_WIT_DUE_MONTH).padStart(2, '0')}-${String(ANNUAL_WIT_DUE_DAY).padStart(2, '0')}`;
}

/**
 * Calculate days until due date
 */
function getDaysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getRecordGrossPay(record: any): number {
  if (!record) return 0;
  if (typeof record.totalGrossPay === 'number') return record.totalGrossPay;
  if (typeof record.grossPay === 'number') return record.grossPay;
  return 0;
}

function getRecordWITWithheld(record: any): number {
  if (!record) return 0;
  if (typeof record.incomeTax === 'number') return record.incomeTax;

  const deductions = Array.isArray(record.deductions) ? record.deductions : [];
  const wit = deductions.find((d: any) =>
    d?.type === 'federal_tax' ||
    String(d?.description || '').toLowerCase().includes('wit') ||
    String(d?.description || '').toLowerCase().includes('income tax')
  );
  return typeof wit?.amount === 'number' ? wit.amount : 0;
}

function getRecordINSSEmployee(record: any): number {
  if (!record) return 0;
  if (typeof record.inssEmployee === 'number') return record.inssEmployee;

  const deductions = Array.isArray(record.deductions) ? record.deductions : [];
  const inss = deductions.find((d: any) =>
    d?.type === 'social_security' ||
    String(d?.description || '').toLowerCase().includes('inss')
  );
  return typeof inss?.amount === 'number' ? inss.amount : 0;
}

function getRecordINSSEmployer(record: any): number {
  if (!record) return 0;
  if (typeof record.inssEmployer === 'number') return record.inssEmployer;

  const employerTaxes = Array.isArray(record.employerTaxes) ? record.employerTaxes : [];
  const inss = employerTaxes.find((t: any) =>
    t?.type === 'social_security' ||
    String(t?.description || '').toLowerCase().includes('inss')
  );
  return typeof inss?.amount === 'number' ? inss.amount : 0;
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
    // Get all employees
    const employees = await employeeService.getAllEmployees(tenantId);

    // Get payroll records for this period
    const payrollRuns = await payrollService.runs.getAllPayrollRuns(
      { tenantId }
    );
    const periodRuns = payrollRuns.filter(run => {
      // Reporting period is based on wages paid during the month (pay date).
      const runPeriod = run.payDate?.substring(0, 7); // "YYYY-MM"
      return runPeriod === period && run.status === 'paid';
    });

    const recordsByRun = await Promise.all(
      periodRuns
        .filter(r => !!r.id)
        .map(r => payrollService.records.getPayrollRecordsByRunId(r.id!, tenantId))
    );
    const periodRecords = recordsByRun.flat();

    const totalsByEmployee = new Map<string, { grossWages: number; witWithheld: number }>();
    periodRecords.forEach(record => {
      const employeeId = record.employeeId;
      if (!employeeId) return;

      const existing = totalsByEmployee.get(employeeId) || { grossWages: 0, witWithheld: 0 };
      totalsByEmployee.set(employeeId, {
        grossWages: existing.grossWages + getRecordGrossPay(record),
        witWithheld: existing.witWithheld + getRecordWITWithheld(record),
      });
    });

    // Build employee records
    const employeeRecords: MonthlyWITEmployeeRecord[] = [];
    let totalGrossWages = 0;
    let totalTaxableWages = 0;
    let totalWITWithheld = 0;
    let residentCount = 0;
    let nonResidentCount = 0;

    for (const employee of employees) {
      if (employee.status !== 'active') continue;

      const totals = employee.id ? totalsByEmployee.get(employee.id) : null;
      const grossWages = totals?.grossWages || 0;
      const witWithheld = totals?.witWithheld || 0;
      if (grossWages === 0) continue; // Skip employees with no pay this period

      const isResident = employee.compensation?.isResident ?? true;
      const taxableWages = TL_INCOME_TAX.rate > 0
        ? Math.round((witWithheld / TL_INCOME_TAX.rate) * 100) / 100
        : 0;

      employeeRecords.push({
        employeeId: employee.id!,
        fullName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        tinNumber: undefined, // TL employees typically don't have individual TINs
        isResident,
        grossWages: Math.round(grossWages * 100) / 100,
        taxableWages,
        witWithheld: Math.round(witWithheld * 100) / 100,
      });

      totalGrossWages += grossWages;
      totalTaxableWages += taxableWages;
      totalWITWithheld += witWithheld;

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
      employerTIN: company.tinNumber || '',
      employerName: company.legalName || company.tradingName || '',
      employerAddress: company.registeredAddress || '',
      reportingPeriod: period,
      periodStartDate,
      periodEndDate,
      totalEmployees: employeeRecords.length,
      totalResidentEmployees: residentCount,
      totalNonResidentEmployees: nonResidentCount,
      totalGrossWages: Math.round(totalGrossWages * 100) / 100,
      totalTaxableWages: Math.round(totalTaxableWages * 100) / 100,
      totalWITWithheld: Math.round(totalWITWithheld * 100) / 100,
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
    const employees = await employeeService.getAllEmployees(tenantId);

    const payrollRuns = await payrollService.runs.getAllPayrollRuns(
      { tenantId }
    );
    const periodRuns = payrollRuns.filter(run => {
      const runPeriod = run.payDate?.substring(0, 7);
      return runPeriod === period && run.status === 'paid';
    });

    const recordsByRun = await Promise.all(
      periodRuns
        .filter(r => !!r.id)
        .map(r => payrollService.records.getPayrollRecordsByRunId(r.id!, tenantId))
    );
    const periodRecords = recordsByRun.flat();

    const totalsByEmployee = new Map<string, { grossWages: number; employeeINSS: number; employerINSS: number; contributionBase: number }>();
    periodRecords.forEach(record => {
      const employeeId = record.employeeId;
      if (!employeeId) return;

      const employeeINSS = getRecordINSSEmployee(record);
      const employerINSS = getRecordINSSEmployer(record);
      const contributionBase = TL_INSS.employeeRate > 0
        ? Math.round((employeeINSS / TL_INSS.employeeRate) * 100) / 100
        : 0;

      const existing = totalsByEmployee.get(employeeId) || {
        grossWages: 0,
        employeeINSS: 0,
        employerINSS: 0,
        contributionBase: 0,
      };

      totalsByEmployee.set(employeeId, {
        grossWages: existing.grossWages + getRecordGrossPay(record),
        employeeINSS: existing.employeeINSS + employeeINSS,
        employerINSS: existing.employerINSS + employerINSS,
        contributionBase: existing.contributionBase + contributionBase,
      });
    });

    const employeeRecords: MonthlyINSSEmployeeRecord[] = [];
    let totalContributionBase = 0;
    let totalEmployeeContributions = 0;
    let totalEmployerContributions = 0;

    for (const employee of employees) {
      if (employee.status !== 'active') continue;
      if (!employee.id) continue;

      const totals = totalsByEmployee.get(employee.id);
      if (!totals) continue;

      const employeeContribution = Math.round(totals.employeeINSS * 100) / 100;
      const employerContribution = Math.round(totals.employerINSS * 100) / 100;
      const contributionBase = Math.round(totals.contributionBase * 100) / 100;
      const totalContribution = Math.round((employeeContribution + employerContribution) * 100) / 100;

      if (employeeContribution === 0 && employerContribution === 0) continue;

      employeeRecords.push({
        employeeId: employee.id,
        fullName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        inssNumber: employee.documents?.socialSecurityNumber?.number || undefined,
        contributionBase,
        employeeContribution,
        employerContribution,
        totalContribution,
      });

      totalContributionBase += contributionBase;
      totalEmployeeContributions += employeeContribution;
      totalEmployerContributions += employerContribution;
    }

    const [year, month] = period.split('-').map(Number);
    const periodStartDate = `${period}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEndDate = `${period}-${lastDay}`;

    const totalContributions = totalEmployeeContributions + totalEmployerContributions;

    return {
      employerTIN: company.tinNumber || '',
      employerName: company.legalName || company.tradingName || '',
      employerAddress: company.registeredAddress || '',
      reportingPeriod: period,
      periodStartDate,
      periodEndDate,
      totalEmployees: employeeRecords.length,
      totalContributionBase: Math.round(totalContributionBase * 100) / 100,
      totalEmployeeContributions: Math.round(totalEmployeeContributions * 100) / 100,
      totalEmployerContributions: Math.round(totalEmployerContributions * 100) / 100,
      totalContributions: Math.round(totalContributions * 100) / 100,
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
    // Get all employees (including those terminated during the year)
    const employees = await employeeService.getAllEmployees(tenantId);

    // Get all payroll runs for the year
    const payrollRuns = await payrollService.runs.getAllPayrollRuns(
      { tenantId }
    );
    const yearRuns = payrollRuns.filter(run => {
      const runYear = parseInt(run.payDate.substring(0, 4));
      return runYear === taxYear && run.status === 'paid';
    });

    // Aggregate employee data for the year
    const employeeAggregates: Map<string, {
      employee: Employee;
      totalGrossWages: number;
      totalWIT: number;
      monthsWorked: Set<number>;
    }> = new Map();

    for (const run of yearRuns) {
      const records = await payrollService.records.getPayrollRecordsByRunId(run.id, tenantId);
      const runMonth = parseInt(run.payDate.substring(5, 7));

      for (const record of records) {
        const employee = employees.find(e => e.id === record.employeeId);
        if (!employee) continue;

        const existing = employeeAggregates.get(record.employeeId) || {
          employee,
          totalGrossWages: 0,
          totalWIT: 0,
          monthsWorked: new Set<number>(),
        };

        existing.totalGrossWages += record.totalGrossPay || 0;
        // Find WIT deduction from deductions array (check type and description)
        const witDeduction = record.deductions?.find(d =>
          d.type === 'federal_tax' || d.description?.toLowerCase().includes('wit') || d.description?.toLowerCase().includes('income tax')
        );
        existing.totalWIT += witDeduction?.amount || 0;
        existing.monthsWorked.add(runMonth);

        employeeAggregates.set(record.employeeId, existing);
      }
    }

    // Build employee records
    const employeeRecords: AnnualWITEmployeeRecord[] = [];
    let totalGrossWagesPaid = 0;
    let totalWITWithheld = 0;

    for (const [, data] of employeeAggregates) {
      const { employee, totalGrossWages, totalWIT, monthsWorked } = data;

      // Determine start/end dates if applicable
      const hireDate = employee.jobDetails.hireDate;
      const hireYear = hireDate ? new Date(hireDate).getFullYear() : null;
      const startDate = hireYear === taxYear ? hireDate : undefined;

      // Check for termination
      const endDate = employee.status === 'terminated' ? undefined : undefined; // Would need termination date field

      employeeRecords.push({
        employeeId: employee.id!,
        fullName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        tinNumber: undefined, // TL employees typically don't have individual TINs
        isResident: employee.compensation?.isResident ?? true,
        startDate,
        endDate,
        monthsWorked: monthsWorked.size,
        totalGrossWages: Math.round(totalGrossWages * 100) / 100,
        totalWITWithheld: Math.round(totalWIT * 100) / 100,
      });

      totalGrossWagesPaid += totalGrossWages;
      totalWITWithheld += totalWIT;
    }

    return {
      employerTIN: company.tinNumber || '',
      employerName: company.legalName || company.tradingName || '',
      employerAddress: company.registeredAddress || '',
      taxYear,
      totalEmployeesInYear: employeeRecords.length,
      totalGrossWagesPaid: Math.round(totalGrossWagesPaid * 100) / 100,
      totalWITWithheld: Math.round(totalWITWithheld * 100) / 100,
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
    const employeeRecord = annualReturn.employees.find(e => e.employeeId === employeeId);

    if (!employeeRecord) {
      throw new Error('No payroll records found for this employee in the specified year');
    }

    return {
      employerName: company.legalName || company.tradingName || '',
      employerTIN: company.tinNumber || '',
      employerAddress: company.registeredAddress || '',
      employeeId: employee.id!,
      employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
      employeeTIN: undefined, // TL employees typically don't have individual TINs
      employeeAddress: employee.personalInfo.address || '',
      taxYear,
      employmentStartDate: employee.jobDetails.hireDate || '',
      employmentEndDate: employeeRecord.endDate,
      totalGrossWages: employeeRecord.totalGrossWages,
      totalWITWithheld: employeeRecord.totalWITWithheld,
      certificationDate: new Date().toISOString().split('T')[0],
      authorizedSignatory: signatory.name,
      signatoryPosition: signatory.position,
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
      orderBy('period', 'desc'),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
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
    const dueDate =
      type === 'monthly_wit'
        ? await this.getMonthlyWITDueDate(period, tenantId)
        : type === 'annual_wit'
          ? await this.getAnnualWITDueDate(parseInt(period), tenantId)
          : await this.getMonthlyINSSStatementDueDate(period, tenantId);

    const daysUntilDue = getDaysUntilDue(dueDate);
    const status: TaxFilingStatus = daysUntilDue < 0 ? 'overdue' : 'pending';

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

    const filingData = type === 'inss_monthly'
      ? {
          ...baseFilingData,
          totalINSSEmployee: (dataSnapshot as MonthlyINSSReturn).totalEmployeeContributions,
          totalINSSEmployer: (dataSnapshot as MonthlyINSSReturn).totalEmployerContributions,
        }
      : baseFilingData;

    // Check if filing already exists
    const existing = await this.getFilingByPeriod(type, period, tenantId);
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
      await auditLogService.logTaxAction({
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
      }).catch(err => console.error('Audit log failed:', err));
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
    audit?: AuditContext
  ): Promise<void> {
    // Get filing info for audit
    const filing = audit ? await this.getFilingById(filingId) : null;

    await updateDoc(doc(db, 'taxFilings', filingId), {
      status: 'filed',
      filedDate: new Date().toISOString().split('T')[0],
      submissionMethod: method,
      receiptNumber,
      notes,
      filedBy: userId,
      updatedAt: serverTimestamp(),
    });

    // Log to audit trail if context provided
    if (audit && filing) {
      const action =
        filing.type === 'annual_wit'
          ? 'tax.annual_filed'
          : filing.type === 'inss_monthly'
            ? 'tax.inss_filed'
            : 'tax.wit_filed';

      await auditLogService.logTaxAction({
        ...audit,
        tenantId: filing.tenantId,
        action,
        filingId,
        period: filing.period,
        metadata: {
          submissionMethod: method,
          receiptNumber,
          totalWIT: filing.totalWITWithheld,
          totalINSSEmployee: filing.totalINSSEmployee,
          totalINSSEmployer: filing.totalINSSEmployer,
        },
      }).catch(err => console.error('Audit log failed:', err));
    }
  }

  // ----------------------------------------
  // FILING TRACKER
  // ----------------------------------------

  /**
   * Get upcoming and overdue filings
   */
  async getFilingsDueSoon(tenantId: string, months: number = 3): Promise<FilingDueDate[]> {
    const dueDates: FilingDueDate[] = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Check monthly WIT filings for past and upcoming months
    for (let i = -2; i <= months; i++) {
      let year = currentYear;
      let month = currentMonth + i - 1; // -1 because we file for previous month

      if (month < 1) {
        month += 12;
        year -= 1;
      } else if (month > 12) {
        month -= 12;
        year += 1;
      }

      const period = `${year}-${String(month).padStart(2, '0')}`;
      const dueDate = await this.getMonthlyWITDueDate(period, tenantId);
      const daysUntilDue = getDaysUntilDue(dueDate);

      // Get existing filing if any
      const filing = await this.getFilingByPeriod('monthly_wit', period, tenantId);

      let status: TaxFilingStatus;
      if (filing?.status === 'filed') {
        status = 'filed';
      } else if (daysUntilDue < 0) {
        status = 'overdue';
      } else {
        status = 'pending';
      }

      dueDates.push({
        type: 'monthly_wit',
        period,
        dueDate,
        status,
        daysUntilDue,
        isOverdue: daysUntilDue < 0 && status !== 'filed',
        filing: filing || undefined,
      });

      const inssDueDate = await this.getMonthlyINSSStatementDueDate(period, tenantId);
      const inssDaysUntilDue = getDaysUntilDue(inssDueDate);
      const inssFiling = await this.getFilingByPeriod('inss_monthly', period, tenantId);

      let inssStatus: TaxFilingStatus;
      if (inssFiling?.status === 'filed') {
        inssStatus = 'filed';
      } else if (inssDaysUntilDue < 0) {
        inssStatus = 'overdue';
      } else {
        inssStatus = 'pending';
      }

      dueDates.push({
        type: 'inss_monthly',
        task: 'statement',
        period,
        dueDate: inssDueDate,
        status: inssStatus,
        daysUntilDue: inssDaysUntilDue,
        isOverdue: inssDaysUntilDue < 0 && inssStatus !== 'filed',
        filing: inssFiling || undefined,
      });

      // INSS payment deadline (following month 10th–20th window ends on 20th)
      const inssPaymentDueDate = await this.getMonthlyINSSPaymentDueDate(period, tenantId);
      const inssPaymentDaysUntilDue = getDaysUntilDue(inssPaymentDueDate);

      let inssPaymentStatus: TaxFilingStatus;
      if (inssFiling?.status === 'filed') {
        inssPaymentStatus = 'filed';
      } else if (inssPaymentDaysUntilDue < 0) {
        inssPaymentStatus = 'overdue';
      } else {
        inssPaymentStatus = 'pending';
      }

      dueDates.push({
        type: 'inss_monthly',
        task: 'payment',
        period,
        dueDate: inssPaymentDueDate,
        status: inssPaymentStatus,
        daysUntilDue: inssPaymentDaysUntilDue,
        isOverdue: inssPaymentDaysUntilDue < 0 && inssPaymentStatus !== 'filed',
        filing: inssFiling || undefined,
      });
    }

    // Check annual WIT for previous year if we're in Q1
    if (currentMonth <= 3) {
      const period = String(currentYear - 1);
      const dueDate = await this.getAnnualWITDueDate(currentYear - 1, tenantId);
      const daysUntilDue = getDaysUntilDue(dueDate);

      const filing = await this.getFilingByPeriod('annual_wit', period, tenantId);

      let status: TaxFilingStatus;
      if (filing?.status === 'filed') {
        status = 'filed';
      } else if (daysUntilDue < 0) {
        status = 'overdue';
      } else {
        status = 'pending';
      }

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

    // Sort by due date
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

    const pending = dueDates.filter(d => d.status === 'pending').length;
    const overdue = dueDates.filter(d => d.isOverdue).length;
    const filedThisMonth = dueDates.filter(d =>
      d.status === 'filed' &&
      d.filing?.filedDate &&
      new Date(d.filing.filedDate).getMonth() === new Date().getMonth()
    ).length;

    const nextDue = dueDates.find(d => d.status === 'pending' && d.daysUntilDue >= 0) || null;

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
export default taxFilingService;
