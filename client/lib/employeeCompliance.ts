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

export function buildEmployeeComplianceSnapshot(
  employee: Partial<Employee> | null | undefined
): EmployeeComplianceSnapshot {
  const missingInss = !hasValue(employee?.documents?.socialSecurityNumber?.number);
  const missingContract = !hasValue(employee?.documents?.workContract?.fileUrl);
  const missingDepartment = !hasValue(employee?.jobDetails?.department);
  const blockingIssueCount = Number(missingInss) + Number(missingContract);
  const issueCount = blockingIssueCount + Number(missingDepartment);

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
