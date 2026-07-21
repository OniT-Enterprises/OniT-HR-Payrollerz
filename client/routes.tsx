/* eslint-disable react-refresh/only-export-components */
/**
 * Route definitions organized by module
 * Extracted from App.tsx for better maintainability
 */

import React, { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import { SuperadminRoute } from "@/components/auth/SuperadminRoute";
import { FeatureRoute } from "@/components/auth/FeatureRoute";
import { MarketingRouteFallback } from "@/components/marketing/MarketingRouteFallback";

// The boot splash is dismissed immediately on public paths, so the lazy
// marketing chunks need a dark, hero-shaped fallback of their own — the
// generic in-app RouteLoadingFallback would flash a light skeleton over the
// near-black marketing canvas.
function marketingRoute(page: React.ReactNode) {
  return (
    <React.Suspense fallback={<MarketingRouteFallback />}>
      {page}
    </React.Suspense>
  );
}

// After a deploy, hashed chunk filenames change; users holding a stale
// index.html hit a failed dynamic import and land on a dead page. Reload once
// (at most once per minute, to avoid loops) to pick up the fresh index.html.
function lazyWithRetry<P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      const KEY = "xefe-chunk-reload-at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 60_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        await new Promise(() => {}); // page is reloading; never resolve
      }
      throw error;
    }
  });
}

