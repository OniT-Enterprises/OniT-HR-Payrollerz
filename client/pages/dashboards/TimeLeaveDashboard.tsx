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
import { employeeService } from "@/services/employeeService";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Calendar,
  Users,
  UserCheck,
  Database,
  AlertCircle,
} from "lucide-react";

export default function TimeLeaveDashboard() {
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

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(
    (emp) => emp.status === "active",
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <HotDogStyleNavigation />
        <div className="p-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading time & leave data...</span>
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
              <Clock className="h-8 w-8 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Time & Leave Dashboard
                </h1>
                <p className="text-gray-600">
                  Overview of attendance, time tracking, and leave management
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
                  <Users className="h-8 w-8 text-blue-500" />
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
                      Available for tracking
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
                      Time Entries
                    </p>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-xs text-gray-600">No data yet</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Leave Requests
                    </p>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-xs text-gray-600">No requests yet</p>
                  </div>
                  <Calendar className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Database Status</CardTitle>
                <CardDescription>
                  Real-time employee data for time tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Database className="h-5 w-5 text-blue-600" />
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
                        <Users className="h-5 w-5 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            Employees Available
                          </p>
                          <p className="text-xs text-gray-600">
                            {activeEmployees} active employees ready for time
                            tracking
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          {activeEmployees}
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-gray-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">No Employee Data</p>
                        <p className="text-xs text-gray-600">
                          Add employees to enable time & leave tracking
                        </p>
                      </div>
                      <Badge className="bg-gray-100 text-gray-800">Empty</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Set up time & leave tracking for your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Step 1: Add Employees
                      </p>
                      <p className="text-xs text-gray-600">
                        Import or add employees to your database
                      </p>
                    </div>
                    <Badge
                      className={
                        totalEmployees > 0
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {totalEmployees > 0 ? "Complete" : "Pending"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="h-5 w-5 text-gray-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Step 2: Configure Time Tracking
                      </p>
                      <p className="text-xs text-gray-600">
                        Set up time tracking policies and rules
                      </p>
                    </div>
                    <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Step 3: Setup Leave Policies
                      </p>
                      <p className="text-xs text-gray-600">
                        Define leave types and approval workflows
                      </p>
                    </div>
                    <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
