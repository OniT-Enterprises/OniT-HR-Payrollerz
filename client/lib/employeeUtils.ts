import type { Employee } from "@/services/employeeService";
import { buildEmployeeComplianceSnapshot } from "@/lib/employeeCompliance";
import { hasExceededFixedTermLimit, contractSpanExceedsFixedTermLimit } from "@/lib/probation";

interface ProfileCompletenessResult {
  completionPercentage: number;
  isComplete: boolean;
  missingFields: string[];
  requiredDocuments: {
    field: string;
    missing: boolean;
    required: boolean;
  }[];
}

/**
 * How complete a profile is *for the things Xefe actually has to do* — run
 * payroll and file the statutory returns. Nothing else counts.
 *
 * Scored, and only these:
 *  - full name, INSS number (NISS), residency answer, hire date — the INSS
 *    monthly DR cannot be produced without them (plus a termination date once
 *    someone has left, which is what takes them off the DR);
 *  - monthly salary and hire date — payroll cannot price a period without them.
 *
 * Email, phone, address, date of birth, employee ID, department and job title
 * are deliberately OPTIONAL on the Add Employee form (many Timorese workers
 * have no email address, and no return asks for a job title). Scoring them
 * made a correctly-created employee read ~25% complete and nagged the owner
 * about fields we had just told them to skip, which trains people to ignore
 * the warning that matters. They are reported nowhere here.
 */
export function getProfileCompleteness(employee: Employee): ProfileCompletenessResult {
  const missingFields: string[] = [];
  let completed = 0;
  let total = 0;

  const score = (label: string, present: boolean) => {
    total++;
    if (present) completed++;
    else missingFields.push(label);
  };

  // Identity on the return: the DR lists a worker by name and NISS.
  score('First Name', !!employee.personalInfo?.firstName);
  score('Last Name', !!employee.personalInfo?.lastName);
  score(
    'INSS Number (NISS)',
    !!(
      employee.documents?.socialSecurityNumber?.number ||
      employee.personalInfo?.socialSecurityNumber
    ),
  );

  // Residency drives the WIT rate, so "not answered" is a real gap — but
  // `false` (non-resident) is a complete answer, not a missing one.
  score('Residency Status', typeof employee.compensation?.isResident === 'boolean');

  // Payroll and the DR both need the dates and the wage.
  score('Hire Date', !!employee.jobDetails?.hireDate);
  score('Monthly Salary', !!employee.compensation?.monthlySalary);

  // Only once someone has left: the DR needs the date that removes them.
  if (employee.status === 'terminated') {
    score('Termination Date', !!employee.terminationDate);
  }

  // Documents are shown for information. NISS is the only one a filing
  // depends on; a passport is required to employ a foreign worker at all.
  // The rest are useful records, never a reason to call a profile incomplete.
  const requiredDocuments = [
    {
      field: 'INSS (NISS)',
      missing: !(
        employee.documents?.socialSecurityNumber?.number ||
        employee.personalInfo?.socialSecurityNumber
      ),
      required: true,
    },
    {
      field: 'Passport',
      missing: !employee.documents?.passport?.number,
      required: employee.documents?.passport?.required ?? !!employee.isForeignWorker,
    },
    {
      field: 'Tax Number (TIN)',
      missing: !employee.documents?.taxIdentificationNumber?.number,
      required: false,
    },
    {
      field: 'ID Card',
      missing: !(
        employee.documents?.bilheteIdentidade?.number || employee.documents?.idCard?.number
      ),
      required: false,
    },
    {
      field: 'Electoral Card',
      missing: !employee.documents?.electoralCard?.number,
      required: false,
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

type ComplianceField = "inss" | "contract" | "department" | "fixedTermOverLimit";
type ComplianceSeverity = "error" | "warning";

interface ComplianceIssue {
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
 * - "warning" = should fix but doesn't block payroll (department)
 */
export function getComplianceIssues(employees: Employee[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  employees.forEach((emp) => {
    const id = emp.id || "";
    const compliance = emp.compliance ?? buildEmployeeComplianceSnapshot(emp);

    // INSS number — required for tax filing
    if (compliance.missingInss) {
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
    if (compliance.missingContract) {
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
    if (compliance.missingDepartment) {
      issues.push({
        employee: emp,
        field: "department",
        severity: "warning",
        issue: "No department assigned",
        action: "Assign",
        path: `/people/employees?id=${id}&edit=true`,
      });
    }

    // Fixed-term contract past 3 years — converts to permanent by operation of
    // TL law. Triggers on elapsed time since hire OR on the dated span
    // (hireDate -> contractEndDate) already exceeding 3 years (Arts. 12(4)/13).
    const employmentType = emp.jobDetails?.employmentType || "";
    const looksFixedTerm =
      !!emp.jobDetails?.contractEndDate || /fixed|contract|temp/i.test(employmentType);
    const elapsedOverLimit = hasExceededFixedTermLimit(emp.jobDetails?.hireDate);
    const spanOverLimit = contractSpanExceedsFixedTermLimit(
      emp.jobDetails?.hireDate,
      emp.jobDetails?.contractEndDate,
    );
    if (looksFixedTerm && (elapsedOverLimit || spanOverLimit)) {
      issues.push({
        employee: emp,
        field: "fixedTermOverLimit",
        severity: "warning",
        issue: elapsedOverLimit
          ? "Fixed-term over 3 years — convert to permanent"
          : "Fixed-term contract spans over 3 years — convert to permanent",
        action: "Convert",
        path: `/people/employees?id=${id}`,
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
