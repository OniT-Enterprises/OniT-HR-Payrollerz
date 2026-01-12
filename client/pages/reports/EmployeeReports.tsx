import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService } from "@/services/employeeService";
import { cacheService, CACHE_KEYS } from "@/services/cacheService";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Users,
  Download,
  UserPlus,
  UserMinus,
  Building,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";

export default function EmployeeReports() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30");
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      // Show cached data immediately if available
      const cached = cacheService.get<any[]>(CACHE_KEYS.EMPLOYEES);
      if (cached) {
        setEmployees(cached);
        setLoading(false);
      }

      // Fetch fresh data
      const data = await employeeService.getAllEmployees();
      cacheService.set(CACHE_KEYS.EMPLOYEES, data);
      setEmployees(data);
    } catch (error) {
      console.error("Error loading employees:", error);
      if (employees.length === 0) {
        toast({
          title: "Error",
          description: "Failed to load employee data",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const activeEmployees = employees.filter((e) => e.status === "active");
  const inactiveEmployees = employees.filter((e) => e.status !== "active");

  // Get employees by department
  const departmentCounts = employees.reduce((acc, emp) => {
    const dept = emp.jobDetails?.department || "Unassigned";
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get new hires (based on date range)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
  const newHires = employees.filter((emp) => {
    const hireDate = emp.jobDetails?.hireDate
      ? new Date(emp.jobDetails.hireDate)
      : null;
    return hireDate && hireDate >= cutoffDate;
  });

  // Employment type breakdown
  const employmentTypes = employees.reduce((acc, emp) => {
    const type = emp.jobDetails?.employmentType || "Unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Export to CSV
  const exportToCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
    const headers = columns.map((c) => c.label).join(",");
    const rows = data.map((item) =>
      columns
        .map((c) => {
          const value = c.key.split(".").reduce((obj, key) => obj?.[key], item);
          const strValue = String(value || "").replace(/,/g, ";");
          return `"${strValue}"`;
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export Complete",
      description: `${filename}.csv downloaded successfully`,
    });
  };

  const exportDirectory = () => {
    exportToCSV(employees, "employee_directory", [
      { key: "jobDetails.employeeId", label: "Employee ID" },
      { key: "personalInfo.firstName", label: "First Name" },
      { key: "personalInfo.lastName", label: "Last Name" },
      { key: "personalInfo.email", label: "Email" },
      { key: "personalInfo.phone", label: "Phone" },
      { key: "jobDetails.department", label: "Department" },
      { key: "jobDetails.position", label: "Position" },
      { key: "jobDetails.hireDate", label: "Hire Date" },
      { key: "jobDetails.employmentType", label: "Employment Type" },
      { key: "status", label: "Status" },
    ]);
  };

  const exportNewHires = () => {
    exportToCSV(newHires, "new_hires_report", [
      { key: "jobDetails.employeeId", label: "Employee ID" },
      { key: "personalInfo.firstName", label: "First Name" },
      { key: "personalInfo.lastName", label: "Last Name" },
      { key: "jobDetails.department", label: "Department" },
      { key: "jobDetails.position", label: "Position" },
      { key: "jobDetails.hireDate", label: "Hire Date" },
      { key: "jobDetails.employmentType", label: "Employment Type" },
    ]);
  };

  const exportHeadcount = () => {
    const headcountData = Object.entries(departmentCounts).map(([dept, count]) => ({
      department: dept,
      headcount: count as number,
      percentage: (((count as number) / employees.length) * 100).toFixed(1),
    }));
    exportToCSV(headcountData, "headcount_by_department", [
      { key: "department", label: "Department" },
      { key: "headcount", label: "Headcount" },
      { key: "percentage", label: "Percentage %" },
    ]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <AutoBreadcrumb className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.employeeReports} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-violet-50 dark:bg-violet-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("reports.employee.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t("reports.employee.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 -mt-10">
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                  <p className="text-3xl font-bold">{employees.length}</p>
                  <p className="text-xs text-blue-600">{activeEmployees.length} active</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New Hires</p>
                  <p className="text-3xl font-bold">{newHires.length}</p>
                  <p className="text-xs text-green-600">Last {dateRange} days</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                  <UserPlus className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Departments</p>
                  <p className="text-3xl font-bold">{Object.keys(departmentCounts).length}</p>
                  <p className="text-xs text-purple-600">With employees</p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                  <Building className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inactive</p>
                  <p className="text-3xl font-bold">{inactiveEmployees.length}</p>
                  <p className="text-xs text-orange-600">
                    {employees.length > 0
                      ? ((inactiveEmployees.length / employees.length) * 100).toFixed(1)
                      : 0}% turnover
                  </p>
                </div>
                <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl">
                  <UserMinus className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Employee Directory
              </CardTitle>
              <CardDescription>Complete list of all employees with contact info</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Records</span>
                  <span className="font-medium">{employees.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                    {activeEmployees.length}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Inactive</span>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {inactiveEmployees.length}
                  </Badge>
                </div>
              </div>
              <Button className="w-full" onClick={exportDirectory}>
                <Download className="h-4 w-4 mr-2" />
                Export Directory
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-green-600" />
                New Hires Report
              </CardTitle>
              <CardDescription>Recently hired employees in selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New Hires</span>
                  <span className="font-medium">{newHires.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Period</span>
                  <span className="font-medium">Last {dateRange} days</span>
                </div>
                {newHires.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Latest: {newHires[0]?.personalInfo?.firstName} {newHires[0]?.personalInfo?.lastName}
                  </div>
                )}
              </div>
              <Button
                className="w-full"
                onClick={exportNewHires}
                disabled={newHires.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export New Hires
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-purple-600" />
                Headcount by Department
              </CardTitle>
              <CardDescription>Employee distribution across departments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                {Object.entries(departmentCounts)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 4)
                  .map(([dept, count]) => (
                    <div key={dept} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate">{dept}</span>
                      <Badge variant="outline">{count as number}</Badge>
                    </div>
                  ))}
                {Object.keys(departmentCounts).length > 4 && (
                  <p className="text-xs text-muted-foreground">
                    +{Object.keys(departmentCounts).length - 4} more departments
                  </p>
                )}
              </div>
              <Button className="w-full" onClick={exportHeadcount}>
                <Download className="h-4 w-4 mr-2" />
                Export Headcount
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Employment Type Breakdown */}
        <Card className="border-border/50 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-violet-600" />
              Employment Type Breakdown
            </CardTitle>
            <CardDescription>Distribution by employment type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(employmentTypes).map(([type, count]) => (
                <div key={type} className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{count as number}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(((count as number) / employees.length) * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Employees Table */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-violet-600" />
              Recent Employees
            </CardTitle>
            <CardDescription>Most recently added employees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Employee</th>
                    <th className="text-left p-3 font-medium">Department</th>
                    <th className="text-left p-3 font-medium">Position</th>
                    <th className="text-left p-3 font-medium">Hire Date</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees
                    .sort((a, b) => {
                      const dateA = a.jobDetails?.hireDate ? new Date(a.jobDetails.hireDate) : new Date(0);
                      const dateB = b.jobDetails?.hireDate ? new Date(b.jobDetails.hireDate) : new Date(0);
                      return dateB.getTime() - dateA.getTime();
                    })
                    .slice(0, 10)
                    .map((emp) => (
                      <tr key={emp.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">
                              {emp.personalInfo?.firstName} {emp.personalInfo?.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {emp.jobDetails?.employeeId}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">{emp.jobDetails?.department || "-"}</td>
                        <td className="p-3">{emp.jobDetails?.position || "-"}</td>
                        <td className="p-3">
                          {emp.jobDetails?.hireDate
                            ? new Date(emp.jobDetails.hireDate).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            className={
                              emp.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }
                          >
                            {emp.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
