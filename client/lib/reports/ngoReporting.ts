import type { JournalEntry, JournalEntryLine } from "@/types/accounting";
import { addMoney, maxMoney, subtractMoney } from "@/lib/currency";

export const UNASSIGNED_ALLOCATION = "Unassigned";

interface EmployeeAllocationMeta {
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

interface PayrollAllocationRecord {
  employeeId: string;
  totalGrossPay?: number;
  wagesPaid?: number;
  deductions?: AmountLineLike[];
  employerTaxes?: AmountLineLike[];
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
    const meta =
      employeeMetaById.get(record.employeeId) ||
      normalizeAllocationMeta(undefined, undefined);
    const attendanceReductions = addMoney(
      findAmountByType(record.deductions, 'absence'),
      findAmountByType(record.deductions, 'late_arrival'),
    );
    const grossPay = typeof record.wagesPaid === 'number'
      ? record.wagesPaid
      : maxMoney(0, subtractMoney(record.totalGrossPay || 0, attendanceReductions));
    const inssEmployer = findAmountByType(record.employerTaxes, "inss_employer");

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
    allocations: Array.from(grouped.values()).sort((a, b) => b.grossPay - a.grossPay),
    unassignedEmployeeCount: unassignedEmployeeIds.size,
    unassignedRecordCount,
    unassignedGrossPay,
  };
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

  return Array.from(grouped.values()).sort((a, b) => b.totalExpense - a.totalExpense);
}
