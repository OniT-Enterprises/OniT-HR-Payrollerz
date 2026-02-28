/* eslint-disable react-refresh/only-export-components */
/**
 * Route definitions organized by module
 * Extracted from App.tsx for better maintainability
 */

import React, { lazy, useMemo } from "react";
import { Route, Navigate } from "react-router-dom";
import { SuperadminRoute } from "@/components/auth/SuperadminRoute";
import { FeatureRoute } from "@/components/auth/FeatureRoute";

const splashMessages: [string, string][] = [
  // Tetun — conversational, people know these
  ["\u201CBainaka\u201D", "Welcome \u2014 let\u2019s get to work"],
  ["\u201CHamutuk ita bele\u201D", "Together we can"],
  ["\u201CServisu ho laran\u201D", "Work with heart"],
  ["\u201CLao ba oin\u201D", "Moving forward, always"],
  ["\u201CDi\u2019ak loron ida\u201D", "Have a good day"],
  ["\u201CProntu ona\u201D", "All set \u2014 almost there"],
  ["\u201CMeza prontu\u201D", "Your desk is ready"],
  ["\u201CHakarak di\u2019ak liu tan\u201D", "Always striving for better"],
  ["\u201CIta nia forsa maka ita nia ema\u201D", "Our strength is our people"],
  // Feature callouts
  ["Payroll. People. Accounting.", "Everything your business needs, one Meza."],
  ["Built for Timor-Leste", "INSS, WIT, subsidio anual \u2014 all handled."],
  ["Your back office, simplified", "From hire to retire, Meza has you covered."],
  ["Run payroll in minutes", "Not hours. Not headaches. Minutes."],
  ["Real-time financials", "Journal entries, trial balance, always up to date."],
  ["Track your team", "Attendance, leave, performance \u2014 all in one place."],
  // Fun personality
  ["Spreadsheets are so last decade", "Welcome to the future of HR."],
  ["Fueling the businesses of Timor-Leste", "One payroll at a time."],
  ["Where HR meets simplicity", "Meza \u2014 Tetum for \u201Cdesk.\u201D Your digital one."],
];

// Loading fallback component
export function PageLoader() {
  const [phrase, sub] = useMemo(
    () => splashMessages[Math.floor(Math.random() * splashMessages.length)],
    []
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/images/illustrations/logo-v2-light.webp"
          alt="Meza"
          className="h-10 w-auto dark:hidden"
        />
        <img
          src="/images/illustrations/logo-v2-dark.webp"
          alt="Meza"
          className="h-10 w-auto hidden dark:block"
        />
        <div className="animate-spin h-7 w-7 border-[3px] border-primary/20 border-t-primary rounded-full" />
        <div className="text-center max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-sm italic text-muted-foreground">{phrase}</p>
          <p className="text-xs text-muted-foreground/50 mt-1">{sub}</p>
        </div>
      </div>
    </div>
  );
}

// Essential routes - eagerly loaded (first paint)
import Login from "@/pages/auth/Login";
import NotFound from "@/pages/NotFound";

