/**
 * People Hub - Employee-First Design
 * Answers: "Who works here, and what needs attention?"
 * Structure: KPIs -> Attention Required -> Employee Table -> Collapsible Sections
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService, type Employee } from "@/services/employeeService";
import { departmentService } from "@/services/departmentService";
import { leaveService } from "@/services/leaveService";
import {
  Users,
  UserPlus,
  Building,
  Building2,
  Briefcase,
  UserCheck,
  Calendar,
  Clock,
  CalendarDays,
  Heart,
  Target,
  Award,
  GraduationCap,
  Shield,
  ChevronRight,
  ChevronDown,
  Search,
  AlertTriangle,
  FileText,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Eye,
  Pencil,
  Upload,
  Plus,
} from "lucide-react";
import { sectionThemes } from "@/lib/sectionTheme";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";

const theme = sectionThemes.people;

function PeopleDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      {/* Hero Section */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-5 w-64" />
              </div>
            </div>
            <Skeleton className="h-11 w-36 rounded-md" />
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-l-4 border-l-muted">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-9 w-12 mb-1" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payroll Status Badge */}
        <div className="mb-4">
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>

        {/* Attention Section */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Employee Table */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Skeleton className="h-5 w-28 mb-1" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-9 w-16 rounded-md" />
            </div>
            {/* Filters */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-64 rounded-md" />
              <Skeleton className="h-9 w-32 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b mb-2">
              <Skeleton className="col-span-4 h-3 w-20" />
              <Skeleton className="col-span-2 h-3 w-12" />
              <Skeleton className="col-span-2 h-3 w-20" />
              <Skeleton className="col-span-1 h-3 w-14" />
              <Skeleton className="col-span-2 h-3 w-20" />
              <Skeleton className="col-span-1 h-3 w-14" />
            </div>
            {/* Table Rows */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid grid-cols-12 gap-4 px-4 py-3 items-center">
                <div className="col-span-4 flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <Skeleton className="col-span-2 h-4 w-24" />
                <Skeleton className="col-span-2 h-4 w-20" />
                <Skeleton className="col-span-1 h-5 w-14 rounded-full" />
                <Skeleton className="col-span-2 h-4 w-20" />
                <Skeleton className="col-span-1 h-8 w-8 rounded-md ml-auto" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Collapsible Sections */}
        <div className="space-y-2 opacity-80">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border border-border/40 shadow-none">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PeopleDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [stats, setStats] = useState({
    activeEmployees: 0,
    pendingLeave: 0,
    onLeaveToday: 0,
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Collapsible section states
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [hiringOpen, setHiringOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [employeesData, departmentsData, leaveStats] = await Promise.all([
        employeeService.getAllEmployees(),
        departmentService.getAllDepartments(),
        leaveService.getLeaveStats(),
      ]);

      setEmployees(employeesData);
      setDepartments([
        ...new Set(
          employeesData.map((e) => e.jobDetails?.department).filter(Boolean)
        ),
      ] as string[]);
      setStats({
        activeEmployees: employeesData.filter((e) => e.status === "active")
          .length,
        pendingLeave: leaveStats.pendingRequests,
        onLeaveToday: leaveStats.employeesOnLeaveToday,
      });
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        searchQuery === "" ||
        `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        emp.jobDetails?.position
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        emp.personalInfo.email
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesDepartment =
        departmentFilter === "all" ||
        emp.jobDetails?.department === departmentFilter;

      const matchesStatus =
        statusFilter === "all" || emp.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchQuery, departmentFilter, statusFilter]);

  // Attention required items
  const attentionItems = useMemo(() => {
    const items: Array<{
      employee: Employee;
      issue: string;
      action: string;
      path: string;
      type: "warning" | "error";
    }> = [];

    employees.forEach((emp) => {
      // Missing INSS number
      if (!emp.documents?.socialSecurityNumber?.number) {
        items.push({
          employee: emp,
          issue: "Missing INSS number",
          action: "Add INSS",
          path: `/people/employees?id=${emp.id}&edit=true`,
          type: "error",
        });
      }
      // Missing contract
      if (!emp.documents?.workContract?.fileUrl) {
        items.push({
          employee: emp,
          issue: "Contract not uploaded",
          action: "Upload",
          path: `/people/employees?id=${emp.id}&tab=documents`,
          type: "warning",
        });
      }
    });

    return items.slice(0, 5); // Show max 5 issues
  }, [employees]);

  if (loading) {
    return <PeopleDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.people} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("people.dashboard.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("people.dashboard.subtitle")}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/people/add")}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              {t("people.dashboard.actions.addEmployee")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* ═══════════════════════════════════════════════════════════════
            KPIs - 3 Only: Active Employees, Pending Leave, On Leave Today
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card
            className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-blue-500"
            onClick={() => navigate("/people/employees")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.activeEmployees}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("people.dashboard.stats.activeEmployees")}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${
              stats.pendingLeave > 0
                ? "border-l-amber-500"
                : "border-l-blue-500/50"
            }`}
            onClick={() => navigate("/people/leave")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.pendingLeave}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("people.dashboard.stats.pendingLeave")}
                  </p>
                </div>
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center ${
                    stats.pendingLeave > 0
                      ? "bg-amber-100 dark:bg-amber-900/30"
                      : "bg-muted"
                  }`}
                >
                  <Heart
                    className={`h-6 w-6 ${
                      stats.pendingLeave > 0
                        ? "text-amber-600"
                        : "text-muted-foreground"
                    }`}
                  />
                </div>
              </div>
              {stats.pendingLeave > 0 && (
                <Badge className="mt-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {t("people.dashboard.stats.needsReview")}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-cyan-500/50"
            onClick={() => navigate("/people/attendance")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats.onLeaveToday}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("people.dashboard.stats.onLeaveToday")}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            PAYROLL READINESS BADGE - Quick status indicator
        ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-4 flex items-center gap-2">
          {attentionItems.length === 0 ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              Payroll ready
            </Badge>
          ) : (
            <Badge
              className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1.5 cursor-pointer"
              onClick={() => document.getElementById('attention-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Payroll blocked ({attentionItems.length} issue{attentionItems.length > 1 ? 's' : ''})
            </Badge>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            ATTENTION REQUIRED - Soft when resolved, prominent when issues
        ═══════════════════════════════════════════════════════════════ */}
        {attentionItems.length > 0 ? (
          <Card id="attention-section" className="mb-6 border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Attention Required
              </CardTitle>
              <CardDescription>
                Fix these issues before running payroll
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {attentionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50 hover:border-amber-500/30 transition-colors cursor-pointer"
                    onClick={() => navigate(item.path)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-muted">
                          {item.employee.personalInfo.firstName[0]}
                          {item.employee.personalInfo.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {item.employee.personalInfo.firstName}{" "}
                          {item.employee.personalInfo.lastName}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {item.issue}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-600 dark:text-amber-400 hover:text-amber-700"
                    >
                      {item.action}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ═══════════════════════════════════════════════════════════════
            PRIMARY: EMPLOYEE TABLE - Default View
        ═══════════════════════════════════════════════════════════════ */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle className="text-lg">All Employees</CardTitle>
                <CardDescription>
                  {filteredEmployees.length} of {employees.length} employees
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/people/add")}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {/* Consolidated search & filters row with labels */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Dept:</span>
                <Select
                  value={departmentFilter}
                  onValueChange={setDepartmentFilter}
                >
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[100px] h-9">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredEmployees.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No employees found</p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/people/add")}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add your first employee
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
                  <div className="col-span-4">Employee</div>
                  <div className="col-span-2">Role</div>
                  <div className="col-span-2">Department</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-2">Compliance</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                {/* Employee Rows */}
                {filteredEmployees.slice(0, 10).map((emp) => {
                  const hasINSS = !!emp.documents?.socialSecurityNumber?.number;
                  const hasContract = !!emp.documents?.workContract?.fileUrl;
                  const isCompliant = hasINSS && hasContract;

                  return (
                    <div
                      key={emp.id}
                      className="group grid grid-cols-12 gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors items-center"
                    >
                      <div
                        className="col-span-4 flex items-center gap-3 cursor-pointer"
                        onClick={() => navigate(`/people/employees?id=${emp.id}`)}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                            {emp.personalInfo.firstName[0]}
                            {emp.personalInfo.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {emp.personalInfo.firstName}{" "}
                            {emp.personalInfo.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {emp.personalInfo.email}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground truncate">
                        {emp.jobDetails?.position || "-"}
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground truncate">
                        {emp.jobDetails?.department || "-"}
                      </div>
                      <div className="col-span-1">
                        <Badge
                          className={
                            emp.status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : emp.status === "inactive"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }
                        >
                          {emp.status}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        {isCompliant ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">Compliant</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">
                              {!hasINSS && !hasContract
                                ? "Missing docs"
                                : !hasINSS
                                ? "No INSS"
                                : "No contract"}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Row-level quick actions */}
                      <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="View profile"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/people/employees?id=${emp.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/people/employees?id=${emp.id}&edit=true`);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!hasContract && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-amber-600 dark:text-amber-400"
                            title="Upload contract"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/people/employees?id=${emp.id}&tab=documents`);
                            }}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

{/* Pagination link removed - count shown in header is sufficient */}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            COLLAPSIBLE SECTIONS - Secondary Features (Lower Visual Weight)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
          {/* Leave & Attendance */}
          <Collapsible open={leaveOpen} onOpenChange={setLeaveOpen}>
            <Card className="border border-border/40 shadow-none">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-md bg-muted/70 flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">
                          Leave & Attendance
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          Pending: {stats.pendingLeave} | On leave today:{" "}
                          {stats.onLeaveToday}
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        leaveOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                    {[
                      {
                        label: "Time Tracking",
                        path: "/people/time-tracking",
                        icon: Clock,
                      },
                      {
                        label: "Attendance",
                        path: "/people/attendance",
                        icon: CalendarDays,
                      },
                      {
                        label: "Leave Requests",
                        path: "/people/leave",
                        icon: Heart,
                      },
                      {
                        label: "Shift Schedules",
                        path: "/people/schedules",
                        icon: Calendar,
                      },
                    ].map((link) => (
                      <Button
                        key={link.path}
                        variant="ghost"
                        className="justify-start h-9 text-sm"
                        onClick={() => navigate(link.path)}
                      >
                        <link.icon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        {link.label}
                        <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Organization */}
          <Collapsible open={orgOpen} onOpenChange={setOrgOpen}>
            <Card className="border border-border/40 shadow-none">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-md bg-muted/70 flex items-center justify-center">
                        <Building className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">Organization</CardTitle>
                        <CardDescription className="text-[11px]">
                          Departments, org chart, structure
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        orgOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {[
                      {
                        label: "Departments",
                        path: "/people/departments",
                        icon: Building,
                      },
                      {
                        label: "Org Chart",
                        path: "/people/org-chart",
                        icon: Building2,
                      },
                      {
                        label: "All Employees",
                        path: "/people/employees",
                        icon: Users,
                      },
                    ].map((link) => (
                      <Button
                        key={link.path}
                        variant="ghost"
                        className="justify-start h-9 text-sm"
                        onClick={() => navigate(link.path)}
                      >
                        <link.icon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        {link.label}
                        <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Hiring & Onboarding */}
          <Collapsible open={hiringOpen} onOpenChange={setHiringOpen}>
            <Card className="border border-border/40 shadow-none">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-md bg-muted/70 flex items-center justify-center">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">
                          Hiring & Onboarding
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          Jobs, candidates, new hire setup
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        hiringOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                    {[
                      {
                        label: "Job Postings",
                        path: "/people/jobs",
                        icon: Briefcase,
                      },
                      {
                        label: "Candidates",
                        path: "/people/candidates",
                        icon: UserCheck,
                      },
                      {
                        label: "Interviews",
                        path: "/people/interviews",
                        icon: Calendar,
                      },
                      {
                        label: "Onboarding",
                        path: "/people/onboarding",
                        icon: UserPlus,
                      },
                    ].map((link) => (
                      <Button
                        key={link.path}
                        variant="ghost"
                        className="justify-start h-9 text-sm"
                        onClick={() => navigate(link.path)}
                      >
                        <link.icon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        {link.label}
                        <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Reviews & Training (softer name for TL market) */}
          <Collapsible open={performanceOpen} onOpenChange={setPerformanceOpen}>
            <Card className="border border-border/40 shadow-none">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-md bg-muted/70 flex items-center justify-center">
                        <Award className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">
                          Reviews & Training
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          Performance reviews, goals, staff training
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        performanceOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                    {[
                      { label: "Goals", path: "/people/goals", icon: Target },
                      { label: "Reviews", path: "/people/reviews", icon: Award },
                      {
                        label: "Training",
                        path: "/people/training",
                        icon: GraduationCap,
                      },
                      {
                        label: "Disciplinary",
                        path: "/people/disciplinary",
                        icon: Shield,
                      },
                    ].map((link) => (
                      <Button
                        key={link.path}
                        variant="ghost"
                        className="justify-start h-9 text-sm"
                        onClick={() => navigate(link.path)}
                      >
                        <link.icon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        {link.label}
                        <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
