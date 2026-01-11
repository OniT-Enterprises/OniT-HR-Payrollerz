import "./global.css";
import React from "react";
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
import Login from "@/pages/auth/Login";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";

// Section Dashboards
import PeopleDashboard from "./pages/PeopleDashboard";
import PayrollDashboard from "./pages/PayrollDashboard";
import AccountingDashboard from "./pages/AccountingDashboard";
import ReportsDashboard from "./pages/ReportsDashboard";

// People - Staff
import AllEmployees from "./pages/staff/AllEmployees";
import AddEmployee from "./pages/staff/AddEmployee";
import Departments from "./pages/staff/Departments";
import OrganizationChart from "./pages/staff/OrganizationChart";

// People - Hiring
import CreateJobLocal from "./pages/hiring/CreateJobLocal";
import CandidateSelection from "./pages/hiring/CandidateSelection";
import Interviews from "./pages/hiring/Interviews";
import Onboarding from "./pages/hiring/Onboarding";
import Offboarding from "./pages/hiring/Offboarding";

// People - Time & Leave
import TimeTracking from "./pages/time-leave/TimeTracking";
import Attendance from "./pages/time-leave/Attendance";
import LeaveRequests from "./pages/time-leave/LeaveRequests";
import ShiftScheduling from "./pages/time-leave/ShiftScheduling";

// People - Performance
import Reviews from "./pages/performance/Reviews";
import Goals from "./pages/performance/Goals";
import TrainingCertifications from "./pages/performance/TrainingCertifications";
import Disciplinary from "./pages/performance/Disciplinary";

// Payroll
import RunPayroll from "./pages/payroll/RunPayroll";
import PayrollHistory from "./pages/payroll/PayrollHistory";
import TaxReports from "./pages/payroll/TaxReports";
import BankTransfers from "./pages/payroll/BankTransfers";
import BenefitsEnrollment from "./pages/payroll/BenefitsEnrollment";
import DeductionsAdvances from "./pages/payroll/DeductionsAdvances";

// Accounting
import ChartOfAccounts from "./pages/accounting/ChartOfAccounts";
import JournalEntries from "./pages/accounting/JournalEntries";
import GeneralLedger from "./pages/accounting/GeneralLedger";
import TrialBalance from "./pages/accounting/TrialBalance";

// Reports (distributed - will eventually move into pillars)
import PayrollReports from "./pages/reports/PayrollReports";
import EmployeeReports from "./pages/reports/EmployeeReports";
import AttendanceReports from "./pages/reports/AttendanceReports";
import CustomReports from "./pages/reports/CustomReports";
import DepartmentReports from "./pages/reports/DepartmentReports";
import SetupReports from "./pages/reports/SetupReports";

// Admin & Other
import NotFound from "./pages/NotFound";
import SeedDatabase from "./pages/admin/SeedDatabase";
import TenantList from "./pages/admin/TenantList";
import TenantDetail from "./pages/admin/TenantDetail";
import CreateTenant from "./pages/admin/CreateTenant";
import UserList from "./pages/admin/UserList";
import AuditLog from "./pages/admin/AuditLog";
import AdminSetup from "./pages/admin/AdminSetup";
import { SuperadminRoute } from "@/components/auth/SuperadminRoute";

// Auth
import Signup from "./pages/auth/Signup";
import Landing from "./pages/Landing";

// Smart home route - shows landing for guests, appropriate dashboard for users
import { useAuth } from "@/contexts/AuthContext";

function HomeRoute() {
  const { user, userProfile, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
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

const queryClient = new QueryClient();

const App = () => (
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
);

export default App;
