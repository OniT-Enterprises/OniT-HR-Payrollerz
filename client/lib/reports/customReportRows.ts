/**
 * Pure row helpers for the Custom Reports page (client/pages/reports/
 * CustomReports.tsx). Firebase-free on purpose so unit tests can import it
 * without VITE_FIREBASE_* env (see docs/CI notes: CI has no Firebase env).
 */

export interface CustomReportRowFilters {
  department?: string;
  status?: string;
  dateRange?: string;
}

/**
 * Resolve a possibly-nested column key ("personalInfo.firstName") against a
 * row object. Missing / null values render as "-" in the preview table.
 */
export function getColumnValue(
  row: Record<string, unknown>,
  key: string,
): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (object, part) => (object as Record<string, unknown>)?.[part],
      row,
    );
  return value !== undefined && value !== null ? String(value) : "-";
}

/**
 * Apply the employee-source filters (status, department) from a saved report
 * config. Empty-string filters (the "all" choice, stored as "") match everything.
 */
export function filterEmployeeRows<
  T extends { status?: string; jobDetails?: { department?: string } },
>(rows: T[], filters: CustomReportRowFilters): T[] {
  return rows.filter((row) => {
    if (filters.status && row.status !== filters.status) return false;
    if (
      filters.department &&
      row.jobDetails?.department !== filters.department
    )
      return false;
    return true;
  });
}

/** Add the real employee count to each department row. */
export function addDepartmentHeadcounts<
  TDepartment extends { name: string },
  TEmployee extends { jobDetails?: { department?: string } },
>(departments: TDepartment[], employees: TEmployee[]) {
  const counts = employees.reduce<Record<string, number>>(
    (headcountByDepartment, employee) => {
      const department = employee.jobDetails?.department;
      if (department) {
        headcountByDepartment[department] =
          (headcountByDepartment[department] ?? 0) + 1;
      }
      return headcountByDepartment;
    },
    {},
  );

  return departments.map((department) => ({
    ...department,
    headcount: counts[department.name] ?? 0,
  }));
}
