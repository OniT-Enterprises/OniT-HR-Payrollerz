import "./global.css";
import React, { Suspense, lazy } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FirebaseProvider } from "@/contexts/FirebaseContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { HRChatProvider } from "@/contexts/HRChatContext";
import HRChatWidget from "@/components/chat/HRChatWidget";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SuperadminRoute } from "@/components/auth/SuperadminRoute";

// Essential routes - eagerly loaded (first paint)
import Login from "@/pages/auth/Login";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Lazy loaded routes - code split by section
const Settings = lazy(() => import("./pages/Settings"));
const Signup = lazy(() => import("./pages/auth/Signup"));

// Section Dashboards
const PeopleDashboard = lazy(() => import("./pages/PeopleDashboard"));
const PayrollDashboard = lazy(() => import("./pages/PayrollDashboard"));
const AccountingDashboard = lazy(() => import("./pages/AccountingDashboard"));
const ReportsDashboard = lazy(() => import("./pages/ReportsDashboard"));

// People - Staff
const AllEmployees = lazy(() => import("./pages/staff/AllEmployees"));
const AddEmployee = lazy(() => import("./pages/staff/AddEmployee"));
const Departments = lazy(() => import("./pages/staff/Departments"));
const OrganizationChart = lazy(() => import("./pages/staff/OrganizationChart"));

// People - Hiring
const CreateJobLocal = lazy(() => import("./pages/hiring/CreateJobLocal"));
const CandidateSelection = lazy(() => import("./pages/hiring/CandidateSelection"));
const Interviews = lazy(() => import("./pages/hiring/Interviews"));
const Onboarding = lazy(() => import("./pages/hiring/Onboarding"));
const Offboarding = lazy(() => import("./pages/hiring/Offboarding"));

// People - Time & Leave
const TimeTracking = lazy(() => import("./pages/time-leave/TimeTracking"));
const Attendance = lazy(() => import("./pages/time-leave/Attendance"));
const LeaveRequests = lazy(() => import("./pages/time-leave/LeaveRequests"));
const ShiftScheduling = lazy(() => import("./pages/time-leave/ShiftScheduling"));

// People - Performance
const Reviews = lazy(() => import("./pages/performance/Reviews"));
const Goals = lazy(() => import("./pages/performance/Goals"));
const TrainingCertifications = lazy(() => import("./pages/performance/TrainingCertifications"));
const Disciplinary = lazy(() => import("./pages/performance/Disciplinary"));

// Payroll
const RunPayroll = lazy(() => import("./pages/payroll/RunPayroll"));
const PayrollHistory = lazy(() => import("./pages/payroll/PayrollHistory"));
const TaxReports = lazy(() => import("./pages/payroll/TaxReports"));
const BankTransfers = lazy(() => import("./pages/payroll/BankTransfers"));
const BenefitsEnrollment = lazy(() => import("./pages/payroll/BenefitsEnrollment"));
const DeductionsAdvances = lazy(() => import("./pages/payroll/DeductionsAdvances"));

// Money (Invoicing)
const MoneyDashboard = lazy(() => import("./pages/MoneyDashboard"));
const Customers = lazy(() => import("./pages/money/Customers"));
const Invoices = lazy(() => import("./pages/money/Invoices"));
const InvoiceForm = lazy(() => import("./pages/money/InvoiceForm"));
const Payments = lazy(() => import("./pages/money/Payments"));
const Vendors = lazy(() => import("./pages/money/Vendors"));
const Expenses = lazy(() => import("./pages/money/Expenses"));
const Bills = lazy(() => import("./pages/money/Bills"));
const BillForm = lazy(() => import("./pages/money/BillForm"));
const ProfitLoss = lazy(() => import("./pages/money/ProfitLoss"));
const BalanceSheet = lazy(() => import("./pages/money/BalanceSheet"));
const Cashflow = lazy(() => import("./pages/money/Cashflow"));
const ARAgingReport = lazy(() => import("./pages/money/ARAgingReport"));
const APAgingReport = lazy(() => import("./pages/money/APAgingReport"));
const BankReconciliation = lazy(() => import("./pages/money/BankReconciliation"));

// Accounting
const ChartOfAccounts = lazy(() => import("./pages/accounting/ChartOfAccounts"));
const JournalEntries = lazy(() => import("./pages/accounting/JournalEntries"));
const GeneralLedger = lazy(() => import("./pages/accounting/GeneralLedger"));
const TrialBalance = lazy(() => import("./pages/accounting/TrialBalance"));

