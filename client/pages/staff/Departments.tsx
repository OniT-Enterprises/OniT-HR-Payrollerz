import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { employeeService, type Employee } from "@/services/employeeService";
import {
  departmentService,
  type Department,
} from "@/services/departmentService";
import DepartmentManager from "@/components/DepartmentManager";
import EmployeeProfileView from "@/components/EmployeeProfileView";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenantId } from "@/contexts/TenantContext";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO, seoConfig } from "@/components/SEO";
import {
  Building,
  Users,
  Database,
  AlertCircle,
  User,
  Plus,
  Edit,
  DollarSign,
  Crown,
  Eye,
} from "lucide-react";

export default function Departments() {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepartmentManager, setShowDepartmentManager] = useState(false);
  const [managerMode, setManagerMode] = useState<"add" | "edit">("edit");
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const [showDepartmentEmployees, setShowDepartmentEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [showEmployeeProfile, setShowEmployeeProfile] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesData, departmentsData] = await Promise.all([
        employeeService.getAllEmployees(tenantId),
        departmentService.getAllDepartments(tenantId),
      ]);
      setEmployees(employeesData);
      setDepartments(departmentsData);

      // Auto-migrate departments that exist in employee records but not in departments collection
      await migrateMissingDepartments(employeesData, departmentsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: t("departments.toast.errorTitle"),
        description: t("departments.toast.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = async () => {
    // Reload data and notify about updates
    await loadData();
    toast({
      title: t("departments.toast.updatedTitle"),
      description: t("departments.toast.updatedDesc"),
    });
  };

  const migrateMissingDepartments = async (
    employees: Employee[],
    existingDepartments: Department[],
  ) => {
    try {
      // Only run migration on initial load, not during updates
      if (existingDepartments.length > 0) {
        return; // Skip migration if departments already exist
      }

      // Get unique department names from employees
      const employeeDepartments = [
        ...new Set(employees.map((emp) => emp.jobDetails.department)),
      ];

      // Filter out empty department names
      const validDepartments = employeeDepartments.filter(
        (deptName) => deptName && deptName.trim(),
      );

      // Create missing departments only if we have employees but no departments
      if (validDepartments.length > 0 && existingDepartments.length === 0) {
        for (const deptName of validDepartments) {
          await departmentService.addDepartment(tenantId, {
            name: deptName,
            icon: "building",
            shape: "circle",
            color: "#3B82F6",
          });
        }

        // Reload the data after initial migration
        const updatedDepartments = await departmentService.getAllDepartments(tenantId);
        setDepartments(updatedDepartments);

        toast({
          title: t("departments.toast.migratedTitle"),
          description: t("departments.toast.migratedDesc", {
            count: validDepartments.length,
          }),
        });
      }
    } catch (error) {
      console.error("Error migrating departments:", error);
    }
  };

  // Calculate department statistics using only managed departments
  const departmentStats = departments.map((department) => {
    const deptEmployees = employees.filter(
      (emp) => emp.jobDetails.department === department.name,
    );

    const activeCount = deptEmployees.filter(
      (emp) => emp.status === "active",
    ).length;
    const inactiveCount = deptEmployees.filter(
      (emp) => emp.status === "inactive",
    ).length;
    const averageMonthlySalary =
      deptEmployees.length > 0
        ? deptEmployees.reduce(
            (sum, emp) =>
              sum +
              (emp.compensation.monthlySalary ||
                Math.round((emp.compensation as any).annualSalary / 12) ||
                0),
            0,
          ) / deptEmployees.length
        : 0;

    return {
      name: department.name,
      totalEmployees: deptEmployees.length,
      activeEmployees: activeCount,
      inactiveEmployees: inactiveCount,
      averageSalary: Math.round(averageMonthlySalary),
      employees: deptEmployees,
      department, // Include the full department object
    };
  });

  // Sort departments by employee count
  departmentStats.sort((a, b) => b.totalEmployees - a.totalEmployees);

  const getDepartmentColor = (index: number) => {
    const colors = [
      "bg-blue-50 border-blue-200",
      "bg-green-50 border-green-200",
      "bg-purple-50 border-purple-200",
      "bg-orange-50 border-orange-200",
      "bg-pink-50 border-pink-200",
      "bg-indigo-50 border-indigo-200",
      "bg-yellow-50 border-yellow-200",
      "bg-red-50 border-red-200",
    ];
    return colors[index % colors.length];
  };

  const formatSalary = (monthlySalary: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monthlySalary);
  };

  const handleViewDepartmentEmployees = (dept: any) => {
    setSelectedDepartment(dept);
    setShowDepartmentEmployees(true);
  };

  const handleEditDepartment = (department: Department) => {
    setManagerMode("edit");
    setShowDepartmentManager(true);
  };

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeProfile(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6">
        <AutoBreadcrumb className="mb-6" />
          {/* Header Skeleton */}
          <div className="flex justify-end mb-4">
            <div className="flex gap-2">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-44" />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-8 rounded" />
            <div>
              <Skeleton className="h-8 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-4 w-28 mb-2" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Table Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-44 mb-2" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-12 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded ml-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.departments} />
      <MainNavigation />

      {/* Hero Section */}
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AutoBreadcrumb className="mb-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
                <Building className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{t("departments.title")}</h1>
                <p className="text-muted-foreground mt-1">
                  {t("departments.subtitle")}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setManagerMode("add");
                  setShowDepartmentManager(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("departments.addDepartment")}
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600"
                onClick={() => {
                  setManagerMode("edit");
                  setShowDepartmentManager(true);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                {t("departments.editDepartments")}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/people/org-chart")}
              >
                <Users className="mr-2 h-4 w-4" />
                {t("departments.organizationChart")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {employees.length === 0 ? (
          /* Empty State */
          <Card className="border-border/50 animate-fade-up">
            <CardContent className="text-center py-16">
              <div className="p-4 rounded-full bg-muted inline-flex mb-4">
                <Database className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {t("departments.emptyTitle")}
              </h3>
              <p className="text-muted-foreground mb-6">
                {t("departments.emptyDesc")}
              </p>
              <Button
                onClick={() => (window.location.href = "/staff/add")}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/25"
              >
                <User className="mr-2 h-4 w-4" />
                {t("departments.addFirstEmployee")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("departments.stats.totalDepartments")}
                      </p>
                      <p className="text-2xl font-bold">
                        {departmentStats.length}
                      </p>
                    </div>
                    <Building className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("departments.stats.totalEmployees")}
                      </p>
                      <p className="text-2xl font-bold">{employees.length}</p>
                    </div>
                    <Users className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("departments.stats.largestDepartment")}
                      </p>
                      <p className="text-2xl font-bold">
                        {departmentStats.length > 0
                          ? departmentStats[0].totalEmployees
                          : 0}
                      </p>
                    </div>
                    <User className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("departments.stats.averagePerDept")}
                      </p>
                      <p className="text-2xl font-bold">
                        {departmentStats.length > 0
                          ? Math.round(
                              employees.length / departmentStats.length,
                            )
                          : 0}
                      </p>
                    </div>
                    <Database className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Department Directory */}
            <Card>
              <CardHeader>
                <CardTitle>{t("departments.directoryTitle")}</CardTitle>
                <CardDescription>
                  {t("departments.directoryDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">
                          {t("departments.table.department")}
                        </th>
                        <th className="text-center p-3 font-medium">
                          {t("departments.table.director")}
                        </th>
                        <th className="text-center p-3 font-medium">
                          {t("departments.table.manager")}
                        </th>
                        <th className="text-center p-3 font-medium">
                          {t("departments.table.totalEmployees")}
                        </th>
                        <th className="text-center p-3 font-medium">
                          {t("departments.table.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentStats.map((dept) => (
                        <tr
                          key={dept.name}
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full border"
                                style={{
                                  backgroundColor:
                                    dept.department?.color || "#3B82F6",
                                }}
                              />
                              <Building className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{dept.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {dept.department?.director ? (
                              <Badge
                                variant="outline"
                                className="text-blue-600"
                              >
                                {dept.department.director}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {dept.department?.manager ? (
                              <Badge
                                variant="outline"
                                className="text-green-600"
                              >
                                {dept.department.manager}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-blue-100 hover:text-blue-800 transition-colors"
                              onClick={() =>
                                handleViewDepartmentEmployees(dept)
                              }
                            >
                              {dept.totalEmployees}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleEditDepartment(dept.department)
                                }
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Department Manager Dialog */}
        <DepartmentManager
          open={showDepartmentManager}
          onOpenChange={setShowDepartmentManager}
          mode={managerMode}
          onDepartmentChange={handleDepartmentChange}
        />

        {/* Department Employees Dialog */}
        <Dialog
          open={showDepartmentEmployees}
          onOpenChange={setShowDepartmentEmployees}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {t("departments.dialogTitle", {
                  department: selectedDepartment?.name,
                })}
              </DialogTitle>
              <DialogDescription>
                {t("departments.dialogDesc", {
                  count: selectedDepartment?.totalEmployees || 0,
                })}
              </DialogDescription>
            </DialogHeader>

            {selectedDepartment && (
              <div className="space-y-4">
                {selectedDepartment.employees.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">
                            {t("departments.dialogTable.employee")}
                          </th>
                          <th className="text-left p-3 font-medium">
                            {t("departments.dialogTable.position")}
                          </th>
                          <th className="text-left p-3 font-medium">
                            {t("departments.dialogTable.email")}
                          </th>
                          <th className="text-center p-3 font-medium">
                            {t("departments.dialogTable.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDepartment.employees.map(
                          (employee: Employee) => (
                            <tr
                              key={employee.id}
                              className="border-b hover:bg-muted/50"
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage
                                      src="/placeholder.svg"
                                      alt={employee.personalInfo.firstName}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {employee.personalInfo.firstName[0]}
                                      {employee.personalInfo.lastName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">
                                      {employee.personalInfo.firstName}{" "}
                                      {employee.personalInfo.lastName}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {t("employees.idLabel", {
                                        id: employee.jobDetails.employeeId,
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                <span className="font-medium">
                                  {employee.jobDetails.position}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="text-sm">
                                  {employee.personalInfo.email}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewEmployee(employee)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-semibold mb-2">
                      {t("departments.dialogEmptyTitle")}
                    </h3>
                    <p className="text-muted-foreground">
                      {t("departments.dialogEmptyDesc")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Employee Profile View Dialog */}
        <EmployeeProfileView
          employee={selectedEmployee}
          open={showEmployeeProfile}
          onOpenChange={setShowEmployeeProfile}
        />
      </div>
    </div>
  );
}
