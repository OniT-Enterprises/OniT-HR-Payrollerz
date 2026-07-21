import type { JournalEntry, JournalEntryLine } from "@/types/accounting";
import {
  addMoney,
  compareMoney,
  maxMoney,
  subtractMoney,
} from "@/lib/currency";

export const UNASSIGNED_ALLOCATION = "Unassigned";

export interface EmployeeAllocationMeta {
  projectCode: string;
  fundingSource: string;
}

interface EmployeeAllocationSource {
  id?: string;
  jobDetails?: {
    projectCode?: string | null;
    fundingSource?: string | null;
  };
}

function normalizeAllocationDimension(value?: string | null): string {
  const normalized = value?.trim();
  return normalized ? normalized : UNASSIGNED_ALLOCATION;
}

function normalizeAllocationMeta(
  projectCode?: string | null,
  fundingSource?: string | null
): EmployeeAllocationMeta {
  return {
    projectCode: normalizeAllocationDimension(projectCode),
    fundingSource: normalizeAllocationDimension(fundingSource),
  };
}

function isUnassignedAllocation(meta: EmployeeAllocationMeta): boolean {
  return (
    meta.projectCode === UNASSIGNED_ALLOCATION ||
    meta.fundingSource === UNASSIGNED_ALLOCATION
  );
}

export function createEmployeeAllocationMetaMap(
  employees: EmployeeAllocationSource[]
): Map<string, EmployeeAllocationMeta> {
  const map = new Map<string, EmployeeAllocationMeta>();

  for (const employee of employees) {
    if (!employee.id) continue;
    map.set(
      employee.id,
      normalizeAllocationMeta(
        employee.jobDetails?.projectCode,
        employee.jobDetails?.fundingSource
      )
    );
  }

  return map;
}

interface AmountLineLike {
  type?: string;
  amount?: number;
}

function findAmountByType(lines: AmountLineLike[] | undefined, type: string): number {
  return (lines || [])
    .filter((line) => line.type === type)
    .reduce((total, line) => addMoney(total, line.amount || 0), 0);
}

interface PayrollAllocationBucket {
  projectCode: string;
  fundingSource: string;
  grossPay: number;
  inssEmployer: number;
}

interface PayrollAllocationRollup {
  allocations: PayrollAllocationBucket[];
  unassignedEmployeeCount: number;
  unassignedRecordCount: number;
  unassignedGrossPay: number;
}

export interface PayrollAllocationRecord {
  employeeId: string;
  projectCode?: string | null;
  fundingSource?: string | null;
  totalGrossPay?: number;
  wagesPaid?: number;
  incomeTax?: number;
  inssEmployee?: number;
  inssEmployer?: number;
  netPay?: number;
  totalEmployerCost?: number;
  deductions?: AmountLineLike[];
  employerTaxes?: AmountLineLike[];
}

function resolveAllocationMeta(
  record: PayrollAllocationRecord,
  employeeMetaById: Map<string, EmployeeAllocationMeta>,
): EmployeeAllocationMeta {
  // New records carry a transaction-time snapshot. The property-existence
  // check deliberately treats an empty snapshot as Unassigned instead of
  // falling through to the employee's current (possibly edited) allocation.
  if (record.projectCode !== undefined || record.fundingSource !== undefined) {
    return normalizeAllocationMeta(record.projectCode, record.fundingSource);
  }
  return (
    employeeMetaById.get(record.employeeId) ||
    normalizeAllocationMeta(undefined, undefined)
  );
}

function wagesPaidFor(record: PayrollAllocationRecord): number {
  const attendanceReductions = addMoney(
    findAmountByType(record.deductions, "absence"),
    findAmountByType(record.deductions, "late_arrival"),
  );
  return typeof record.wagesPaid === "number"
    ? record.wagesPaid
    : maxMoney(
        0,
        subtractMoney(record.totalGrossPay || 0, attendanceReductions),
      );
}