// Reports
const PayrollReports = lazy(() => import("./pages/reports/PayrollReports"));
const EmployeeReports = lazy(() => import("./pages/reports/EmployeeReports"));
const AttendanceReports = lazy(() => import("./pages/reports/AttendanceReports"));
const CustomReports = lazy(() => import("./pages/reports/CustomReports"));
const DepartmentReports = lazy(() => import("./pages/reports/DepartmentReports"));
const SetupReports = lazy(() => import("./pages/reports/SetupReports"));

// Admin
const SeedDatabase = lazy(() => import("./pages/admin/SeedDatabase"));
const TenantList = lazy(() => import("./pages/admin/TenantList"));
const TenantDetail = lazy(() => import("./pages/admin/TenantDetail"));
const CreateTenant = lazy(() => import("./pages/admin/CreateTenant"));
const UserList = lazy(() => import("./pages/admin/UserList"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const AdminSetup = lazy(() => import("./pages/admin/AdminSetup"));

// Smart home route - shows landing for guests, appropriate dashboard for users
import { useAuth } from "@/contexts/AuthContext";

function HomeRoute() {
  const { user, userProfile, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  // Not logged in - show landing page
  if (!user) {
    return <Landing />;
  }

  // User without a user profile - needs to complete setup
  if (user && !userProfile) {
    return <Navigate to="/admin/setup" replace />;
  }

  // Check if user has any tenants
  const hasTenants = userProfile?.tenantIds && userProfile.tenantIds.length > 0;

  if (!hasTenants) {
    // Superadmin without tenants goes to admin dashboard
    if (isSuperAdmin) {
      return <Navigate to="/admin/tenants" replace />;
    }
    // Regular user without tenants needs setup
    return <Navigate to="/admin/setup" replace />;
  }

  // User with tenants - show regular dashboard
  return <Dashboard />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <FirebaseProvider>
                <AuthProvider>
                  <TenantProvider>
                    <HRChatProvider>
                    <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Auth & Core */}
                      <Route path="/auth/login" element={<Login />} />
                      <Route path="/auth/signup" element={<Signup />} />
                      <Route path="/" element={<HomeRoute />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/landing" element={<Landing />} />
                      <Route path="/settings" element={<Settings />} />

                    {/* ========================================== */}
                    {/* PEOPLE - All HR-related routes             */}
                    {/* ========================================== */}

                    {/* People Hub Dashboard */}
                    <Route path="/people" element={<PeopleDashboard />} />

                    {/* Staff */}
                    <Route path="/people/employees" element={<AllEmployees />} />
                    <Route path="/people/add" element={<AddEmployee />} />
                    <Route path="/people/departments" element={<Departments />} />
                    <Route path="/people/org-chart" element={<OrganizationChart />} />

                    {/* Hiring */}
                    <Route path="/people/jobs" element={<CreateJobLocal />} />
                    <Route path="/people/candidates" element={<CandidateSelection />} />
                    <Route path="/people/interviews" element={<Interviews />} />
                    <Route path="/people/onboarding" element={<Onboarding />} />
                    <Route path="/people/offboarding" element={<Offboarding />} />

                    {/* Time & Leave */}
                    <Route path="/people/time-tracking" element={<TimeTracking />} />
                    <Route path="/people/attendance" element={<Attendance />} />
                    <Route path="/people/leave" element={<LeaveRequests />} />
                    <Route path="/people/schedules" element={<ShiftScheduling />} />

                    {/* Performance */}
                    <Route path="/people/goals" element={<Goals />} />
                    <Route path="/people/reviews" element={<Reviews />} />
                    <Route path="/people/training" element={<TrainingCertifications />} />
                    <Route path="/people/disciplinary" element={<Disciplinary />} />

                    {/* ========================================== */}
                    {/* PAYROLL                                    */}
                    {/* ========================================== */}
                    <Route path="/payroll" element={<PayrollDashboard />} />
                    <Route path="/payroll/run" element={<RunPayroll />} />
                    <Route path="/payroll/history" element={<PayrollHistory />} />
                    <Route path="/payroll/transfers" element={<BankTransfers />} />
                    <Route path="/payroll/taxes" element={<TaxReports />} />
                    <Route path="/payroll/benefits" element={<BenefitsEnrollment />} />
                    <Route path="/payroll/deductions" element={<DeductionsAdvances />} />

                    {/* ========================================== */}
                    {/* MONEY (INVOICING)                          */}
                    {/* ========================================== */}
                    <Route path="/money" element={<MoneyDashboard />} />
                    <Route path="/money/customers" element={<Customers />} />
                    <Route path="/money/invoices" element={<Invoices />} />
                    <Route path="/money/invoices/new" element={<InvoiceForm />} />
                    <Route path="/money/invoices/:id" element={<InvoiceForm />} />
                    <Route path="/money/invoices/:id/edit" element={<InvoiceForm />} />
                    <Route path="/money/payments" element={<Payments />} />
                    <Route path="/money/vendors" element={<Vendors />} />
                    <Route path="/money/expenses" element={<Expenses />} />
                    <Route path="/money/bills" element={<Bills />} />
                    <Route path="/money/bills/new" element={<BillForm />} />
                    <Route path="/money/bills/:id" element={<BillForm />} />
                    <Route path="/money/bills/:id/edit" element={<BillForm />} />
                    <Route path="/money/profit-loss" element={<ProfitLoss />} />
                    <Route path="/money/balance-sheet" element={<BalanceSheet />} />
                    <Route path="/money/cashflow" element={<Cashflow />} />
                    <Route path="/money/ar-aging" element={<ARAgingReport />} />
                    <Route path="/money/ap-aging" element={<APAgingReport />} />
                    <Route path="/money/bank-reconciliation" element={<BankReconciliation />} />

                    {/* ========================================== */}
                    {/* ACCOUNTING                                 */}
                    {/* ========================================== */}
                    <Route path="/accounting" element={<AccountingDashboard />} />
                    <Route path="/accounting/chart-of-accounts" element={<ChartOfAccounts />} />
                    <Route path="/accounting/journal-entries" element={<JournalEntries />} />
                    <Route path="/accounting/general-ledger" element={<GeneralLedger />} />
                    <Route path="/accounting/trial-balance" element={<TrialBalance />} />
                    {/* TODO: Add Financial Reports page */}
                    <Route path="/accounting/reports" element={<PayrollReports />} />

                    {/* ========================================== */}
                    {/* REPORTS                                    */}
                    {/* ========================================== */}
                    <Route path="/reports" element={<ReportsDashboard />} />
                    <Route path="/reports/payroll" element={<PayrollReports />} />
                    <Route path="/reports/employees" element={<EmployeeReports />} />
                    <Route path="/reports/attendance" element={<AttendanceReports />} />
                    <Route path="/reports/custom" element={<CustomReports />} />
                    <Route path="/reports/departments" element={<DepartmentReports />} />
                    <Route path="/reports/setup" element={<SetupReports />} />

                    {/* ========================================== */}
                    {/* LEGACY REDIRECTS - Backward compatibility  */}
                    {/* ========================================== */}

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

                    {/* ========================================== */}
                    {/* ADMIN - Superadmin only                   */}
                    {/* ========================================== */}
                    {/* Bootstrap route - not protected, handles its own access control */}
                    <Route path="/admin/setup" element={<AdminSetup />} />
                    <Route path="/admin" element={<Navigate to="/admin/tenants" replace />} />
                    <Route path="/admin/tenants" element={
                      <SuperadminRoute>
                        <TenantList />
                      </SuperadminRoute>
                    } />
                    <Route path="/admin/tenants/new" element={
                      <SuperadminRoute>
                        <CreateTenant />
                      </SuperadminRoute>
                    } />
                    <Route path="/admin/tenants/:id" element={
                      <SuperadminRoute>
                        <TenantDetail />
                      </SuperadminRoute>
                    } />
                    <Route path="/admin/seed" element={
                      <SuperadminRoute>
                        <SeedDatabase />
                      </SuperadminRoute>
                    } />
                    <Route path="/admin/users" element={
                      <SuperadminRoute>
                        <UserList />
                      </SuperadminRoute>
                    } />
                    <Route path="/admin/audit" element={
                      <SuperadminRoute>
                        <AuditLog />
                      </SuperadminRoute>
                    } />

                      {/* Catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </Suspense>
                    <HRChatWidget />
                    </HRChatProvider>
                  </TenantProvider>
                </AuthProvider>
              </FirebaseProvider>
            </ErrorBoundary>
          </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
