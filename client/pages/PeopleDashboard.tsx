/**
 * People Hub - Employee-First Design
 * Answers: "Who works here, and what needs attention?"
 * Structure: KPIs -> Attention Required -> Employee Table -> Collapsible Sections
 */

import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
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
import { type Employee } from "@/services/employeeService";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
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
  Megaphone,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Search,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Eye,
  Pencil,
  Upload,
  Plus,
  Globe,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import GuidancePanel from "@/components/GuidancePanel";
import { useI18n } from "@/i18n/I18nProvider";


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
        <div className="grid gap-4 md:grid-cols-3 mb-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-l-4 border-l-muted">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-7 w-10 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Attention banner */}
        <Skeleton className="h-10 w-full rounded-lg mb-5" />

        {/* Employee Table */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Skeleton className="h-5 w-28 mb-1" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-9 w-16 rounded-md" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-64 rounded-md" />
              <Skeleton className="h-9 w-32 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b mb-2">
              <Skeleton className="col-span-4 h-3 w-20" />
              <Skeleton className="col-span-2 h-3 w-12" />
              <Skeleton className="col-span-2 h-3 w-20" />
              <Skeleton className="col-span-1 h-3 w-14" />
              <Skeleton className="col-span-2 h-3 w-20" />
              <Skeleton className="col-span-1 h-3 w-14" />
            </div>
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
      </div>
    </div>
  );
}

export default function PeopleDashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: employees = [], isLoading: employeesLoading } = useAllEmployees();
  const { data: leaveStats, isLoading: leaveStatsLoading } = useLeaveStats();
  const loading = employeesLoading || leaveStatsLoading;

  // Derived data
  const departments = useMemo(
    () =>
      [...new Set(employees.map((e) => e.jobDetails?.department).filter(Boolean))] as string[],
    [employees]
  );
  const stats = useMemo(
    () => ({
      activeEmployees: employees.filter((e) => e.status === "active").length,
      pendingLeave: leaveStats?.pendingRequests ?? 0,
      onLeaveToday: leaveStats?.employeesOnLeaveToday ?? 0,
    }),
    [employees, leaveStats]
  );

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Collapsible section states
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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
          issue: "INSS number needed",
          action: "Add INSS",
          path: `/people/employees?id=${emp.id}&edit=true`,
          type: "error",
        });
      }
      // Missing contract
      if (!emp.documents?.workContract?.fileUrl) {
        items.push({
          employee: emp,
          issue: "Contract needed",
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
                <img src="/images/illustrations/icons/icon-people.webp" alt="" className="h-8 w-8" />
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
        <GuidancePanel section="people" />

        {/* KPI row */}
        <div className="grid gap-4 md:grid-cols-3 mb-5">
          <Card
            className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-blue-500"
            onClick={() => navigate("/people/employees")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.activeEmployees}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("people.dashboard.stats.activeEmployees")}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${
              stats.pendingLeave > 0 ? "border-l-amber-500" : "border-l-blue-500/50"
            }`}
            onClick={() => navigate("/people/leave")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.pendingLeave}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("people.dashboard.stats.pendingLeave")}
                  </p>
                  {stats.pendingLeave > 0 && (
                    <Badge className="mt-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">
                      {t("people.dashboard.stats.needsReview")}
                    </Badge>
                  )}
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  stats.pendingLeave > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"
                }`}>
                  <Heart className={`h-5 w-5 ${stats.pendingLeave > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-cyan-500/50"
            onClick={() => navigate("/people/attendance")}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.onLeaveToday}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("people.dashboard.stats.onLeaveToday")}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attention banner — collapsed by default, expand for details */}
        {attentionItems.length > 0 ? (
          <Collapsible open={attentionOpen} onOpenChange={setAttentionOpen} className="mb-5">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-left hover:bg-amber-100/60 dark:hover:bg-amber-950/30 transition-colors">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200 flex-1">
                  {attentionItems.length} item{attentionItems.length > 1 ? "s" : ""} needed for payroll
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {attentionOpen ? "Hide" : "Review"}
                </span>
                <ChevronDown className={`h-4 w-4 text-amber-500 transition-transform ${attentionOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1.5">
                {attentionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-background border border-border/50 hover:border-amber-500/30 transition-colors cursor-pointer"
                    onClick={() => navigate(item.path)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] bg-muted">
                          {item.employee.personalInfo.firstName[0]}
                          {item.employee.personalInfo.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium leading-tight">
                          {item.employee.personalInfo.firstName}{" "}
                          {item.employee.personalInfo.lastName}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {item.issue}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      {item.action}
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="mb-5 flex items-center gap-2 px-1 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Payroll ready</span>
          </div>
        )}

        {/* Employee Table */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <CardTitle className="text-lg">All Employees</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filteredEmployees.length} of {employees.length} employees
                </p>
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
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
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
                <img
                  src="/images/illustrations/empty-employees.webp"
                  alt="No employees yet"
                  className="w-40 h-40 mx-auto mb-4 drop-shadow-lg"
                />
                <p className="text-muted-foreground mb-3">No employees found</p>
                <Button variant="outline" onClick={() => navigate("/people/add")}>
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
                            {emp.personalInfo.firstName} {emp.personalInfo.lastName}
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
                            <span className="text-sm">Ready</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">
                              {!hasINSS && !hasContract ? "Docs needed" : !hasINSS ? "INSS needed" : "Contract needed"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8" title="View profile"
                          onClick={(e) => { e.stopPropagation(); navigate(`/people/employees?id=${emp.id}`); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8" title="Edit"
                          onClick={(e) => { e.stopPropagation(); navigate(`/people/employees?id=${emp.id}&edit=true`); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!hasContract && (
                          <Button
                            size="icon" variant="ghost" className="h-8 w-8 text-amber-600 dark:text-amber-400" title="Upload contract"
                            onClick={(e) => { e.stopPropagation(); navigate(`/people/employees?id=${emp.id}&tab=documents`); }}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* More — all sub-sections as a flat nav grid */}
        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between py-2 px-1 mb-3 text-muted-foreground hover:text-foreground transition-colors">
              <span className="text-xs font-semibold uppercase tracking-wide">More</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 mb-4">
              {[
                { label: "Time Tracking", path: "/people/time-tracking", icon: Clock },
                { label: "Attendance", path: "/people/attendance", icon: CalendarDays },
                { label: "Leave Requests", path: "/people/leave", icon: Heart },
                { label: "Shift Schedules", path: "/people/schedules", icon: Calendar },
                { label: "Departments", path: "/people/departments", icon: Building },
                { label: "Org Chart", path: "/people/org-chart", icon: Building2 },
                { label: "Foreign Workers", path: "/admin/foreign-workers", icon: Globe },
                { label: "Job Postings", path: "/people/jobs", icon: Briefcase },
                { label: "Candidates", path: "/people/candidates", icon: UserCheck },
                { label: "Interviews", path: "/people/interviews", icon: Calendar },
                { label: "Onboarding", path: "/people/onboarding", icon: UserPlus },
                { label: "Goals", path: "/people/goals", icon: Target },
                { label: "Reviews", path: "/people/reviews", icon: Award },
                { label: "Training", path: "/people/training", icon: GraduationCap },
                { label: "Disciplinary", path: "/people/disciplinary", icon: Shield },
                { label: "Announcements", path: "/people/announcements", icon: Megaphone },
                { label: "Grievance Inbox", path: "/people/grievances", icon: MessageSquare },
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
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