function statutoryAmount(
  directValue: number | undefined,
  lines: AmountLineLike[] | undefined,
  type: string,
): number {
  return typeof directValue === "number"
    ? directValue
    : findAmountByType(lines, type);
}

export function summarizePayrollAllocations(
  records: PayrollAllocationRecord[],
  employeeMetaById: Map<string, EmployeeAllocationMeta>
): PayrollAllocationRollup {
  const grouped = new Map<string, PayrollAllocationBucket>();
  const unassignedEmployeeIds = new Set<string>();
  let unassignedRecordCount = 0;
  let unassignedGrossPay = 0;

  for (const record of records) {
    const meta = resolveAllocationMeta(record, employeeMetaById);
    const grossPay = wagesPaidFor(record);
    const inssEmployer = statutoryAmount(
      record.inssEmployer,
      record.employerTaxes,
      "inss_employer",
    );

    if (isUnassignedAllocation(meta)) {
      unassignedEmployeeIds.add(record.employeeId);
      unassignedRecordCount += 1;
      unassignedGrossPay = addMoney(unassignedGrossPay, grossPay);
    }

    const key = `${meta.projectCode}::${meta.fundingSource}`;
    const existing = grouped.get(key) || {
      projectCode: meta.projectCode,
      fundingSource: meta.fundingSource,
      grossPay: 0,
      inssEmployer: 0,
    };

    existing.grossPay = addMoney(existing.grossPay, grossPay);
    existing.inssEmployer = addMoney(existing.inssEmployer, inssEmployer);
    grouped.set(key, existing);
  }

  return {
    allocations: Array.from(grouped.values()).sort((a, b) =>
      compareMoney(b.grossPay, a.grossPay),
    ),
    unassignedEmployeeCount: unassignedEmployeeIds.size,
    unassignedRecordCount,
    unassignedGrossPay,
  };
}

export interface PayrollAllocationReportRow {
  projectCode: string;
  fundingSource: string;
  employeeCount: number;
  grossPay: number;
  incomeTax: number;
  inssEmployee: number;
  inssEmployer: number;
  netPay: number;
  employerCost: number;
}

export interface PayrollAllocationReportTotals {
  runCount: number;
  employeeCount: number;
  grossPay: number;
  incomeTax: number;
  inssEmployee: number;
  inssEmployer: number;
  netPay: number;
  employerCost: number;
}

export function summarizePayrollAllocationReport(
  records: PayrollAllocationRecord[],
  employeeMetaById: Map<string, EmployeeAllocationMeta>,
  runCount: number,
): { rows: PayrollAllocationReportRow[]; totals: PayrollAllocationReportTotals } {
  const grouped = new Map<
    string,
    Omit<PayrollAllocationReportRow, "employeeCount"> & {
      employeeIds: Set<string>;
    }
  >();
  const allEmployeeIds = new Set<string>();
  const totals: PayrollAllocationReportTotals = {
    runCount,
    employeeCount: 0,
    grossPay: 0,
    incomeTax: 0,
    inssEmployee: 0,
    inssEmployer: 0,
    netPay: 0,
    employerCost: 0,
  };

  for (const record of records) {
    const meta = resolveAllocationMeta(record, employeeMetaById);
    const key = `${meta.projectCode}::${meta.fundingSource}`;
    const grossPay = wagesPaidFor(record);
    const incomeTax = statutoryAmount(
      record.incomeTax,
      record.deductions,
      "income_tax",
    );
    const inssEmployee = statutoryAmount(
      record.inssEmployee,
      record.deductions,
      "inss_employee",
    );
    const inssEmployer = statutoryAmount(
      record.inssEmployer,
      record.employerTaxes,
      "inss_employer",
    );
    const netPay = record.netPay || 0;
    const employerCost =
      typeof record.totalEmployerCost === "number"
        ? record.totalEmployerCost
        : addMoney(grossPay, inssEmployer);
    const existing = grouped.get(key) || {
      projectCode: meta.projectCode,
      fundingSource: meta.fundingSource,
      employeeIds: new Set<string>(),
      grossPay: 0,
      incomeTax: 0,
      inssEmployee: 0,
      inssEmployer: 0,
      netPay: 0,
      employerCost: 0,
    };

    existing.employeeIds.add(record.employeeId);
    existing.grossPay = addMoney(existing.grossPay, grossPay);
    existing.incomeTax = addMoney(existing.incomeTax, incomeTax);
    existing.inssEmployee = addMoney(existing.inssEmployee, inssEmployee);
    existing.inssEmployer = addMoney(existing.inssEmployer, inssEmployer);
    existing.netPay = addMoney(existing.netPay, netPay);
    existing.employerCost = addMoney(existing.employerCost, employerCost);
    grouped.set(key, existing);

    allEmployeeIds.add(record.employeeId);
    totals.grossPay = addMoney(totals.grossPay, grossPay);
    totals.incomeTax = addMoney(totals.incomeTax, incomeTax);
    totals.inssEmployee = addMoney(totals.inssEmployee, inssEmployee);
    totals.inssEmployer = addMoney(totals.inssEmployer, inssEmployer);
    totals.netPay = addMoney(totals.netPay, netPay);
    totals.employerCost = addMoney(totals.employerCost, employerCost);
  }

  totals.employeeCount = allEmployeeIds.size;
  const rows = Array.from(grouped.values())
    .map(({ employeeIds, ...row }) => ({
      ...row,
      employeeCount: employeeIds.size,
    }))
    .sort((a, b) => compareMoney(b.grossPay, a.grossPay));

  return { rows, totals };
}

