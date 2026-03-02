import type { Employee } from "@/services/employeeService";

export interface ProfileCompletenessResult {
  completionPercentage: number;
  isComplete: boolean;
  missingFields: string[];
  requiredDocuments: {
    field: string;
    missing: boolean;
    required: boolean;
  }[];
}

export function getProfileCompleteness(employee: Employee): ProfileCompletenessResult {
  const missingFields: string[] = [];
  let completed = 0;
  let total = 0;

  // Check personal info
  const personalFields = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'dateOfBirth', label: 'Date of Birth' },
  ];

  personalFields.forEach(({ key, label }) => {
    total++;
    if (employee.personalInfo?.[key as keyof typeof employee.personalInfo]) {
      completed++;
    } else {
      missingFields.push(label);
    }
  });

  // Check job details
  const jobFields = [
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'department', label: 'Department' },
    { key: 'position', label: 'Position' },
    { key: 'hireDate', label: 'Hire Date' },
  ];

  jobFields.forEach(({ key, label }) => {
    total++;
    if (employee.jobDetails?.[key as keyof typeof employee.jobDetails]) {
      completed++;
    } else {
      missingFields.push(label);
    }
  });

  // Check compensation
  total++;
  if (employee.compensation?.monthlySalary) {
    completed++;
  } else {
    missingFields.push('Monthly Salary');
  }

  // Check required documents
  const requiredDocuments = [
    {
      field: 'ID Card',
      missing: !employee.documents?.idCard?.number,
      required: employee.documents?.idCard?.required ?? true,
    },
    {
      field: 'Social Security',
      missing: !employee.documents?.socialSecurityNumber?.number,
      required: employee.documents?.socialSecurityNumber?.required ?? true,
    },
    {
      field: 'Employee ID Card',
      missing: !employee.documents?.employeeIdCard?.number,
      required: employee.documents?.employeeIdCard?.required ?? true,
    },
    {
      field: 'Passport',
      missing: !employee.documents?.passport?.number,
      required: employee.documents?.passport?.required ?? false,
    },
    {
      field: 'Electoral Card',
      missing: !employee.documents?.electoralCard?.number,
      required: employee.documents?.electoralCard?.required ?? false,
    },
  ];

  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    completionPercentage,
    isComplete: completionPercentage >= 100,
    missingFields,
    requiredDocuments,
  };
}

export function getIncompleteEmployees(employees: Employee[]): Employee[] {
  return employees.filter(emp => getProfileCompleteness(emp).completionPercentage < 100);
}

export function getCompletionStatusColor(completeness: number): string {
  if (completeness >= 100) return "text-green-600";
  if (completeness >= 75) return "text-yellow-600";
  if (completeness >= 50) return "text-orange-600";
  return "text-red-600";
}

// ─── Payroll Compliance ─────────────────────────────────────────────────

export type ComplianceField = "inss" | "contract" | "department" | "sefope";
export type ComplianceSeverity = "error" | "warning";

export interface ComplianceIssue {
  employee: Employee;
  field: ComplianceField;
  severity: ComplianceSeverity;
  /** Default English label */
  issue: string;
  /** Short CTA text */
  action: string;
  /** Route path to fix the issue */
  path: string;
}

/**
 * Single source of truth for employee compliance checks.
 * Used by Dashboard, PeopleDashboard, PayrollDashboard, and RunPayroll.
 *
 * - "error" = blocks payroll (INSS, contract)
 * - "warning" = should fix but doesn't block payroll (department, SEFOPE)
 */
export function getComplianceIssues(employees: Employee[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  employees.forEach((emp) => {
    const id = emp.id || "";

    // INSS number — required for tax filing
    if (!emp.documents?.socialSecurityNumber?.number) {
      issues.push({
        employee: emp,
        field: "inss",
        severity: "error",
        issue: "INSS number missing",
        action: "Add INSS",
        path: `/people/employees?id=${id}&edit=true`,
      });
    }

    // Work contract — required for legal compliance
    if (!emp.documents?.workContract?.fileUrl) {
      issues.push({
        employee: emp,
        field: "contract",
        severity: "error",
        issue: "Contract not uploaded",
        action: "Upload",
        path: `/people/employees?id=${id}&tab=documents`,
      });
    }

    // Department — needed for reporting
    if (!emp.jobDetails?.department) {
      issues.push({
        employee: emp,
        field: "department",
        severity: "warning",
        issue: "No department assigned",
        action: "Assign",
        path: `/people/employees?id=${id}&edit=true`,
      });
    }

    // SEFOPE number — TL labor ministry registration
    if (!emp.jobDetails?.sefopeNumber) {
      issues.push({
        employee: emp,
        field: "sefope",
        severity: "warning",
        issue: "SEFOPE number missing",
        action: "Add SEFOPE",
        path: `/people/employees?id=${id}&edit=true`,
      });
    }
  });

  // Errors first, then warnings
  return issues.sort((a, b) => {
    if (a.severity === "error" && b.severity !== "error") return -1;
    if (a.severity !== "error" && b.severity === "error") return 1;
    return 0;
  });
}

/** Count unique employees with any compliance issues */
export function countBlockedEmployees(issues: ComplianceIssue[]): number {
  return new Set(issues.map((i) => i.employee.id)).size;
}

/** Only payroll-blocking issues (severity === "error") */
export function getPayrollBlockers(issues: ComplianceIssue[]): ComplianceIssue[] {
  return issues.filter((i) => i.severity === "error");
}
