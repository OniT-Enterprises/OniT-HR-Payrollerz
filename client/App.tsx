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
import { I18nProvider } from "@/i18n/I18nProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "@/pages/auth/Login";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";

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
                    <Routes>
                      {/* Auth & Core */}
                      <Route path="/auth/login" element={<Login />} />
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/settings" element={<Settings />} />

                    {/* ========================================== */}
                    {/* PEOPLE - All HR-related routes             */}
                    {/* ========================================== */}

                    {/* People landing - redirect to employees */}
                    <Route path="/people" element={<Navigate to="/people/employees" replace />} />

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
                    <Route path="/payroll" element={<Navigate to="/payroll/run" replace />} />
                    <Route path="/payroll/run" element={<RunPayroll />} />
                    <Route path="/payroll/history" element={<PayrollHistory />} />
                    <Route path="/payroll/transfers" element={<BankTransfers />} />
                    <Route path="/payroll/taxes" element={<TaxReports />} />
                    <Route path="/payroll/benefits" element={<BenefitsEnrollment />} />
                    <Route path="/payroll/deductions" element={<DeductionsAdvances />} />

                    {/* ========================================== */}
                    {/* ACCOUNTING                                 */}
                    {/* ========================================== */}
                    <Route path="/accounting" element={<Navigate to="/accounting/chart-of-accounts" replace />} />
                    <Route path="/accounting/chart-of-accounts" element={<ChartOfAccounts />} />
                    <Route path="/accounting/journal-entries" element={<JournalEntries />} />
                    <Route path="/accounting/general-ledger" element={<GeneralLedger />} />
                    <Route path="/accounting/trial-balance" element={<TrialBalance />} />
                    {/* TODO: Add Financial Reports page */}
                    <Route path="/accounting/reports" element={<PayrollReports />} />

                    {/* ========================================== */}
                    {/* REPORTS - Temporary until distributed      */}
                    {/* ========================================== */}
                    <Route path="/reports" element={<Navigate to="/reports/payroll" replace />} />
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

                    {/* Admin */}
                    <Route path="/admin/seed" element={<SeedDatabase />} />

                      {/* Catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
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
