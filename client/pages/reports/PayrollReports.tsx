import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { employeeService } from "@/services/employeeService";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  DollarSign,
  Users,
  Download,
  Filter,
  Database,
  AlertCircle,
  User,
} from "lucide-react";

export default function PayrollReports() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const employeesData = await employeeService.getAllEmployees();
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast({
        title: "Error",
        description: "Failed to load employee data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalMonthlySalary = employees.reduce(
    (sum, emp) =>
      sum +
      (emp.compensation.monthlySalary ||
        Math.round((emp.compensation as any).annualSalary / 12) ||
        0),
    0,
  );
  const averageMonthlySalary =
    employees.length > 0
      ? Math.round(totalMonthlySalary / employees.length)
      : 0;
  const activeEmployees = employees.filter((emp) => emp.status === "active");

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <HotDogStyleNavigation />
        <div className="p-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading payroll reports...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Payroll Reports</h1>
            <p className="text-muted-foreground">
              Comprehensive payroll analytics and reporting
            </p>
          </div>
        </div>

        {employees.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Payroll Data</h3>
            <p className="text-muted-foreground mb-6">
              Add employees with salary information to generate payroll reports
            </p>
            <Button onClick={() => (window.location.href = "/staff/add")}>
              <User className="mr-2 h-4 w-4" />
              Add Employees First
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Employees
                      </p>
                      <p className="text-2xl font-bold">{employees.length}</p>
                      <p className="text-xs text-blue-600">In payroll system</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Monthly Payroll
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(totalMonthlySalary)}
                      </p>
                      <p className="text-xs text-green-600">
                        Based on current salaries
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Average Monthly Salary
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(averageMonthlySalary)}
                      </p>
                      <p className="text-xs text-purple-600">Per employee</p>
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
                        Monthly Payroll
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(Math.round(totalMonthlySalary))}
                      </p>
                      <p className="text-xs text-orange-600">Estimated</p>
                    </div>
                    <FileText className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter Reports
                </Button>
              </div>
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Export Reports
              </Button>
            </div>

            {/* Report Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Salary Summary</CardTitle>
                  <CardDescription>
                    Overview of employee compensation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm">Highest Salary:</span>
                      <span className="font-medium">
                        {formatCurrency(
                          Math.max(
                            ...employees.map(
                              (emp) =>
                                emp.compensation.monthlySalary ||
                                Math.round(
                                  (emp.compensation as any).annualSalary / 12,
                                ) ||
                                0,
                            ),
                          ),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Lowest Salary:</span>
                      <span className="font-medium">
                        {formatCurrency(
                          Math.min(
                            ...employees
                              .filter(
                                (emp) =>
                                  (emp.compensation.monthlySalary ||
                                    Math.round(
                                      (emp.compensation as any).annualSalary /
                                        12,
                                    ) ||
                                    0) > 0,
                              )
                              .map(
                                (emp) =>
                                  emp.compensation.monthlySalary ||
                                  Math.round(
                                    (emp.compensation as any).annualSalary / 12,
                                  ) ||
                                  0,
                              ),
                          ),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Median Salary:</span>
                      <span className="font-medium">
                        {formatCurrency(averageMonthlySalary)}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      View Detailed Report
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Department Costs</CardTitle>
                  <CardDescription>
                    Payroll breakdown by department
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <Database className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-sm text-gray-600">
                        {
                          new Set(
                            employees.map((emp) => emp.jobDetails.department),
                          ).size
                        }{" "}
                        departments
                      </p>
                      <p className="text-xs text-gray-500">
                        analyzed for costs
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      View Department Breakdown
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Benefits Analysis</CardTitle>
                  <CardDescription>
                    Employee benefits and packages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {[
                        ...new Set(
                          employees.map(
                            (emp) => emp.compensation.benefitsPackage,
                          ),
                        ),
                      ].map((benefit) => (
                        <div
                          key={benefit}
                          className="flex justify-between text-sm"
                        >
                          <span>{benefit}:</span>
                          <Badge variant="outline">
                            {
                              employees.filter(
                                (emp) =>
                                  emp.compensation.benefitsPackage === benefit,
                              ).length
                            }
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      View Benefits Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Payroll List */}
            <Card>
              <CardHeader>
                <CardTitle>Employee Payroll Data</CardTitle>
                <CardDescription>
                  Current salary information for all employees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Employee</th>
                        <th className="text-left p-3 font-medium">
                          Department
                        </th>
                        <th className="text-left p-3 font-medium">Position</th>
                        <th className="text-right p-3 font-medium">
                          Monthly Salary
                        </th>
                        <th className="text-center p-3 font-medium">
                          Benefits
                        </th>
                        <th className="text-center p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees
                        .sort(
                          (a, b) =>
                            (b.compensation.monthlySalary ||
                              Math.round(
                                (b.compensation as any).annualSalary / 12,
                              ) ||
                              0) -
                            (a.compensation.monthlySalary ||
                              Math.round(
                                (a.compensation as any).annualSalary / 12,
                              ) ||
                              0),
                        )
                        .slice(0, 10)
                        .map((employee) => (
                          <tr
                            key={employee.id}
                            className="border-b hover:bg-muted/50"
                          >
                            <td className="p-3">
                              <div>
                                <div className="font-medium">
                                  {employee.personalInfo.firstName}{" "}
                                  {employee.personalInfo.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {employee.jobDetails.employeeId}
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              {employee.jobDetails.department}
                            </td>
                            <td className="p-3">
                              {employee.jobDetails.position}
                            </td>
                            <td className="p-3 text-right font-medium">
                              {formatCurrency(
                                employee.compensation.monthlySalary ||
                                  Math.round(
                                    (employee.compensation as any)
                                      .annualSalary / 12,
                                  ) ||
                                  0,
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="outline">
                                {employee.compensation.benefitsPackage}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <Badge
                                className={
                                  employee.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }
                              >
                                {employee.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {employees.length > 10 && (
                    <div className="text-center py-4">
                      <Button variant="outline" size="sm">
                        View All {employees.length} Employees
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
