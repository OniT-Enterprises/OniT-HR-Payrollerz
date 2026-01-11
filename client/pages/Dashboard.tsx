/**
 * Dashboard - Action-First Command Center
 * Shows what needs attention + quick actions
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import { employeeService, type Employee } from "@/services/employeeService";
import { departmentService } from "@/services/departmentService";
import { leaveService } from "@/services/leaveService";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrencyTL } from "@/lib/payroll/constants-tl";
import {
  Users,
  DollarSign,
  Building,
  TrendingUp,
  UserPlus,
  ChevronRight,
  Clock,
  FileText,
  Calculator,
  Heart,
  Calendar,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Keyboard,
} from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";

const theme = sectionThemes.dashboard;

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [onLeaveToday, setOnLeaveToday] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Enable keyboard shortcuts globally
  useKeyboardShortcuts({
    enabled: true,
    onShowHelp: () => setShowShortcuts(true),
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load each data source independently so one failure doesn't block others
      const [employeesResult, departmentsResult, leaveStatsResult] = await Promise.allSettled([
        employeeService.getAllEmployees(),
        departmentService.getAllDepartments(),
        leaveService.getLeaveStats(),
      ]);

      // Handle employees
      if (employeesResult.status === 'fulfilled') {
        setEmployees(employeesResult.value);
      } else {
        console.warn("Could not load employees:", employeesResult.reason);
        setEmployees([]);
      }

      // Handle departments
      if (departmentsResult.status === 'fulfilled') {
        setDepartmentCount(departmentsResult.value.length);
      } else {
        console.warn("Could not load departments:", departmentsResult.reason);
        setDepartmentCount(0);
      }

      // Handle leave stats
      if (leaveStatsResult.status === 'fulfilled') {
        setPendingLeave(leaveStatsResult.value.pendingRequests);
        setOnLeaveToday(leaveStatsResult.value.employeesOnLeaveToday);
      } else {
        console.warn("Could not load leave stats:", leaveStatsResult.reason);
        setPendingLeave(0);
        setOnLeaveToday(0);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeEmployees = employees.filter((e) => e.status === "active");
  const totalPayroll = activeEmployees.reduce(
    (sum, emp) => sum + (emp.compensation?.monthlySalary || 0),
    0
  );

  const recentHires = [...employees]
    .filter((e) => e.jobDetails?.hireDate)
    .sort((a, b) => {
      const dateA = new Date(a.jobDetails.hireDate);
      const dateB = new Date(b.jobDetails.hireDate);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  // Calculate days until next payroll (25th)
  const getDaysUntilPayday = () => {
    const now = new Date();
    let nextPay = new Date(now.getFullYear(), now.getMonth(), 25);
    if (now.getDate() > 25) {
      nextPay = new Date(now.getFullYear(), now.getMonth() + 1, 25);
    }
    return Math.ceil((nextPay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const daysUntilPayday = getDaysUntilPayday();
  const firstName = user?.displayName?.split(" ")[0] || "there";

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.dashboard} />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName}
          </h1>
          <p className="text-muted-foreground text-lg">
            Here's what needs your attention today
          </p>
        </div>

        {/* Action Cards - What needs attention */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {/* Pending Leave */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              pendingLeave > 0 ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" : ""
            }`}
            onClick={() => navigate("/people/leave")}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {pendingLeave > 0 ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    <span className="font-semibold">Leave Requests</span>
                  </div>
                  <p className="text-3xl font-bold">{pendingLeave}</p>
                  <p className="text-sm text-muted-foreground">
                    {pendingLeave > 0 ? "awaiting approval" : "all caught up"}
                  </p>
                </div>
                {pendingLeave > 0 && (
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600">
                    Review
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payroll Due */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              daysUntilPayday <= 7 ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : ""
            }`}
            onClick={() => navigate("/payroll/run")}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calculator className="h-5 w-5 text-green-500" />
                    <span className="font-semibold">Payroll</span>
                  </div>
                  <p className="text-3xl font-bold">{daysUntilPayday} days</p>
                  <p className="text-sm text-muted-foreground">until next pay date</p>
                </div>
                {daysUntilPayday <= 7 && (
                  <Button size="sm" className="bg-green-500 hover:bg-green-600">
                    Run Payroll
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* On Leave Today */}
          <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => navigate("/people/attendance")}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarDays className="h-5 w-5 text-cyan-500" />
                    <span className="font-semibold">On Leave Today</span>
                  </div>
                  <p className="text-3xl font-bold">{onLeaveToday}</p>
                  <p className="text-sm text-muted-foreground">
                    {onLeaveToday === 1 ? "employee" : "employees"} out
                  </p>
                </div>
                <Badge variant="secondary">{activeEmployees.length - onLeaveToday} in office</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Bar */}
        <Card className="mb-8">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground mr-2">Quick Actions:</span>
              <Button variant="outline" size="sm" onClick={() => navigate("/people/add")}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/payroll/run")}>
                <Calculator className="h-4 w-4 mr-2" />
                Run Payroll
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/people/leave")}>
                <Heart className="h-4 w-4 mr-2" />
                Manage Leave
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/people/attendance")}>
                <Clock className="h-4 w-4 mr-2" />
                Attendance
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
                <FileText className="h-4 w-4 mr-2" />
                Reports
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/people/employees")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{activeEmployees.length}</p>
                  <p className="text-sm text-muted-foreground">Active Employees</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/payroll/run")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatCurrencyTL(totalPayroll)}</p>
                  <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/people/departments")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{departmentCount}</p>
                  <p className="text-sm text-muted-foreground">Departments</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Building className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {activeEmployees.length > 0
                      ? formatCurrencyTL(Math.round(totalPayroll / activeEmployees.length))
                      : "$0"}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg. Salary</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Hires */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Recent Hires</CardTitle>
                <CardDescription>Newest team members</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/people/employees")}>
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentHires.length > 0 ? (
                <div className="space-y-3">
                  {recentHires.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/people/employees?id=${employee.id}`)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {employee.personalInfo.firstName[0]}
                          {employee.personalInfo.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {employee.jobDetails?.position} • {employee.jobDetails?.department}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(employee.jobDetails.hireDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-2">No employees yet</p>
                  <Button size="sm" onClick={() => navigate("/people/add")}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First Employee
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigate to Sections */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Explore</CardTitle>
              <CardDescription>Jump to any section</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col items-start border-l-4 border-l-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  onClick={() => navigate("/people")}
                >
                  <Users className="h-6 w-6 mb-2 text-blue-500" />
                  <span className="font-semibold">People</span>
                  <span className="text-xs text-muted-foreground">Staff, hiring, leave</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col items-start border-l-4 border-l-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  onClick={() => navigate("/payroll")}
                >
                  <Calculator className="h-6 w-6 mb-2 text-emerald-500" />
                  <span className="font-semibold">Payroll</span>
                  <span className="text-xs text-muted-foreground">Pay, taxes, benefits</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col items-start border-l-4 border-l-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  onClick={() => navigate("/accounting")}
                >
                  <Building className="h-6 w-6 mb-2 text-amber-500" />
                  <span className="font-semibold">Accounting</span>
                  <span className="text-xs text-muted-foreground">Ledger, journal, reports</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col items-start border-l-4 border-l-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                  onClick={() => navigate("/reports")}
                >
                  <FileText className="h-6 w-6 mb-2 text-violet-500" />
                  <span className="font-semibold">Reports</span>
                  <span className="text-xs text-muted-foreground">Analytics & exports</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="text-center text-xs text-muted-foreground mt-4">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">?</kbd> for keyboard shortcuts
        </div>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
    </div>
  );
}
