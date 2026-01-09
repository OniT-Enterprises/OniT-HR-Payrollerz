import "./global.css";
import React from "react";

// Import ResizeObserver fix early to prevent console warnings
import "./lib/resizeObserverFix";

// Import Firebase isolation to prevent internal assertion errors
import "./lib/firebaseIsolation";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FirebaseProvider } from "@/contexts/FirebaseContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "@/pages/auth/Login";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import CreateJobLocal from "./pages/hiring/CreateJobLocal";
import CandidateSelection from "./pages/hiring/CandidateSelection";
import Interviews from "./pages/hiring/Interviews";
import Onboarding from "./pages/hiring/Onboarding";
import Offboarding from "./pages/hiring/Offboarding";
import AllEmployees from "./pages/staff/AllEmployees";
import AddEmployee from "./pages/staff/AddEmployee";
import Departments from "./pages/staff/Departments";
import OrganizationChart from "./pages/staff/OrganizationChart";
import TimeTracking from "./pages/time-leave/TimeTracking";
import Attendance from "./pages/time-leave/Attendance";
import LeaveRequests from "./pages/time-leave/LeaveRequests";
import ShiftScheduling from "./pages/time-leave/ShiftScheduling";
import Reviews from "./pages/performance/Reviews";
import Goals from "./pages/performance/Goals";
import TrainingCertifications from "./pages/performance/TrainingCertifications";
import Disciplinary from "./pages/performance/Disciplinary";
import RunPayroll from "./pages/payroll/RunPayroll";
import PayrollHistory from "./pages/payroll/PayrollHistory";
import TaxReports from "./pages/payroll/TaxReports";
import BankTransfers from "./pages/payroll/BankTransfers";
import BenefitsEnrollment from "./pages/payroll/BenefitsEnrollment";
import DeductionsAdvances from "./pages/payroll/DeductionsAdvances";
import HiringDashboard from "./pages/dashboards/HiringDashboard";
import StaffDashboard from "./pages/dashboards/StaffDashboard";
import TimeLeaveDashboard from "./pages/dashboards/TimeLeaveDashboard";
import PayrollReports from "./pages/reports/PayrollReports";
import EmployeeReports from "./pages/reports/EmployeeReports";
import AttendanceReports from "./pages/reports/AttendanceReports";
import CustomReports from "./pages/reports/CustomReports";
import DepartmentReports from "./pages/reports/DepartmentReports";
import SetupReports from "./pages/reports/SetupReports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <FirebaseProvider>
            <AuthProvider>
              <TenantProvider>
                <Routes>
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/hiring" element={<HiringDashboard />} />
                  <Route path="/staff" element={<StaffDashboard />} />
                  <Route path="/time-leave" element={<TimeLeaveDashboard />} />
                  <Route path="/performance" element={<Dashboard />} />
                  <Route path="/payroll" element={<Dashboard />} />
                  <Route path="/reports" element={<Dashboard />} />
                  <Route
                    path="/hiring/create-job"
                    element={<CreateJobLocal />}
                  />
                  <Route
                    path="/hiring/jobs/create"
                    element={<Navigate to="/hiring/create-job" replace />}
                  />
                  <Route
                    path="/hiring/candidates"
                    element={<CandidateSelection />}
                  />
                  <Route path="/hiring/interviews" element={<Interviews />} />
                  <Route path="/hiring/onboarding" element={<Onboarding />} />
                  <Route path="/hiring/offboarding" element={<Offboarding />} />
                  <Route path="/staff/employees" element={<AllEmployees />} />
                  <Route path="/staff/add" element={<AddEmployee />} />
                  <Route path="/staff/departments" element={<Departments />} />
                  <Route
                    path="/staff/org-chart"
                    element={<OrganizationChart />}
                  />
                  <Route
                    path="/time-leave/tracking"
                    element={<TimeTracking />}
                  />
                  <Route
                    path="/time-leave/attendance"
                    element={<Attendance />}
                  />
                  <Route
                    path="/time-leave/requests"
                    element={<LeaveRequests />}
                  />
                  <Route
                    path="/time-leave/scheduling"
                    element={<ShiftScheduling />}
                  />
                  <Route path="/performance/reviews" element={<Reviews />} />
                  <Route path="/performance/goals" element={<Goals />} />
                  <Route
                    path="/performance/training"
                    element={<TrainingCertifications />}
                  />
                  <Route
                    path="/performance/disciplinary"
                    element={<Disciplinary />}
                  />
                  <Route path="/payroll/run" element={<RunPayroll />} />
                  <Route path="/payroll/history" element={<PayrollHistory />} />
                  <Route path="/payroll/taxes" element={<TaxReports />} />
                  <Route
                    path="/payroll/transfers"
                    element={<BankTransfers />}
                  />
                  <Route
                    path="/payroll/benefits"
                    element={<BenefitsEnrollment />}
                  />
                  <Route
                    path="/payroll/deductions"
                    element={<DeductionsAdvances />}
                  />
                  <Route path="/reports/payroll" element={<PayrollReports />} />
                  <Route
                    path="/reports/employees"
                    element={<EmployeeReports />}
                  />
                  <Route
                    path="/reports/attendance"
                    element={<AttendanceReports />}
                  />
                  <Route path="/reports/custom" element={<CustomReports />} />
                  <Route
                    path="/reports/departments"
                    element={<DepartmentReports />}
                  />
                  <Route path="/reports/setup" element={<SetupReports />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </TenantProvider>
            </AuthProvider>
          </FirebaseProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