// Lazy loaded routes - code split by section
const Login = lazyWithRetry(() => import("@/pages/auth/Login"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const Landing = lazyWithRetry(() => import("@/pages/Landing"));
const Sitemap = lazyWithRetry(() => import("@/pages/Sitemap"));
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const Settings = lazyWithRetry(() => import("@/pages/Settings"));
const CompanySettings = lazyWithRetry(() => import("@/pages/settings/CompanySettings"));
const TeamAccessSettings = lazyWithRetry(() => import("@/pages/settings/TeamAccessSettings"));
const PaymentsSettings = lazyWithRetry(() => import("@/pages/settings/PaymentsSettings"));
const IntegrationsSettings = lazyWithRetry(() => import("@/pages/settings/IntegrationsSettings"));
const Billing = lazyWithRetry(() => import("@/pages/Billing"));
const Signup = lazyWithRetry(() => import("@/pages/auth/Signup"));
const AuthOnboarding = lazyWithRetry(() => import("@/pages/auth/Onboarding"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/auth/ForgotPassword"));
const ProductDetails = lazyWithRetry(() => import("@/pages/ProductDetails"));
const Pricing = lazyWithRetry(() => import("@/pages/Pricing"));
const AccountantPartners = lazyWithRetry(() => import("@/pages/AccountantPartners"));
const XefeEngine = lazyWithRetry(() => import("@/pages/XefeEngine"));
const SecurityPage = lazyWithRetry(() => import("@/pages/SecurityPage"));
const DocsIndex = lazyWithRetry(() => import("@/pages/DocsIndex"));
const DocsMoneyChain = lazyWithRetry(() => import("@/pages/DocsMoneyChain"));
const AccountantPortfolioDashboard = lazyWithRetry(() => import("@/pages/AccountantPortfolioDashboard"));
const Unauthorized = lazyWithRetry(() => import("@/pages/Unauthorized"));

// Section Dashboards (kept for /*/overview routes but not default landing)
const PeopleDashboard = lazyWithRetry(() => import("@/pages/PeopleDashboard"));
const SchedulingDashboard = lazyWithRetry(() => import("@/pages/SchedulingDashboard"));
const PayrollDashboard = lazyWithRetry(() => import("@/pages/PayrollDashboard"));
const AccountingDashboard = lazyWithRetry(() => import("@/pages/AccountingDashboard"));
const ReportsDashboard = lazyWithRetry(() => import("@/pages/ReportsDashboard"));

// People - Staff
const AllEmployees = lazyWithRetry(() => import("@/pages/staff/AllEmployees"));
const AddEmployee = lazyWithRetry(() => import("@/pages/staff/AddEmployee"));
const Departments = lazyWithRetry(() => import("@/pages/staff/Departments"));
const OrganizationChart = lazyWithRetry(() => import("@/pages/staff/OrganizationChart"));
const Announcements = lazyWithRetry(() => import("@/pages/staff/Announcements"));
const GrievanceInbox = lazyWithRetry(() => import("@/pages/staff/GrievanceInbox"));

// People - Hiring
const HiringWorkspace = lazyWithRetry(() => import("@/pages/hiring/HiringWorkspace"));
const CreateJobLocal = lazyWithRetry(() => import("@/pages/hiring/CreateJobLocal"));
const Onboarding = lazyWithRetry(() => import("@/pages/hiring/Onboarding"));
const Offboarding = lazyWithRetry(() => import("@/pages/hiring/Offboarding"));
const PublicApply = lazyWithRetry(() => import("@/pages/hiring/PublicApply"));
const PublicInvoice = lazyWithRetry(() => import("@/pages/money/PublicInvoice"));
const LegalPage = lazyWithRetry(() => import("@/pages/legal/LegalPage"));

// People - Time & Leave
const Attendance = lazyWithRetry(() => import("@/pages/time-leave/Attendance"));
const LeaveRequests = lazyWithRetry(() => import("@/pages/time-leave/LeaveRequests"));
const ShiftScheduling = lazyWithRetry(() => import("@/pages/time-leave/ShiftScheduling"));
const TimeLeaveSettings = lazyWithRetry(() => import("@/pages/time-leave/TimeLeaveSettings"));

// People - Performance
const Reviews = lazyWithRetry(() => import("@/pages/performance/Reviews"));
const Goals = lazyWithRetry(() => import("@/pages/performance/Goals"));
const TrainingCertifications = lazyWithRetry(() => import("@/pages/performance/TrainingCertifications"));
const Disciplinary = lazyWithRetry(() => import("@/pages/performance/Disciplinary"));

// Payroll
const RunPayrollWizard = lazyWithRetry(() => import("@/pages/payroll/RunPayrollWizard"));
const PayrollHistory = lazyWithRetry(() => import("@/pages/payroll/PayrollHistory"));
const TaxReports = lazyWithRetry(() => import("@/pages/payroll/TaxReports"));
const BankTransfers = lazyWithRetry(() => import("@/pages/payroll/BankTransfers"));
const BenefitsEnrollment = lazyWithRetry(() => import("@/pages/payroll/BenefitsEnrollment"));
const DeductionsAdvances = lazyWithRetry(() => import("@/pages/payroll/DeductionsAdvances"));
const PayrollSettings = lazyWithRetry(() => import("@/pages/payroll/PayrollSettings"));
const TaxClearance = lazyWithRetry(() => import("@/pages/payroll/TaxClearance"));
const AnnualIncomeTaxPrep = lazyWithRetry(() => import("@/pages/reports/AnnualIncomeTaxPrep"));

// Money (Invoicing)
const MoneyDashboard = lazyWithRetry(() => import("@/pages/MoneyDashboard"));
const Customers = lazyWithRetry(() => import("@/pages/money/Customers"));
const Invoices = lazyWithRetry(() => import("@/pages/money/Invoices"));
const InvoiceForm = lazyWithRetry(() => import("@/pages/money/InvoiceForm"));
const InvoiceSettings = lazyWithRetry(() => import("@/pages/money/InvoiceSettings"));
const RecurringInvoices = lazyWithRetry(() => import("@/pages/money/RecurringInvoices"));
const RecurringInvoiceForm = lazyWithRetry(() => import("@/pages/money/RecurringInvoiceForm"));
const Payments = lazyWithRetry(() => import("@/pages/money/Payments"));
const Vendors = lazyWithRetry(() => import("@/pages/money/Vendors"));
const Expenses = lazyWithRetry(() => import("@/pages/money/Expenses"));
const CashAdvances = lazyWithRetry(() => import("@/pages/money/CashAdvances"));
const Bills = lazyWithRetry(() => import("@/pages/money/Bills"));
const BillForm = lazyWithRetry(() => import("@/pages/money/BillForm"));
const Cashflow = lazyWithRetry(() => import("@/pages/money/Cashflow"));
const ARAgingReport = lazyWithRetry(() => import("@/pages/money/ARAgingReport"));
const APAgingReport = lazyWithRetry(() => import("@/pages/money/APAgingReport"));
const BankReconciliation = lazyWithRetry(() => import("@/pages/money/BankReconciliation"));

// Accounting
const ChartOfAccounts = lazyWithRetry(() => import("@/pages/accounting/ChartOfAccounts"));
const JournalEntries = lazyWithRetry(() => import("@/pages/accounting/JournalEntries"));
const GeneralLedger = lazyWithRetry(() => import("@/pages/accounting/GeneralLedger"));
const FixedAssets = lazyWithRetry(() => import("@/pages/accounting/FixedAssets"));
const TrialBalance = lazyWithRetry(() => import("@/pages/accounting/TrialBalance"));
const IncomeStatement = lazyWithRetry(() => import("@/pages/accounting/IncomeStatement"));
const AccountingBalanceSheet = lazyWithRetry(() => import("@/pages/accounting/BalanceSheet"));
const FiscalPeriods = lazyWithRetry(() => import("@/pages/accounting/FiscalPeriods"));
const AccountingAuditTrail = lazyWithRetry(() => import("@/pages/accounting/AuditTrail"));

// Reports
const PayrollReports = lazyWithRetry(() => import("@/pages/reports/PayrollReports"));
const EmployeeReports = lazyWithRetry(() => import("@/pages/reports/EmployeeReports"));
const AttendanceReports = lazyWithRetry(() => import("@/pages/reports/AttendanceReports"));
const CustomReports = lazyWithRetry(() => import("@/pages/reports/CustomReports"));
const DepartmentReports = lazyWithRetry(() => import("@/pages/reports/DepartmentReports"));
const SetupReports = lazyWithRetry(() => import("@/pages/reports/SetupReports"));
const ATTLMonthlyWIT = lazyWithRetry(() => import("@/pages/reports/ATTLMonthlyWIT"));
const INSSMonthly = lazyWithRetry(() => import("@/pages/reports/INSSMonthly"));
const INSSAnnual = lazyWithRetry(() => import("@/pages/reports/INSSAnnual"));
const PayrollAllocationReport = lazyWithRetry(() => import("@/pages/reports/PayrollAllocationReport"));
const DonorExportPack = lazyWithRetry(() => import("@/pages/reports/DonorExportPack"));

// Settings
const SetupWizard = lazyWithRetry(() => import("@/pages/settings/SetupWizard"));
const VATSettings = lazyWithRetry(() => import("@/pages/money/VATSettings"));
const VATReturns = lazyWithRetry(() => import("@/pages/money/VATReturns"));

// Admin
const AdminConsoleHome = lazyWithRetry(() => import("@/pages/admin/AdminConsoleHome"));
const SeedDatabase = lazyWithRetry(() => import("@/pages/admin/SeedDatabase"));
const TenantList = lazyWithRetry(() => import("@/pages/admin/TenantList"));
const TenantDetail = lazyWithRetry(() => import("@/pages/admin/TenantDetail"));
const CreateTenant = lazyWithRetry(() => import("@/pages/admin/CreateTenant"));
const UserList = lazyWithRetry(() => import("@/pages/admin/UserList"));
const PackagesPage = lazyWithRetry(() => import("@/pages/admin/PackagesPage"));
const ContractTemplatesAdmin = lazyWithRetry(() => import("@/pages/admin/ContractTemplates"));
const AuditLog = lazyWithRetry(() => import("@/pages/admin/AuditLog"));
const AdminSetup = lazyWithRetry(() => import("@/pages/admin/AdminSetup"));
const DocumentAlerts = lazyWithRetry(() => import("@/pages/admin/DocumentAlerts"));
const ForeignWorkers = lazyWithRetry(() => import("@/pages/admin/ForeignWorkers"));

// Export components for use in HomeRoute
export { AccountantPortfolioDashboard, Dashboard, Landing };

/**
 * Auth & Core Routes
 */
export const authRoutes = (
  <>
    <Route path="/auth/login" element={<Login />} />
    <Route path="/auth/signup" element={<Signup />} />
    <Route path="/auth/forgot-password" element={<ForgotPassword />} />
    <Route path="/auth/onboarding" element={<AuthOnboarding />} />
    {/* Public candidate apply page — no auth required */}
    <Route path="/apply/:jobId" element={<PublicApply />} />
    {/* Public hosted invoice page — no auth required */}
    <Route path="/i/:token" element={<PublicInvoice />} />
    <Route path="/privacy" element={<LegalPage kind="privacy" />} />
    <Route path="/terms" element={<LegalPage kind="terms" />} />
    <Route
      path="/dashboard"
      element={
        <FeatureRoute fallbackPath="/">
          <Dashboard />
        </FeatureRoute>
      }
    />
    <Route path="/landing" element={marketingRoute(<Landing />)} />
    <Route path="/how-it-works" element={marketingRoute(<ProductDetails />)} />
    <Route path="/pricing" element={marketingRoute(<Pricing />)} />
    <Route path="/accountants" element={marketingRoute(<AccountantPartners />)} />
    <Route path="/engine" element={marketingRoute(<XefeEngine />)} />
    <Route path="/security" element={marketingRoute(<SecurityPage />)} />
    <Route path="/docs" element={marketingRoute(<DocsIndex />)} />
    <Route path="/docs/payroll-money-chain" element={marketingRoute(<DocsMoneyChain />)} />
    {/* Locale-prefixed marketing pages (/tet/..., /pt/...) so each language is
        crawlable at its own URL (hreflang). PublicLocaleSync inside PublicNav
        switches the i18n locale from the prefix. English stays at the bare path. */}
    {["tet", "pt"].map((prefix) => (
      <React.Fragment key={prefix}>
        <Route path={`/${prefix}`} element={marketingRoute(<Landing />)} />
        <Route path={`/${prefix}/how-it-works`} element={marketingRoute(<ProductDetails />)} />
        <Route path={`/${prefix}/pricing`} element={marketingRoute(<Pricing />)} />
        <Route path={`/${prefix}/accountants`} element={marketingRoute(<AccountantPartners />)} />
        <Route path={`/${prefix}/engine`} element={marketingRoute(<XefeEngine />)} />
        <Route path={`/${prefix}/security`} element={marketingRoute(<SecurityPage />)} />
        <Route path={`/${prefix}/docs`} element={marketingRoute(<DocsIndex />)} />
        <Route path={`/${prefix}/docs/payroll-money-chain`} element={marketingRoute(<DocsMoneyChain />)} />
      </React.Fragment>
    ))}
    <Route path="/features" element={<Navigate to="/how-it-works" replace />} />
    <Route path="/unauthorized" element={<Unauthorized />} />
    <Route
      path="/accountant/clients"
      element={
        <FeatureRoute fallbackPath="/">
          <AccountantPortfolioDashboard />
        </FeatureRoute>
      }
    />
    <Route
      path="/settings"
      element={
        <FeatureRoute requireManage>
          <Settings />
        </FeatureRoute>
      }
    />
    <Route
      path="/settings/company"
      element={
        <FeatureRoute requireManage>
          <CompanySettings />
        </FeatureRoute>
      }
    />
    <Route
      path="/settings/access"
      element={
        <FeatureRoute requireHrAdmin>
          <TeamAccessSettings />
        </FeatureRoute>
      }
    />
    <Route
      path="/settings/payments"
      element={
        <FeatureRoute requireManage>
          <PaymentsSettings />
        </FeatureRoute>
      }
    />
    <Route
      path="/settings/integrations"
      element={
        <FeatureRoute requireManage>
          <IntegrationsSettings />
        </FeatureRoute>
      }
    />
    <Route
      path="/billing"
      element={
        <FeatureRoute fallbackPath="/">
          <Billing />
        </FeatureRoute>
      }
    />
    <Route
      path="/settings/departments"
      element={
        <FeatureRoute requiredModule="staff" requireManage>
          <Departments />
        </FeatureRoute>
      }
    />
    <Route
      path="/settings/org-chart"
      element={
        <FeatureRoute requiredModule="staff" requireManage>
          <OrganizationChart />
        </FeatureRoute>
      }
    />
    <Route
      path="/settings/foreign-workers"
      element={
        <FeatureRoute requiredModule="staff" requireManage>
          <ForeignWorkers />
        </FeatureRoute>
      }
    />
    <Route
      path="/setup"
      element={
        <FeatureRoute requireManage fallbackPath="/dashboard">
          <SetupWizard />
        </FeatureRoute>
      }
    />
    <Route
      path="/sitemap"
      element={
        <FeatureRoute fallbackPath="/">
          <Sitemap />
        </FeatureRoute>
      }
    />
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
        <FeatureRoute requiredAnyModules={["staff", "hiring", "performance"]}>
          <PeopleDashboard />
        </FeatureRoute>
      }
    />

    {/* Staff hub → straight to employee directory */}
    <Route path="/people/staff" element={<Navigate to="/people/employees" replace />} />

    {/* Hub redirects → straight to first sub-page */}
    <Route path="/people/hiring" element={<Navigate to="/people/jobs" replace />} />
    <Route path="/people/performance" element={<Navigate to="/people/reviews" replace />} />

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
        <FeatureRoute requiredModule="staff" requireManage>
          <AddEmployee />
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
          <HiringWorkspace />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/jobs/new"
      element={
        <FeatureRoute requiredModule="hiring">
          <CreateJobLocal />
        </FeatureRoute>
      }
    />
    <Route path="/people/candidates" element={<Navigate to="/people/jobs" replace />} />
    <Route path="/people/applications" element={<Navigate to="/people/jobs" replace />} />
    <Route path="/people/interviews" element={<Navigate to="/people/jobs" replace />} />
    <Route
      path="/people/onboarding"
      element={
        <FeatureRoute requiredModule="staff" requireManage>
          <Onboarding />
        </FeatureRoute>
      }
    />
    <Route
      path="/people/offboarding"
      element={
        <FeatureRoute requiredModule="staff" requireManage>
          <Offboarding />
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
 * Time & Leave Module Routes (Attendance, Leave, Shifts)
 */
export const schedulingRoutes = (
  <>
    <Route
      path="/time-leave"
      element={
        <FeatureRoute requiredModule="timeleave">
          <SchedulingDashboard />
        </FeatureRoute>
      }
    />
    <Route
      path="/time-leave/time-tracking"
      element={<Navigate to="/time-leave/attendance" replace />}
    />
    <Route
      path="/time-leave/attendance"
      element={
        <FeatureRoute requiredModule="timeleave">
          <Attendance />
        </FeatureRoute>
      }
    />
    <Route
      path="/time-leave/leave"
      element={
        <FeatureRoute requiredModule="timeleave">
          <LeaveRequests />
        </FeatureRoute>
      }
    />
    <Route
      path="/time-leave/shifts"
      element={
        <FeatureRoute requiredModule="timeleave" requirePeopleManager>
          <ShiftScheduling />
        </FeatureRoute>
      }
    />
    <Route
      path="/time-leave/settings"
      element={
        <FeatureRoute requiredModule="timeleave" requireHrAdmin>
          <TimeLeaveSettings />
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
        <FeatureRoute requiredModule="payroll" requireManage>
          <RunPayrollWizard />
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
      path="/payroll/payments"
      element={
        <FeatureRoute requiredModule="payroll">
          <BankTransfers />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/tax"
      element={
        <FeatureRoute requiredModule="payroll" requireManage>
          <TaxReports />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/benefits"
      element={
        <FeatureRoute requiredModule="payroll" requireManage>
          <BenefitsEnrollment />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/deductions"
      element={
        <FeatureRoute requiredModule="payroll" requireManage>
          <DeductionsAdvances />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/settings"
      element={
        <FeatureRoute requiredModule="payroll" requireManage>
          <PayrollSettings />
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
        <FeatureRoute requiredModule="money" requireManage>
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
        <FeatureRoute requiredModule="money" requireManage>
          <InvoiceForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/settings"
      element={
        <FeatureRoute requiredModule="money" requireManage>
          <InvoiceSettings />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/recurring"
      element={
        <FeatureRoute requiredModule="money" requireManage>
          <RecurringInvoices />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/recurring/new"
      element={
        <FeatureRoute requiredModule="money" requireManage>
          <RecurringInvoiceForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/recurring/:id"
      element={
        <FeatureRoute requiredModule="money" requireManage>
          <RecurringInvoiceForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/invoices/recurring/:id/edit"
      element={
        <FeatureRoute requiredModule="money" requireManage>
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
        <FeatureRoute requiredModule="money" requireManager>
          <Expenses />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/cash-advances"
      element={
        <FeatureRoute requiredModule="money" requireManage>
          <CashAdvances />
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
        <FeatureRoute requiredModule="money" requireManage>
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
        <FeatureRoute requiredModule="money" requireManage>
          <BillForm />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/financials/ar-aging"
      element={
        <FeatureRoute requiredModule="money">
          <ARAgingReport />
        </FeatureRoute>
      }
    />
    <Route
      path="/money/financials/ap-aging"
      element={
        <FeatureRoute requiredModule="money">
          <APAgingReport />
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
      path="/accounting/chart"
      element={
        <FeatureRoute requiredModule="accounting">
          <ChartOfAccounts />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/journal"
      element={
        <FeatureRoute requiredModule="accounting">
          <JournalEntries />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/ledger"
      element={
        <FeatureRoute requiredModule="accounting">
          <GeneralLedger />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/fixed-assets"
      element={
        <FeatureRoute requiredModule="accounting">
          <FixedAssets />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/reconciliation"
      element={
        <FeatureRoute requiredModule="accounting" requireManage>
          <BankReconciliation />
        </FeatureRoute>
      }
    />

    {/* Statements */}
    <Route
      path="/accounting/statements/trial-balance"
      element={
        <FeatureRoute requiredModule="accounting">
          <TrialBalance />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/statements/income-statement"
      element={
        <FeatureRoute requiredModule="accounting">
          <IncomeStatement />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/statements/balance-sheet"
      element={
        <FeatureRoute requiredModule="accounting">
          <AccountingBalanceSheet />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/statements/cash-flow"
      element={
        <FeatureRoute requiredModule="accounting">
          <Cashflow />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/statements/fiscal-periods"
      element={
        <FeatureRoute requiredModule="accounting" requireManage>
          <FiscalPeriods />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/statements/audit-trail"
      element={
        <FeatureRoute requiredModule="accounting">
          <AccountingAuditTrail />
        </FeatureRoute>
      }
    />

    {/* Business tax and compliance. Wage tax + INSS remain under Payroll. */}
    <Route
      path="/accounting/tax/annual-income-tax"
      element={
        <FeatureRoute requiredModule="accounting" requireManage>
          <AnnualIncomeTaxPrep />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/tax/clearance"
      element={
        <FeatureRoute requiredModule="accounting" requireManage requireAdvancedTax="accounting">
          <TaxClearance />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/tax/vat-settings"
      element={
        <FeatureRoute requiredModule="accounting" requireManage requireAdvancedTax="accounting">
          <VATSettings />
        </FeatureRoute>
      }
    />
    <Route
      path="/accounting/tax/vat-returns"
      element={
        <FeatureRoute requiredModule="accounting" requireManage requireAdvancedTax="accounting">
          <VATReturns />
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
        <FeatureRoute requiredAllModules={["reports", "payroll"]}>
          <PayrollReports />
        </FeatureRoute>
      }
    />
    <Route
      path="/reports/employees"
      element={
        <FeatureRoute requiredAllModules={["reports", "staff"]}>
          <EmployeeReports />
        </FeatureRoute>
      }
    />
    <Route path="/reports/employee" element={<Navigate to="/reports/employees" replace />} />
    <Route
      path="/reports/attendance"
      element={
        <FeatureRoute requiredAllModules={["reports", "timeleave"]}>
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
        <FeatureRoute requiredAllModules={["reports", "staff"]}>
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
          requiredAllModules={["payroll", "staff"]}
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
          requiredAllModules={["payroll", "staff"]}
          requireManage
          requireNgoReporting
          fallbackPath="/reports"
        >
          <DonorExportPack />
        </FeatureRoute>
      }
    />

    {/* Tax Filings (ATTL) — moved to /payroll/tax/* */}
    <Route
      path="/payroll/tax/monthly-wit"
      element={
        <FeatureRoute requiredModule="payroll" requireManage requireAdvancedTax="payroll">
          <ATTLMonthlyWIT />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/tax/inss-monthly"
      element={
        <FeatureRoute requiredModule="payroll" requireManage>
          <INSSMonthly />
        </FeatureRoute>
      }
    />
    <Route
      path="/payroll/tax/inss-annual"
      element={
        <FeatureRoute requiredModule="payroll" requireManage>
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
    <Route path="/staff" element={<Navigate to="/people/staff" replace />} />
    <Route path="/staff/employees" element={<Navigate to="/people/employees" replace />} />
    <Route path="/staff/add" element={<Navigate to="/people/add" replace />} />
    <Route path="/staff/departments" element={<Navigate to="/settings/departments" replace />} />
    <Route path="/staff/org-chart" element={<Navigate to="/settings/org-chart" replace />} />

    {/* Old Hiring routes */}
    <Route path="/hiring" element={<Navigate to="/people/hiring" replace />} />
    <Route path="/hiring/create-job" element={<Navigate to="/people/jobs/new" replace />} />
    <Route path="/hiring/jobs/create" element={<Navigate to="/people/jobs/new" replace />} />
    <Route path="/hiring/candidates" element={<Navigate to="/people/jobs" replace />} />
    <Route path="/hiring/interviews" element={<Navigate to="/people/jobs" replace />} />
    <Route path="/hiring/onboarding" element={<Navigate to="/people/onboarding" replace />} />
    <Route path="/hiring/offboarding" element={<Navigate to="/people/offboarding" replace />} />

    {/* Old /scheduling/* routes → now /time-leave/* */}
    <Route path="/scheduling" element={<Navigate to="/time-leave" replace />} />
    <Route path="/scheduling/time-tracking" element={<Navigate to="/time-leave/attendance" replace />} />
    <Route path="/scheduling/attendance" element={<Navigate to="/time-leave/attendance" replace />} />
    <Route path="/scheduling/leave" element={<Navigate to="/time-leave/leave" replace />} />
    <Route path="/scheduling/schedules" element={<Navigate to="/time-leave/shifts" replace />} />

    {/* Old /time-leave/* variant routes → canonical /time-leave/* */}
    <Route path="/time-leave/tracking" element={<Navigate to="/time-leave/attendance" replace />} />
    <Route path="/time-leave/requests" element={<Navigate to="/time-leave/leave" replace />} />
    <Route path="/time-leave/scheduling" element={<Navigate to="/time-leave/shifts" replace />} />

    {/* Old People time & leave routes → now /time-leave/* */}
    <Route path="/people/time-tracking" element={<Navigate to="/time-leave/attendance" replace />} />
    <Route path="/people/attendance" element={<Navigate to="/time-leave/attendance" replace />} />
    <Route path="/people/leave" element={<Navigate to="/time-leave/leave" replace />} />
    <Route path="/people/schedules" element={<Navigate to="/time-leave/shifts" replace />} />

    {/* Old People org routes → now /settings/* */}
    <Route path="/people/departments" element={<Navigate to="/settings/departments" replace />} />
    <Route path="/people/org-chart" element={<Navigate to="/settings/org-chart" replace />} />

    {/* Old admin foreign-workers → now /settings/foreign-workers */}
    <Route path="/admin/foreign-workers" element={<Navigate to="/settings/foreign-workers" replace />} />

    {/* Old Performance routes */}
    <Route path="/performance" element={<Navigate to="/people/performance" replace />} />
    <Route path="/performance/goals" element={<Navigate to="/people/goals" replace />} />
    <Route path="/performance/reviews" element={<Navigate to="/people/reviews" replace />} />
    <Route path="/performance/training" element={<Navigate to="/people/training" replace />} />
    <Route path="/performance/disciplinary" element={<Navigate to="/people/disciplinary" replace />} />

    {/* Old Payroll routes */}
    <Route path="/payroll/settings/benefits" element={<Navigate to="/payroll/benefits" replace />} />
    <Route path="/payroll/settings/deductions" element={<Navigate to="/payroll/deductions" replace />} />
    <Route path="/payroll/transfers" element={<Navigate to="/payroll/payments" replace />} />
    <Route path="/payroll/taxes" element={<Navigate to="/payroll/tax" replace />} />

    {/* Old Accounting routes → now /accounting/chart, /accounting/journal, /accounting/ledger and /accounting/statements/* */}
    <Route path="/accounting/chart-of-accounts" element={<Navigate to="/accounting/chart" replace />} />
    <Route path="/accounting/journal-entries" element={<Navigate to="/accounting/journal" replace />} />
    <Route path="/accounting/general-ledger" element={<Navigate to="/accounting/ledger" replace />} />
    <Route path="/accounting/trial-balance" element={<Navigate to="/accounting/statements/trial-balance" replace />} />
    <Route path="/accounting/income-statement" element={<Navigate to="/accounting/statements/income-statement" replace />} />
    <Route path="/accounting/balance-sheet" element={<Navigate to="/accounting/statements/balance-sheet" replace />} />
    <Route path="/accounting/fiscal-periods" element={<Navigate to="/accounting/statements/fiscal-periods" replace />} />
    <Route path="/accounting/audit-trail" element={<Navigate to="/accounting/statements/audit-trail" replace />} />
    <Route path="/accounting/reports" element={<Navigate to="/accounting/statements/trial-balance" replace />} />

    {/* Consolidated financial statements and business tax */}
    <Route path="/money/financials/profit-loss" element={<Navigate to="/accounting/statements/income-statement" replace />} />
    <Route path="/money/financials/balance-sheet" element={<Navigate to="/accounting/statements/balance-sheet" replace />} />
    <Route path="/money/financials/cashflow" element={<Navigate to="/accounting/statements/cash-flow" replace />} />
    <Route path="/money/financials/reconciliation" element={<Navigate to="/accounting/reconciliation" replace />} />
    <Route path="/money/financials/vat-settings" element={<Navigate to="/accounting/tax/vat-settings" replace />} />
    <Route path="/money/financials/vat-returns" element={<Navigate to="/accounting/tax/vat-returns" replace />} />
    <Route path="/payroll/tax/clearance" element={<Navigate to="/accounting/tax/clearance" replace />} />
    <Route path="/payroll/tax/annual-income-tax" element={<Navigate to="/accounting/tax/annual-income-tax" replace />} />
  </>
);

/**
 * Admin Routes - Superadmin only (except setup)
 */
export const adminRoutes = (
  <>
    {/* Bootstrap route - not protected, handles its own access control */}
    <Route path="/admin/setup" element={<AdminSetup />} />
    {/* Document alerts - accessible to tenant users with staff access */}
    <Route
      path="/admin/document-alerts"
      element={
        <FeatureRoute requiredModule="staff" fallbackPath="/dashboard">
          <DocumentAlerts />
        </FeatureRoute>
      }
    />
    <Route
      path="/admin"
      element={
        <SuperadminRoute>
          <AdminConsoleHome />
        </SuperadminRoute>
      }
    />
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
      path="/admin/packages"
      element={
        <SuperadminRoute>
          <PackagesPage />
        </SuperadminRoute>
      }
    />
    <Route
      path="/admin/contract-templates"
      element={
        <SuperadminRoute>
          <ContractTemplatesAdmin />
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