// Lazy loaded routes - code split by section
const Landing = lazy(() => import("@/pages/Landing"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Sitemap = lazy(() => import("@/pages/Sitemap"));
const Settings = lazy(() => import("@/pages/Settings"));
const Signup = lazy(() => import("@/pages/auth/Signup"));
const ProductDetails = lazy(() => import("@/pages/ProductDetails"));

// Section Dashboards
const PeopleDashboard = lazy(() => import("@/pages/PeopleDashboard"));
const PayrollDashboard = lazy(() => import("@/pages/PayrollDashboard"));
const AccountingDashboard = lazy(() => import("@/pages/AccountingDashboard"));
const ReportsDashboard = lazy(() => import("@/pages/ReportsDashboard"));

// People - Staff
const AllEmployees = lazy(() => import("@/pages/staff/AllEmployees"));
const AddEmployee = lazy(() => import("@/pages/staff/AddEmployee"));
const Departments = lazy(() => import("@/pages/staff/Departments"));
const OrganizationChart = lazy(() => import("@/pages/staff/OrganizationChart"));
const Announcements = lazy(() => import("@/pages/staff/Announcements"));
const GrievanceInbox = lazy(() => import("@/pages/staff/GrievanceInbox"));

// People - Hiring
const CreateJobLocal = lazy(() => import("@/pages/hiring/CreateJobLocal"));
const CandidateSelection = lazy(() => import("@/pages/hiring/CandidateSelection"));
const Interviews = lazy(() => import("@/pages/hiring/Interviews"));
const Onboarding = lazy(() => import("@/pages/hiring/Onboarding"));
const Offboarding = lazy(() => import("@/pages/hiring/Offboarding"));

// People - Time & Leave
const TimeTracking = lazy(() => import("@/pages/time-leave/TimeTracking"));
const Attendance = lazy(() => import("@/pages/time-leave/Attendance"));
const LeaveRequests = lazy(() => import("@/pages/time-leave/LeaveRequests"));
const ShiftScheduling = lazy(() => import("@/pages/time-leave/ShiftScheduling"));

// People - Performance
const Reviews = lazy(() => import("@/pages/performance/Reviews"));
const Goals = lazy(() => import("@/pages/performance/Goals"));
const TrainingCertifications = lazy(() => import("@/pages/performance/TrainingCertifications"));
const Disciplinary = lazy(() => import("@/pages/performance/Disciplinary"));

// Payroll
const RunPayroll = lazy(() => import("@/pages/payroll/RunPayroll"));
const PayrollHistory = lazy(() => import("@/pages/payroll/PayrollHistory"));
const TaxReports = lazy(() => import("@/pages/payroll/TaxReports"));
const BankTransfers = lazy(() => import("@/pages/payroll/BankTransfers"));
const BenefitsEnrollment = lazy(() => import("@/pages/payroll/BenefitsEnrollment"));
const DeductionsAdvances = lazy(() => import("@/pages/payroll/DeductionsAdvances"));

// Money (Invoicing)
const MoneyDashboard = lazy(() => import("@/pages/MoneyDashboard"));
const Customers = lazy(() => import("@/pages/money/Customers"));
const Invoices = lazy(() => import("@/pages/money/Invoices"));
const InvoiceForm = lazy(() => import("@/pages/money/InvoiceForm"));
const InvoiceSettings = lazy(() => import("@/pages/money/InvoiceSettings"));
const RecurringInvoices = lazy(() => import("@/pages/money/RecurringInvoices"));
const RecurringInvoiceForm = lazy(() => import("@/pages/money/RecurringInvoiceForm"));
const Payments = lazy(() => import("@/pages/money/Payments"));
const Vendors = lazy(() => import("@/pages/money/Vendors"));
const Expenses = lazy(() => import("@/pages/money/Expenses"));
const Bills = lazy(() => import("@/pages/money/Bills"));
const BillForm = lazy(() => import("@/pages/money/BillForm"));
const ProfitLoss = lazy(() => import("@/pages/money/ProfitLoss"));
const BalanceSheet = lazy(() => import("@/pages/money/BalanceSheet"));
const Cashflow = lazy(() => import("@/pages/money/Cashflow"));
const ARAgingReport = lazy(() => import("@/pages/money/ARAgingReport"));
const APAgingReport = lazy(() => import("@/pages/money/APAgingReport"));
const BankReconciliation = lazy(() => import("@/pages/money/BankReconciliation"));

// Accounting
const ChartOfAccounts = lazy(() => import("@/pages/accounting/ChartOfAccounts"));
const JournalEntries = lazy(() => import("@/pages/accounting/JournalEntries"));
const GeneralLedger = lazy(() => import("@/pages/accounting/GeneralLedger"));
const TrialBalance = lazy(() => import("@/pages/accounting/TrialBalance"));

// Reports
const PayrollReports = lazy(() => import("@/pages/reports/PayrollReports"));
const EmployeeReports = lazy(() => import("@/pages/reports/EmployeeReports"));
const AttendanceReports = lazy(() => import("@/pages/reports/AttendanceReports"));
const CustomReports = lazy(() => import("@/pages/reports/CustomReports"));
const DepartmentReports = lazy(() => import("@/pages/reports/DepartmentReports"));
const SetupReports = lazy(() => import("@/pages/reports/SetupReports"));
const ATTLMonthlyWIT = lazy(() => import("@/pages/reports/ATTLMonthlyWIT"));
const INSSMonthly = lazy(() => import("@/pages/reports/INSSMonthly"));
const INSSAnnual = lazy(() => import("@/pages/reports/INSSAnnual"));
const PayrollAllocationReport = lazy(() => import("@/pages/reports/PayrollAllocationReport"));
const DonorExportPack = lazy(() => import("@/pages/reports/DonorExportPack"));

// Settings
const SetupWizard = lazy(() => import("@/pages/settings/SetupWizard"));
const VATSettings = lazy(() => import("@/pages/money/VATSettings"));
const VATReturns = lazy(() => import("@/pages/money/VATReturns"));

// Admin
const SeedDatabase = lazy(() => import("@/pages/admin/SeedDatabase"));
const TenantList = lazy(() => import("@/pages/admin/TenantList"));
const TenantDetail = lazy(() => import("@/pages/admin/TenantDetail"));
const CreateTenant = lazy(() => import("@/pages/admin/CreateTenant"));
const UserList = lazy(() => import("@/pages/admin/UserList"));
const AuditLog = lazy(() => import("@/pages/admin/AuditLog"));
const AdminSetup = lazy(() => import("@/pages/admin/AdminSetup"));
const DocumentAlerts = lazy(() => import("@/pages/admin/DocumentAlerts"));
const ForeignWorkers = lazy(() => import("@/pages/admin/ForeignWorkers"));

// Export components for use in HomeRoute
export { Dashboard, Landing };

/**
 * Auth & Core Routes
 */
export const authRoutes = (
  <>
    <Route path="/auth/login" element={<Login />} />
    <Route path="/auth/signup" element={<Signup />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/landing" element={<Landing />} />
    <Route path="/features" element={<ProductDetails />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/setup" element={<SetupWizard />} />
    <Route path="/sitemap" element={<Sitemap />} />
  </>
);

/**
 * People Module Routes (Staff, Hiring, Time & Leave, Performance)
 */
export const peopleRoutes = (
  <>
    {/* People Hub Dashboard */}
    <Route
      path="/people"
      element={
        <FeatureRoute requiredAnyModules={["staff", "hiring", "timeleave", "performance"]}>
          <PeopleDashboard />
        </FeatureRoute>
      }
    />

    {/* Staff */}
    <Route
      path="/people/employees"
      element={
        <FeatureRoute requiredModule="staff">
          <AllEmployees />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/add"
      element={
        <FeatureRoute requiredModule="staff">
          <AddEmployee />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/departments"
      element={
        <FeatureRoute requiredModule="staff">
          <Departments />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/org-chart"
      element={
        <FeatureRoute requiredModule="staff">
          <OrganizationChart />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/announcements"
      element={
        <FeatureRoute requiredModule="staff">
          <Announcements />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/grievances"
      element={
        <FeatureRoute requiredModule="staff">
          <GrievanceInbox />
        </FeatureRoute>
      }
    />

    {/* Hiring */}
    <Route
      path="/people/jobs"
      element={
        <FeatureRoute requiredModule="hiring">
          <CreateJobLocal />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/candidates"
      element={
        <FeatureRoute requiredModule="hiring">
          <CandidateSelection />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/interviews"
      element={
        <FeatureRoute requiredModule="hiring">
          <Interviews />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/onboarding"
      element={
        <FeatureRoute requiredModule="hiring">
          <Onboarding />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/offboarding"
      element={
        <FeatureRoute requiredModule="hiring">
          <Offboarding />
        </FeatureRoute>
      }
    />

    {/* Time & Leave */}
    <Route
      path="/people/time-tracking"
      element={
        <FeatureRoute requiredModule="timeleave">
          <TimeTracking />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/attendance"
      element={
        <FeatureRoute requiredModule="timeleave">
          <Attendance />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/leave"
      element={
        <FeatureRoute requiredModule="timeleave">
          <LeaveRequests />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/schedules"
      element={
        <FeatureRoute requiredModule="timeleave">
          <ShiftScheduling />
        </FeatureRoute>
      }
    />

    {/* Performance */}
    <Route
      path="/people/goals"
      element={
        <FeatureRoute requiredModule="performance">
          <Goals />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/reviews"
      element={
        <FeatureRoute requiredModule="performance">
          <Reviews />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/training"
      element={
        <FeatureRoute requiredModule="performance">
          <TrainingCertifications />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/disciplinary"
      element={
        <FeatureRoute requiredModule="performance">
          <Disciplinary />
        </FeatureRoute>
      }
    />
  </>
);

/**
 * Payroll Module Routes
 */
export const payrollRoutes = (
  <>
    <Route
      path="/payroll"
      element={
        <FeatureRoute requiredModule="payroll">
          <PayrollDashboard />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/run"
      element={
        <FeatureRoute requiredModule="payroll">
          <RunPayroll />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/history"
      element={
        <FeatureRoute requiredModule="payroll">
          <PayrollHistory />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/transfers"
      element={
        <FeatureRoute requiredModule="payroll">
          <BankTransfers />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/taxes"
      element={
        <FeatureRoute requiredModule="payroll">
          <TaxReports />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/benefits"
      element={
        <FeatureRoute requiredModule="payroll">
          <BenefitsEnrollment />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/deductions"
      element={
        <FeatureRoute requiredModule="payroll">
          <DeductionsAdvances />
        </FeatureRoute>
      }
    />
  </>
);

/**
 * Money Module Routes (Invoicing, Expenses, Bills)
 */
export const moneyRoutes = (
  <>
    <Route
      path="/money"
      element={
        <FeatureRoute requiredModule="money">
          <MoneyDashboard />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/customers"
      element={
        <FeatureRoute requiredModule="money">
          <Customers />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices"
      element={
        <FeatureRoute requiredModule="money">
          <Invoices />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/new"
      element={
        <FeatureRoute requiredModule="money">
          <InvoiceForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/:id"
      element={
        <FeatureRoute requiredModule="money">
          <InvoiceForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/:id/edit"
      element={
        <FeatureRoute requiredModule="money">
          <InvoiceForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/settings"
      element={
        <FeatureRoute requiredModule="money">
          <InvoiceSettings />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/recurring"
      element={
        <FeatureRoute requiredModule="money">
          <RecurringInvoices />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/recurring/new"
      element={
        <FeatureRoute requiredModule="money">
          <RecurringInvoiceForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/recurring/:id"
      element={
        <FeatureRoute requiredModule="money">
          <RecurringInvoiceForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/recurring/:id/edit"
      element={
        <FeatureRoute requiredModule="money">
          <RecurringInvoiceForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/payments"
      element={
        <FeatureRoute requiredModule="money">
          <Payments />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/vendors"
      element={
        <FeatureRoute requiredModule="money">
          <Vendors />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/expenses"
      element={
        <FeatureRoute requiredModule="money">
          <Expenses />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/bills"
      element={
        <FeatureRoute requiredModule="money">
          <Bills />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/bills/new"
      element={
        <FeatureRoute requiredModule="money">
          <BillForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/bills/:id"
      element={
        <FeatureRoute requiredModule="money">
          <BillForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/bills/:id/edit"
      element={
        <FeatureRoute requiredModule="money">
          <BillForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/profit-loss"
      element={
        <FeatureRoute requiredModule="money">
          <ProfitLoss />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/balance-sheet"
      element={
        <FeatureRoute requiredModule="money">
          <BalanceSheet />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/cashflow"
      element={
        <FeatureRoute requiredModule="money">
          <Cashflow />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/ar-aging"
      element={
        <FeatureRoute requiredModule="money">
          <ARAgingReport />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/ap-aging"
      element={
        <FeatureRoute requiredModule="money">
          <APAgingReport />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/bank-reconciliation"
      element={
        <FeatureRoute requiredModule="money">
          <BankReconciliation />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/vat-settings"
      element={
        <FeatureRoute requiredModule="money">
          <VATSettings />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/vat-returns"
      element={
        <FeatureRoute requiredModule="money">
          <VATReturns />
        </FeatureRoute>
      }
    />
  </>
);

/**
 * Accounting Module Routes
 */
export const accountingRoutes = (
  <>
    <Route
      path="/accounting"
      element={
        <FeatureRoute requiredModule="accounting">
          <AccountingDashboard />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/chart-of-accounts"
      element={
        <FeatureRoute requiredModule="accounting">
          <ChartOfAccounts />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/journal-entries"
      element={
        <FeatureRoute requiredModule="accounting">
          <JournalEntries />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/general-ledger"
      element={
        <FeatureRoute requiredModule="accounting">
          <GeneralLedger />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/trial-balance"
      element={
        <FeatureRoute requiredModule="accounting">
          <TrialBalance />
        </FeatureRoute>
      }
    />
    {/* Reuses PayrollReports until a dedicated accounting reports page is built */}
    <Route
      path="/accounting/reports"
      element={
        <FeatureRoute requiredAllModules={["accounting", "reports"]}>
          <PayrollReports />
        </FeatureRoute>
      }
    />
  </>
);

/**
 * Reports Module Routes
 */
export const reportsRoutes = (
  <>
    <Route
      path="/reports"
      element={
        <FeatureRoute requiredModule="reports">
          <ReportsDashboard />
        </FeatureRoute>
      }
    />
    <Route
      path="/reports/payroll"
      element={
        <FeatureRoute requiredModule="reports">
          <PayrollReports />
        </FeatureRoute>
      }
    />
    <Route
      path="/reports/employees"
      element={
        <FeatureRoute requiredModule="reports">
          <EmployeeReports />
        </FeatureRoute>
      }
    />
    <Route path="/reports/employee" element={<Navigate to="/reports/employees" replace />} />
    <Route
      path="/reports/attendance"
      element={
        <FeatureRoute requiredModule="reports">
          <AttendanceReports />
        </FeatureRoute>
      }
    />
    <Route
      path="/reports/custom"
      element={
        <FeatureRoute requiredModule="reports">
          <CustomReports />
        </FeatureRoute>
      }
    />
    <Route
      path="/reports/departments"
      element={
        <FeatureRoute requiredModule="reports">
          <DepartmentReports />
        </FeatureRoute>
      }
    />
    <Route path="/reports/department" element={<Navigate to="/reports/departments" replace />} />
    <Route
      path="/reports/setup"
      element={
        <FeatureRoute requiredModule="reports">
          <SetupReports />
        </FeatureRoute>
      }
    />
    <Route
      path="/reports/payroll-allocation"
      element={
        <FeatureRoute
          requiredModule="reports"
          requireNgoReporting
          fallbackPath="/reports"
        >
          <PayrollAllocationReport />
        </FeatureRoute>
      }
    />
    <Route
      path="/reports/donor-export"
      element={
        <FeatureRoute
          requiredModule="reports"
          requireManage
          requireNgoReporting
          fallbackPath="/reports"
        >
          <DonorExportPack />
        </FeatureRoute>
      }
    />

    {/* Tax Filings (ATTL) */}
    <Route
      path="/reports/attl-monthly-wit"
      element={
        <FeatureRoute requiredModule="reports">
          <ATTLMonthlyWIT />
        </FeatureRoute>
      }
    />
    <Route
      path="/reports/inss-monthly"
      element={
        <FeatureRoute requiredModule="reports">
          <INSSMonthly />
        </FeatureRoute>
      }
    />
    <Route
      path="/reports/inss-annual"
      element={
        <FeatureRoute requiredModule="reports">
          <INSSAnnual />
        </FeatureRoute>
      }
    />
  </>
);

/**
 * Legacy Redirects - Backward compatibility for old URLs
 */
export const legacyRedirects = (
  <>
    {/* Old Staff routes */}
    <Route path="/staff" element={<Navigate to="/people/employees" replace />} />
    <Route path="/staff/employees" element={<Navigate to="/people/employees" replace />} />
    <Route path="/staff/add" element={<Navigate to="/people/add" replace />} />
    <Route path="/staff/departments" element={<Navigate to="/people/departments" replace />} />
    <Route path="/staff/org-chart" element={<Navigate to="/people/org-chart" replace />} />

    {/* Old Hiring routes */}
    <Route path="/hiring" element={<Navigate to="/people/jobs" replace />} />
    <Route path="/hiring/create-job" element={<Navigate to="/people/jobs" replace />} />
    <Route path="/hiring/jobs/create" element={<Navigate to="/people/jobs" replace />} />
    <Route path="/hiring/candidates" element={<Navigate to="/people/candidates" replace />} />
    <Route path="/hiring/interviews" element={<Navigate to="/people/interviews" replace />} />
    <Route path="/hiring/onboarding" element={<Navigate to="/people/onboarding" replace />} />
    <Route path="/hiring/offboarding" element={<Navigate to="/people/offboarding" replace />} />

    {/* Old Time & Leave routes */}
    <Route path="/time-leave" element={<Navigate to="/people/time-tracking" replace />} />
    <Route path="/time-leave/tracking" element={<Navigate to="/people/time-tracking" replace />} />
    <Route path="/time-leave/attendance" element={<Navigate to="/people/attendance" replace />} />
    <Route path="/time-leave/requests" element={<Navigate to="/people/leave" replace />} />
    <Route path="/time-leave/scheduling" element={<Navigate to="/people/schedules" replace />} />

    {/* Old Performance routes */}
    <Route path="/performance" element={<Navigate to="/people/goals" replace />} />
    <Route path="/performance/goals" element={<Navigate to="/people/goals" replace />} />
    <Route path="/performance/reviews" element={<Navigate to="/people/reviews" replace />} />
    <Route path="/performance/training" element={<Navigate to="/people/training" replace />} />
    <Route path="/performance/disciplinary" element={<Navigate to="/people/disciplinary" replace />} />
  </>
);

/**
 * Admin Routes - Superadmin only (except setup)
 */
export const adminRoutes = (
  <>
    {/* Bootstrap route - not protected, handles its own access control */}
    <Route path="/admin/setup" element={<AdminSetup />} />
    {/* Document alerts - accessible to all HR users */}
    <Route path="/admin/document-alerts" element={<DocumentAlerts />} />
    {/* Foreign workers - accessible to all HR users */}
    <Route path="/admin/foreign-workers" element={<ForeignWorkers />} />
    <Route path="/admin" element={<Navigate to="/admin/tenants" replace />} />
    <Route
      path="/admin/tenants"
      element={
        <SuperadminRoute>
          <TenantList />
        </SuperadminRoute>
      }
    />
    <Route
      path="/admin/tenants/new"
      element={
        <SuperadminRoute>
          <CreateTenant />
        </SuperadminRoute>
      }
    />
    <Route
      path="/admin/tenants/:id"
      element={
        <SuperadminRoute>
          <TenantDetail />
        </SuperadminRoute>
      }
    />
    {/* DEV ONLY: Seed Database - disabled in production builds */}
    {import.meta.env.DEV && (
      <Route
        path="/admin/seed"
        element={
          <SuperadminRoute>
            <SeedDatabase />
          </SuperadminRoute>
        }
      />
    )}
    <Route
      path="/admin/users"
      element={
        <SuperadminRoute>
          <UserList />
        </SuperadminRoute>
      }
    />
    <Route
      path="/admin/audit"
      element={
        <SuperadminRoute>
          <AuditLog />
        </SuperadminRoute>
      }
    />
  </>
);

/**
 * Catch-all 404 route
 */
export const notFoundRoute = <Route path="*" element={<NotFound />} />;
