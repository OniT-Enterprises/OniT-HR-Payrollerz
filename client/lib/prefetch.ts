/**
 * Route prefetching — preload page JS chunks on sidebar hover.
 * Maps URL paths to their lazy import functions so chunks start
 * downloading before the user clicks.
 */

const ROUTE_IMPORTS: Record<string, () => Promise<unknown>> = {
  // People
  "/people/employees": () => import("@/pages/staff/AllEmployees"),
  "/people/add": () => import("@/pages/staff/AddEmployee"),
  "/people/announcements": () => import("@/pages/staff/Announcements"),
  "/people/grievances": () => import("@/pages/staff/GrievanceInbox"),
  "/people/jobs": () => import("@/pages/hiring/CreateJobLocal"),
  "/people/candidates": () => import("@/pages/hiring/CandidateSelection"),
  "/people/interviews": () => import("@/pages/hiring/Interviews"),
  "/people/onboarding": () => import("@/pages/hiring/Onboarding"),
  "/people/offboarding": () => import("@/pages/hiring/Offboarding"),
  "/people/reviews": () => import("@/pages/performance/Reviews"),
  "/people/goals": () => import("@/pages/performance/Goals"),
  "/people/training": () => import("@/pages/performance/TrainingCertifications"),
  "/people/disciplinary": () => import("@/pages/performance/Disciplinary"),

  // Time & Leave
  "/time-leave/attendance": () => import("@/pages/time-leave/Attendance"),
  "/time-leave/leave": () => import("@/pages/time-leave/LeaveRequests"),
  "/time-leave/tracking": () => import("@/pages/time-leave/TimeTracking"),
  "/time-leave/shifts": () => import("@/pages/time-leave/ShiftScheduling"),
  "/time-leave/settings": () => import("@/pages/time-leave/TimeLeaveSettings"),

  // Payroll
  "/payroll/run": () => import("@/pages/payroll/RunPayrollWizard"),
  "/payroll/history": () => import("@/pages/payroll/PayrollHistory"),
  "/payroll/payments": () => import("@/pages/payroll/BankTransfers"),
  "/payroll/tax": () => import("@/pages/payroll/TaxReports"),
  "/payroll/settings": () => import("@/pages/payroll/PayrollSettings"),
  "/payroll/settings/benefits": () => import("@/pages/payroll/BenefitsEnrollment"),
  "/payroll/settings/deductions": () => import("@/pages/payroll/DeductionsAdvances"),

  // Money
  "/money/invoices": () => import("@/pages/money/Invoices"),
  "/money/bills": () => import("@/pages/money/Bills"),
  "/money/expenses": () => import("@/pages/money/Expenses"),
  "/money/customers": () => import("@/pages/money/Customers"),
  "/money/vendors": () => import("@/pages/money/Vendors"),
  "/money/payments": () => import("@/pages/money/Payments"),

  // Accounting
  "/accounting/chart": () => import("@/pages/accounting/ChartOfAccounts"),
  "/accounting/journal": () => import("@/pages/accounting/JournalEntries"),
  "/accounting/ledger": () => import("@/pages/accounting/GeneralLedger"),
  "/accounting/reconciliation": () => import("@/pages/accounting/BalanceSheet"),

  // Reports
  "/reports/payroll": () => import("@/pages/reports/PayrollReports"),
  "/reports/employees": () => import("@/pages/reports/EmployeeReports"),
  "/reports/attendance": () => import("@/pages/reports/AttendanceReports"),
  "/reports/departments": () => import("@/pages/reports/DepartmentReports"),
};

const prefetched = new Set<string>();

/** Prefetch a route's JS chunk. Safe to call multiple times — deduplicates. */
export function prefetchRoute(path: string) {
  if (prefetched.has(path)) return;
  const importer = ROUTE_IMPORTS[path];
  if (importer) {
    prefetched.add(path);
    importer().catch(() => {
      // Failed to prefetch — will load normally on navigation
      prefetched.delete(path);
    });
  }
}
