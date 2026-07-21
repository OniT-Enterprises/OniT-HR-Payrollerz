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
  "/people/jobs": () => import("@/pages/hiring/HiringWorkspace"),
  "/people/jobs/new": () => import("@/pages/hiring/CreateJobLocal"),
  "/people/onboarding": () => import("@/pages/hiring/Onboarding"),
  "/people/offboarding": () => import("@/pages/hiring/Offboarding"),
  "/people/reviews": () => import("@/pages/performance/Reviews"),
  "/people/goals": () => import("@/pages/performance/Goals"),
  "/people/training": () => import("@/pages/performance/TrainingCertifications"),
  "/people/disciplinary": () => import("@/pages/performance/Disciplinary"),

  // Time & Leave
  "/time-leave/attendance": () => import("@/pages/time-leave/Attendance"),
  "/time-leave/leave": () => import("@/pages/time-leave/LeaveRequests"),
  "/time-leave/shifts": () => import("@/pages/time-leave/ShiftScheduling"),
  "/time-leave/settings": () => import("@/pages/time-leave/TimeLeaveSettings"),

  // Payroll
  "/payroll/run": () => import("@/pages/payroll/RunPayrollWizard"),
  "/payroll/history": () => import("@/pages/payroll/PayrollHistory"),
  "/payroll/payments": () => import("@/pages/payroll/BankTransfers"),
  "/payroll/tax": () => import("@/pages/payroll/TaxReports"),
  "/payroll/settings": () => import("@/pages/payroll/PayrollSettings"),
  "/payroll/benefits": () => import("@/pages/payroll/BenefitsEnrollment"),
  "/payroll/deductions": () => import("@/pages/payroll/DeductionsAdvances"),

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
  "/accounting/reconciliation": () => import("@/pages/money/BankReconciliation"),
  "/accounting/statements/income-statement": () => import("@/pages/accounting/IncomeStatement"),
  "/accounting/statements/balance-sheet": () => import("@/pages/accounting/BalanceSheet"),
  "/accounting/statements/cash-flow": () => import("@/pages/money/Cashflow"),

  // Reports
  "/reports/payroll": () => import("@/pages/reports/PayrollReports"),
  "/reports/employees": () => import("@/pages/reports/EmployeeReports"),
  "/reports/attendance": () => import("@/pages/reports/AttendanceReports"),
  "/reports/departments": () => import("@/pages/reports/DepartmentReports"),
};

const prefetched = new Set<string>();

/**
 * Prefetch a route's JS chunk. Safe to call multiple times — deduplicates.
 */
export function prefetchRoute(path: string) {
  if (prefetched.has(path)) return;
  const importer = ROUTE_IMPORTS[path];
  if (importer) {
    prefetched.add(path);
    importer().catch(() => {
      prefetched.delete(path);
    });
  }
}

/**
 * Prefetch the most common routes after the app is idle.
 * Call once from App.tsx after initial render.
 */
export function prefetchCommonRoutesOnIdle() {
  const COMMON_ROUTES = [
    "/people/employees",
    "/payroll/run",
    "/payroll/history",
    "/money/invoices",
    "/time-leave/attendance",
    "/time-leave/leave",
    "/accounting/chart",
    "/reports/payroll",
  ];

  const prefetchBatch = () => {
    COMMON_ROUTES.forEach(prefetchRoute);
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(prefetchBatch, { timeout: 5000 });
  } else {
    setTimeout(prefetchBatch, 3000);
  }
}