export interface DonorLine {
  date: string;
  entryNumber: string;
  sourceId: string;
  projectCode: string;
  fundingSource: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

export interface DonorSummary {
  projectCode: string;
  fundingSource: string;
  salaryExpense: number;
  inssEmployerExpense: number;
  totalExpense: number;
}

type DonorJournalEntry = Pick<
  JournalEntry,
  "date" | "entryNumber" | "source" | "sourceId" | "description"
> & {
  lines?: Array<
    Pick<
      JournalEntryLine,
      "accountCode" | "accountName" | "projectId" | "departmentId" | "debit" | "credit" | "description"
    >
  >;
};

const DONOR_ACCOUNT_CODES = new Set(["5110", "5150"]);

export function extractDonorLines(entries: DonorJournalEntry[]): DonorLine[] {
  return entries
    .filter((entry) => entry.source === "payroll")
    .flatMap((entry) =>
      (entry.lines || [])
        .filter((line) => DONOR_ACCOUNT_CODES.has(line.accountCode))
        .map((line) => ({
          date: entry.date,
          entryNumber: entry.entryNumber,
          sourceId: entry.sourceId || "",
          projectCode: normalizeAllocationDimension(line.projectId),
          fundingSource: normalizeAllocationDimension(line.departmentId),
          accountCode: line.accountCode,
          accountName: line.accountName,
          debit: line.debit || 0,
          credit: line.credit || 0,
          description: line.description || entry.description || "",
        }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function summarizeDonorLines(lines: DonorLine[]): DonorSummary[] {
  const grouped = new Map<string, DonorSummary>();

  for (const line of lines) {
    const key = `${line.projectCode}::${line.fundingSource}`;
    const existing = grouped.get(key) || {
      projectCode: line.projectCode,
      fundingSource: line.fundingSource,
      salaryExpense: 0,
      inssEmployerExpense: 0,
      totalExpense: 0,
    };

    if (line.accountCode === "5110") {
      existing.salaryExpense = addMoney(existing.salaryExpense, line.debit);
    }
    if (line.accountCode === "5150") {
      existing.inssEmployerExpense = addMoney(existing.inssEmployerExpense, line.debit);
    }
    existing.totalExpense = addMoney(
      existing.totalExpense,
      subtractMoney(line.debit, line.credit),
    );
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).sort((a, b) =>
    compareMoney(b.totalExpense, a.totalExpense),
  );
}
