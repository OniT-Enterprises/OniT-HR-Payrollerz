import type { Employee } from "@/services/employeeService";

export interface EmployeeComplianceSnapshot {
  missingInss: boolean;
  missingContract: boolean;
  missingDepartment: boolean;
  issueCount: number;
  blockingIssueCount: number;
  hasIssues: boolean;
  hasBlockingIssue: boolean;
}

function hasValue(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

/**
 * What is "wrong" with an employee record.
 *
 * These three flags are REMINDERS, not blockers. None of them affects a
 * payroll calculation:
 *
 * - INSS number — needed to file the monthly DR, not to work out pay. It is
 *   collected before the first filing instead; `/reports/inss-monthly` runs a
 *   pre-flight that names anyone missing one, rather than letting the return
 *   builder throw mid-export.
 * - Work contract PDF — nothing reads the file. `contractFill` leaves
 *   unresolved tokens and the work certificate prints an em dash.
 * - Department — display and grouping only.
 *
 * They used to count as BLOCKING, which forced a first-time owner who had just
 * created an employee from four fields to immediately answer "2 problems" on
 * their dashboard, and made the payroll run demand an exclusion or a typed
 * acknowledgement. Payroll protects itself where it matters — a salary below
 * the minimum wage fails `validateTLPayrollInput` on its own, whatever this
 * snapshot says.
 *
 * The field names are load-bearing: `getActiveEmployeeSummary` runs
 * `getCountFromServer` queries against `compliance.*` backed by composite
 * indexes in firestore.indexes.json. Do not rename them.
 */
export function buildEmployeeComplianceSnapshot(
  employee: Partial<Employee> | null | undefined
): EmployeeComplianceSnapshot {
  const missingInss = !hasValue(employee?.documents?.socialSecurityNumber?.number);
  const missingContract = !hasValue(employee?.documents?.workContract?.fileUrl);
  const missingDepartment = !hasValue(employee?.jobDetails?.department);
  // Nothing here stops payroll, so nothing here is blocking.
  const blockingIssueCount = 0;
  const issueCount =
    Number(missingInss) + Number(missingContract) + Number(missingDepartment);

  return {
    missingInss,
    missingContract,
    missingDepartment,
    issueCount,
    blockingIssueCount,
    hasIssues: issueCount > 0,
    hasBlockingIssue: blockingIssueCount > 0,
  };
}
