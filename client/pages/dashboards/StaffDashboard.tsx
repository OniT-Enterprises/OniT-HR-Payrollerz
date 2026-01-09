import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import { employeeService, type Employee } from "@/services/employeeService";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserCheck,
  UserX,
  Building,
  TrendingUp,
  Calendar,
  Award,
  Briefcase,
} from "lucide-react";

export default function StaffDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
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

  // Calculate real statistics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(
    (emp) => emp.status === "active",
  ).length;
  const inactiveEmployees = employees.filter(
    (emp) => emp.status === "inactive",
  ).length;

  // Calculate department breakdown
  const departmentStats = employees.reduce(
    (acc, emp) => {
      const dept = emp.jobDetails.department;
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalDepartments = Object.keys(departmentStats).length;
  const activeRate =
    totalEmployees > 0
      ? ((activeEmployees / totalEmployees) * 100).toFixed(1)
      : "0";

  // Get top departments
  const topDepartments = Object.entries(departmentStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <HotDogStyleNavigation />
        <div className="p-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3">Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-8 w-8 text-cyan-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Staff Dashboard
                </h1>
                <p className="text-gray-600">
                  Overview of employee management and organization
                </p>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Employees
                    </p>
                    <p className="text-2xl font-bold">{totalEmployees}</p>
                    <p className="text-xs text-blue-600">In database</p>
                  </div>
                  <Users className="h-8 w-8 text-cyan-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Active Employees
                    </p>
                    <p className="text-2xl font-bold">{activeEmployees}</p>
                    <p className="text-xs text-green-600">
                      {activeRate}% active rate
                    </p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Departments
                    </p>
                    <p className="text-2xl font-bold">{totalDepartments}</p>
                    <p className="text-xs text-purple-600">
                      Active departments
                    </p>
                  </div>
                  <Building className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Inactive/Terminated
                    </p>
                    <p className="text-2xl font-bold">{inactiveEmployees}</p>
                    <p className="text-xs text-orange-600">
                      {totalEmployees > 0
                        ? ((inactiveEmployees / totalEmployees) * 100).toFixed(
                            1,
                          )
                        : "0"}
                      % of workforce
                    </p>
                  </div>
                  <UserX className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department Overview & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Department Breakdown</CardTitle>
                <CardDescription>
                  Employee distribution by department ({totalEmployees} total)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {totalEmployees === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm">No employees in database</p>
                      <p className="text-xs text-gray-400">
                        Add employees to see department breakdown
                      </p>
                    </div>
                  ) : topDepartments.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      <p className="text-sm">No department data available</p>
                    </div>
                  ) : (
                    topDepartments.map(([department, count], index) => {
                      const percentage =
                        totalEmployees > 0
                          ? ((count / totalEmployees) * 100).toFixed(1)
                          : "0";
                      const colors = [
                        { bg: "bg-blue-50", dot: "bg-blue-500" },
                        { bg: "bg-green-50", dot: "bg-green-500" },
                        { bg: "bg-purple-50", dot: "bg-purple-500" },
                        { bg: "bg-orange-50", dot: "bg-orange-500" },
                      ];
                      const color = colors[index] || {
                        bg: "bg-gray-50",
                        dot: "bg-gray-500",
                      };

                      return (
                        <div
                          key={department}
                          className={`flex items-center justify-between p-3 ${color.bg} rounded-lg`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-3 h-3 ${color.dot} rounded-full`}
                            ></div>
                            <div>
                              <p className="text-sm font-medium">
                                {department}
                              </p>
                              <p className="text-xs text-gray-600">
                                {count} employee{count !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{count}</p>
                            <p className="text-xs text-gray-600">
                              {percentage}%
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {topDepartments.length > 0 &&
                    Object.keys(departmentStats).length > 4 && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                          <div>
                            <p className="text-sm font-medium">
                              Other Departments
                            </p>
                            <p className="text-xs text-gray-600">
                              {Object.keys(departmentStats).length - 4} more
                              departments
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {Object.entries(departmentStats)
                              .slice(4)
                              .reduce((sum, [, count]) => sum + count, 0)}
                          </p>
                          <p className="text-xs text-gray-600">
                            {totalEmployees > 0
                              ? (
                                  (Object.entries(departmentStats)
                                    .slice(4)
                                    .reduce(
                                      (sum, [, count]) => sum + count,
                                      0,
                                    ) /
                                    totalEmployees) *
                                  100
                                ).toFixed(1)
                              : "0"}
                            %
                          </p>
                        </div>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Database Status</CardTitle>
                <CardDescription>
                  Real-time employee data overview
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Live Data Connection
                      </p>
                      <p className="text-xs text-gray-600">
                        Connected to Firebase database
                      </p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">Live</Badge>
                  </div>

                  {totalEmployees > 0 ? (
                    <>
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <UserCheck className="h-5 w-5 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            Active Employees
                          </p>
                          <p className="text-xs text-gray-600">
                            {activeEmployees} employees currently active
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          {activeEmployees}
                        </Badge>
                      </div>

                      {totalDepartments > 0 && (
                        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                          <Building className="h-5 w-5 text-purple-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Departments Active
                            </p>
                            <p className="text-xs text-gray-600">
                              {totalDepartments} departments with employees
                            </p>
                          </div>
                          <Badge className="bg-purple-100 text-purple-800">
                            {totalDepartments}
                          </Badge>
                        </div>
                      )}

                      {inactiveEmployees > 0 && (
                        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                          <UserX className="h-5 w-5 text-orange-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Inactive Employees
                            </p>
                            <p className="text-xs text-gray-600">
                              {inactiveEmployees} employees marked as inactive
                            </p>
                          </div>
                          <Badge className="bg-orange-100 text-orange-800">
                            {inactiveEmployees}
                          </Badge>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Users className="h-5 w-5 text-gray-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">No Employee Data</p>
                        <p className="text-xs text-gray-600">
                          Add employees to see dashboard statistics
                        </p>
                      </div>
                      <Badge className="bg-gray-100 text-gray-800">Empty</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
