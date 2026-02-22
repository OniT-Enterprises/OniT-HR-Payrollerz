import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Filter,
  Plus,
  Download,
  Clock,
  Users,
  AlertTriangle,
  Timer,
  FileText,
  Building,
  User,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { useAllEmployees } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";
import { useAttendanceByDate, useMarkAttendance } from "@/hooks/useAttendance";
import { useTenantId } from "@/contexts/TenantContext";
import { toDateStringTL } from "@/lib/dateUtils";

export default function TimeTracking() {
  const { toast } = useToast();
  const { t } = useI18n();
  const tenantId = useTenantId();
  const [activeTab, setActiveTab] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => toDateStringTL(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Real data hooks
  const { data: realEmployees = [], isLoading: empLoading } = useAllEmployees();
  const { data: departments = [] } = useDepartments(tenantId);
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useAttendanceByDate(selectedDate);
  const markAttendanceMutation = useMarkAttendance();
  const loading = empLoading || attendanceLoading;

  // Map real employees for dropdowns
  const employees = useMemo(() => realEmployees
    .filter(e => e.status === 'active')
    .map(e => ({
      id: e.id!,
      name: `${e.personalInfo.firstName} ${e.personalInfo.lastName}`,
      department: e.jobDetails.department,
      position: e.jobDetails.position,
    })), [realEmployees]);

  // Map attendance records to UI-friendly format
  const timeEntries = useMemo(() => attendanceRecords.map((r) => ({
    id: r.id || '',
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    department: r.department,
    date: r.date,
    clockIn: r.clockIn || '--:--',
    clockOut: r.clockOut || '--:--',
    totalHours: r.totalHours,
    regularHours: r.regularHours,
    overtimeHours: r.overtimeHours,
    status: r.status,
    source: r.source,
    lateMinutes: r.lateMinutes,
    notes: r.notes || '',
  })), [attendanceRecords]);

  // Computed stats from real data
  const totalPresent = useMemo(() =>
    timeEntries.filter(e => e.status === 'present' || e.status === 'late').length,
    [timeEntries]);
  const totalLate = useMemo(() =>
    timeEntries.filter(e => e.status === 'late').length,
    [timeEntries]);
  const totalAbsent = useMemo(() =>
    timeEntries.filter(e => e.status === 'absent').length,
    [timeEntries]);
  const totalHoursToday = useMemo(() =>
    timeEntries.reduce((sum, e) => sum + e.totalHours, 0),
    [timeEntries]);

  const [formData, setFormData] = useState({
    employee: "",
    date: "",
    clockIn: "",
    clockOut: "",
    notes: "",
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <Badge className="bg-green-100 text-green-800">
            {t("timeLeave.timeTracking.status.approved")}
          </Badge>
        );
      case "late":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            {t("timeLeave.timeTracking.status.pending")}
          </Badge>
        );
      case "absent":
        return (
          <Badge className="bg-red-100 text-red-800">
            {t("timeLeave.timeTracking.status.rejected")}
          </Badge>
        );
      case "half_day":
        return (
          <Badge className="bg-orange-100 text-orange-800">
            Half Day
          </Badge>
        );
      case "leave":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            On Leave
          </Badge>
        );
      case "holiday":
        return (
          <Badge className="bg-purple-100 text-purple-800">
            Holiday
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      manual: "bg-gray-100 text-gray-800",
      fingerprint: "bg-blue-100 text-blue-800",
      mobile_app: "bg-green-100 text-green-800",
      qr_code: "bg-violet-100 text-violet-800",
      facial: "bg-cyan-100 text-cyan-800",
    };
    return (
      <Badge className={colors[source] || "bg-gray-100 text-gray-800"}>
        {source.replace('_', ' ')}
      </Badge>
    );
  };

  const handleInputChange = (
    field: string,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee || !formData.date) {
      toast({
        title: t("timeLeave.timeTracking.toast.validationTitle"),
        description: t("timeLeave.timeTracking.toast.validationDesc"),
        variant: "destructive",
      });
      return;
    }

    const emp = realEmployees.find(e => e.id === formData.employee);
    try {
      await markAttendanceMutation.mutateAsync({
        employeeId: formData.employee,
        employeeName: emp ? `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}` : '',
        department: emp?.jobDetails.department || '',
        date: formData.date,
        clockIn: formData.clockIn || undefined,
        clockOut: formData.clockOut || undefined,
        source: 'manual',
        notes: formData.notes || undefined,
      });
      toast({
        title: t("timeLeave.timeTracking.toast.successTitle"),
        description: t("timeLeave.timeTracking.toast.successDesc"),
      });

      setFormData({
        employee: "",
        date: "",
        clockIn: "",
        clockOut: "",
        notes: "",
      });
      setShowAddDialog(false);
    } catch {
      toast({
        title: t("timeLeave.timeTracking.toast.errorTitle"),
        description: t("timeLeave.timeTracking.toast.errorDesc"),
        variant: "destructive",
      });
    }
  };

  const handleFilter = () => {
    // When the user applies a date filter, update selectedDate to refetch attendance
    if (startDate) {
      setSelectedDate(startDate);
    }
    toast({
      title: t("timeLeave.timeTracking.toast.filterTitle"),
      description: t("timeLeave.timeTracking.toast.filterDesc", {
        startDate,
        endDate,
      }),
    });
  };

  const handleExportCSV = () => {
    // Build CSV from real data
    const csvHeaders = [
      t("timeLeave.timeTracking.csv.employeeName"),
      t("timeLeave.timeTracking.csv.date"),
      t("timeLeave.timeTracking.csv.clockIn"),
      t("timeLeave.timeTracking.csv.clockOut"),
      t("timeLeave.timeTracking.csv.totalHours"),
      "Status",
      "Source",
    ];

    const csvRows = timeEntries.map((entry) => [
      entry.employeeName,
      entry.date,
      entry.clockIn,
      entry.clockOut,
      entry.totalHours.toString(),
      entry.status,
      entry.source,
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: t("timeLeave.timeTracking.toast.exportTitle"),
      description: t("timeLeave.timeTracking.toast.exportDesc"),
    });
  };

  // Apply client-side filters
  const filteredEntries = useMemo(() => {
    let entries = timeEntries;
    if (selectedEmployee && selectedEmployee !== "all") {
      entries = entries.filter(e => e.employeeId === selectedEmployee);
    }
    if (selectedDepartment && selectedDepartment !== "all") {
      entries = entries.filter(e => e.department === selectedDepartment);
    }
    return entries;
  }, [timeEntries, selectedEmployee, selectedDepartment]);

  // Pagination (clamp page when filtered results shrink)
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const effectivePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const startIndex = (effectivePage - 1) * itemsPerPage;
  const paginatedEntries = filteredEntries.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Department summary for reports tab
  const departmentSummary = useMemo(() => {
    const deptMap = new Map<string, { present: number; late: number; absent: number; totalHours: number }>();
    for (const entry of timeEntries) {
      const dept = entry.department || 'Unassigned';
      const current = deptMap.get(dept) || { present: 0, late: 0, absent: 0, totalHours: 0 };
      if (entry.status === 'present') current.present++;
      if (entry.status === 'late') current.late++;
      if (entry.status === 'absent') current.absent++;
      current.totalHours += entry.totalHours;
      deptMap.set(dept, current);
    }
    return Array.from(deptMap.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [timeEntries]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
          <div className="max-w-7xl mx-auto">
            {/* Stats skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-8 w-20 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Tabs skeleton */}
            <Skeleton className="h-10 w-full max-w-md mb-6" />
            {/* Content skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-12 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.timeTracking} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-cyan-50 dark:bg-cyan-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/25">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("timeLeave.timeTracking.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("timeLeave.timeTracking.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-7xl mx-auto">

          {/* Date Selector */}
          <div className="mb-6 flex items-center gap-3">
            <Label htmlFor="attendance-date" className="text-sm font-medium">
              Date:
            </Label>
            <Input
              id="attendance-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-48"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="daily" className="mt-6">
              <div className="flex flex-col space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-border/50 shadow-lg animate-fade-up stagger-1">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.guardsOnDuty")}
                          </p>
                          <p className="text-2xl font-bold">{totalPresent}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.currentlyActive")}
                          </p>
                        </div>
                        <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 shadow-lg animate-fade-up stagger-2">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Late Arrivals
                          </p>
                          <p className="text-2xl font-bold">{totalLate}</p>
                          <p className="text-xs text-muted-foreground">
                            Today
                          </p>
                        </div>
                        <div className="p-2.5 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl">
                          <AlertTriangle className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 shadow-lg animate-fade-up stagger-3">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Absent
                          </p>
                          <p className="text-2xl font-bold">{totalAbsent}</p>
                          <p className="text-xs text-muted-foreground">
                            Today
                          </p>
                        </div>
                        <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl">
                          <Clock className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 shadow-lg animate-fade-up stagger-4">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.totalHours")}
                          </p>
                          <p className="text-2xl font-bold">{totalHoursToday.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("timeLeave.timeTracking.stats.thisWeek")}
                          </p>
                        </div>
                        <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                          <Timer className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabs positioned after stats */}
                <TabsList className="flex flex-row flex-wrap gap-[361px] mt-4 mx-auto p-1 bg-muted rounded-lg w-full">
                  <TabsTrigger
                    value="daily"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    {t("timeLeave.timeTracking.tabs.daily")}
                  </TabsTrigger>
                  <TabsTrigger value="entries" className="ml-auto">
                    {t("timeLeave.timeTracking.tabs.entries")}
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="ml-auto">
                    {t("timeLeave.timeTracking.tabs.reports")}
                  </TabsTrigger>
                </TabsList>

                {/* Recent Entries Card */}
                <Card className="mt-6 border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      {t("timeLeave.timeTracking.recent.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("timeLeave.timeTracking.recent.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {timeEntries.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No attendance records for {selectedDate}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {timeEntries.slice(0, 5).map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {entry.employeeName}
                                </p>
                                {getSourceBadge(entry.source)}
                              </div>
                              <p className="text-sm text-gray-600">
                                {entry.department}
                              </p>
                              <p className="text-sm text-gray-500">
                                {entry.clockIn} - {entry.clockOut} (
                                {entry.totalHours.toFixed(1)}h)
                              </p>
                              {entry.lateMinutes > 0 && (
                                <div className="flex items-center gap-1 text-sm text-orange-600">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>Late by {entry.lateMinutes} min</span>
                                </div>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-sm text-gray-500">
                                {entry.date}
                              </p>
                              {getStatusBadge(entry.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="entries" className="mt-6">
              {/* Filters */}
              <Card className="mb-6 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    {t("timeLeave.timeTracking.filters.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <Label htmlFor="start-date">
                        {t("timeLeave.timeTracking.filters.startDate")}
                      </Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">
                        {t("timeLeave.timeTracking.filters.endDate")}
                      </Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="employee-filter">
                        {t("timeLeave.timeTracking.filters.guard")}
                      </Label>
                      <Select
                        value={selectedEmployee}
                        onValueChange={setSelectedEmployee}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("timeLeave.timeTracking.filters.allGuards")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("timeLeave.timeTracking.filters.allGuards")}
                          </SelectItem>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="department-filter">
                        Department
                      </Label>
                      <Select
                        value={selectedDepartment}
                        onValueChange={setSelectedDepartment}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.name}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Button onClick={handleFilter} className="w-full">
                        <Filter className="h-4 w-4 mr-2" />
                        {t("timeLeave.timeTracking.filters.apply")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Time Entries Table */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        {t("timeLeave.timeTracking.entries.title")}
                      </CardTitle>
                      <CardDescription>
                        {t("timeLeave.timeTracking.entries.showing", {
                          shown: paginatedEntries.length,
                          total: filteredEntries.length,
                        })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleExportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        {t("timeLeave.timeTracking.entries.export")}
                      </Button>
                      <Dialog
                        open={showAddDialog}
                        onOpenChange={setShowAddDialog}
                      >
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            {t("timeLeave.timeTracking.entries.logActivity")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>
                              {t("timeLeave.timeTracking.dialog.title")}
                            </DialogTitle>
                            <DialogDescription>
                              {t("timeLeave.timeTracking.dialog.description")}
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="employee">
                                  {t("timeLeave.timeTracking.dialog.guard")}
                                </Label>
                                <Select
                                  value={formData.employee}
                                  onValueChange={(value) =>
                                    handleInputChange("employee", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={t("timeLeave.timeTracking.dialog.guardPlaceholder")}
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {employees.map((emp) => (
                                      <SelectItem
                                        key={emp.id}
                                        value={emp.id}
                                      >
                                        {emp.name} — {emp.department}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="entry-date">
                                  {t("timeLeave.timeTracking.dialog.date")}
                                </Label>
                                <Input
                                  id="entry-date"
                                  type="date"
                                  value={formData.date}
                                  onChange={(e) =>
                                    handleInputChange("date", e.target.value)
                                  }
                                  required
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="clock-in">
                                  {t("timeLeave.timeTracking.dialog.clockIn")}
                                </Label>
                                <Input
                                  id="clock-in"
                                  type="time"
                                  value={formData.clockIn}
                                  onChange={(e) =>
                                    handleInputChange("clockIn", e.target.value)
                                  }
                                />
                              </div>
                              <div>
                                <Label htmlFor="clock-out">
                                  {t("timeLeave.timeTracking.dialog.clockOut")}
                                </Label>
                                <Input
                                  id="clock-out"
                                  type="time"
                                  value={formData.clockOut}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "clockOut",
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="notes">
                                {t("timeLeave.timeTracking.dialog.notes")}
                              </Label>
                              <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) =>
                                  handleInputChange("notes", e.target.value)
                                }
                                placeholder={t("timeLeave.timeTracking.dialog.notesPlaceholder")}
                                rows={2}
                              />
                            </div>

                            <div className="flex gap-2 pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAddDialog(false)}
                                className="flex-1"
                              >
                                {t("timeLeave.timeTracking.dialog.cancel")}
                              </Button>
                              <Button
                                type="submit"
                                className="flex-1"
                                disabled={markAttendanceMutation.isPending}
                              >
                                {markAttendanceMutation.isPending
                                  ? "Saving..."
                                  : t("timeLeave.timeTracking.dialog.submit")}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredEntries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No attendance records found for this date</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            {t("timeLeave.timeTracking.table.guard")}
                          </TableHead>
                          <TableHead>
                            {t("timeLeave.timeTracking.table.dateShift")}
                          </TableHead>
                          <TableHead>
                            Department
                          </TableHead>
                          <TableHead>
                            {t("timeLeave.timeTracking.table.hours")}
                          </TableHead>
                          <TableHead>
                            Source
                          </TableHead>
                          <TableHead>
                            Notes
                          </TableHead>
                          <TableHead>
                            {t("timeLeave.timeTracking.table.status")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {entry.employeeName}
                                </p>
                                <p className="text-sm text-gray-500">
                                  ID: {entry.employeeId.slice(0, 8)}...
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{entry.date}</p>
                                <p className="text-xs text-gray-500">
                                  {entry.clockIn} - {entry.clockOut}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{entry.department}</p>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {entry.totalHours.toFixed(1)}h
                                </p>
                                {entry.overtimeHours > 0 && (
                                  <p className="text-xs text-orange-600">
                                    +{entry.overtimeHours.toFixed(1)}h OT
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getSourceBadge(entry.source)}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm max-w-32 truncate">
                                {entry.notes || "—"}
                              </p>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(entry.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() =>
                                setCurrentPage(Math.max(1, effectivePage - 1))
                              }
                              className={
                                effectivePage === 1
                                  ? "pointer-events-none opacity-50"
                                  : ""
                              }
                            />
                          </PaginationItem>
                          {[...Array(totalPages)].map((_, i) => (
                            <PaginationItem key={i + 1}>
                              <PaginationLink
                                onClick={() => setCurrentPage(i + 1)}
                                isActive={effectivePage === i + 1}
                              >
                                {i + 1}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() =>
                                setCurrentPage(
                                  Math.min(totalPages, effectivePage + 1),
                                )
                              }
                              className={
                                effectivePage === totalPages
                                  ? "pointer-events-none opacity-50"
                                  : ""
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      {t("timeLeave.timeTracking.reports.exportTitle")}
                    </CardTitle>
                    <CardDescription>
                      {t("timeLeave.timeTracking.reports.exportDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={handleExportCSV}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t("timeLeave.timeTracking.reports.exportTimesheet")}
                    </Button>
                    <Button
                      onClick={() =>
                        toast({
                          title: t("timeLeave.timeTracking.toast.reportTitle"),
                          description: t("timeLeave.timeTracking.toast.reportClientBilling"),
                        })
                      }
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Building className="h-4 w-4 mr-2" />
                      {t("timeLeave.timeTracking.reports.clientBilling")}
                    </Button>
                    <Button
                      onClick={() =>
                        toast({
                          title: t("timeLeave.timeTracking.toast.reportTitle"),
                          description: t("timeLeave.timeTracking.toast.reportPerformance"),
                        })
                      }
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {t("timeLeave.timeTracking.reports.guardPerformance")}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>
                      {t("timeLeave.timeTracking.reports.coverageTitle")}
                    </CardTitle>
                    <CardDescription>
                      {t("timeLeave.timeTracking.reports.coverageDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {departmentSummary.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">No department data for this date</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {departmentSummary.map((dept) => {
                          const totalInDept = dept.present + dept.late + dept.absent;
                          return (
                            <div
                              key={dept.name}
                              className="flex items-center justify-between p-3 border rounded"
                            >
                              <div>
                                <p className="font-medium">{dept.name}</p>
                                <p className="text-sm text-gray-500">
                                  {totalInDept} employee{totalInDept !== 1 ? 's' : ''} tracked
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">
                                  {dept.totalHours.toFixed(1)}h total
                                </p>
                                <Badge className="bg-green-100 text-green-800">
                                  {dept.present} present
                                </Badge>
                                {dept.late > 0 && (
                                  <Badge className="ml-1 bg-yellow-100 text-yellow-800">
                                    {dept.late} late
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
