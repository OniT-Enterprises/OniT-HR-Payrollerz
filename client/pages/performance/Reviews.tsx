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
  Star,
  Users,
  Database,
  AlertCircle,
  User,
  Plus,
  Filter,
  Download,
} from "lucide-react";

export default function Reviews() {
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

  const activeEmployees = employees.filter((emp) => emp.status === "active");

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <HotDogStyleNavigation />
        <div className="p-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3">Loading performance reviews...</span>
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
          <Star className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold">Performance Reviews</h1>
            <p className="text-muted-foreground">
              Manage and track employee performance evaluations
            </p>
          </div>
        </div>

        {employees.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <Star className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Performance Data</h3>
            <p className="text-muted-foreground mb-6">
              Add employees to your database to start performance reviews
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
                      <p className="text-xs text-blue-600">
                        Available to review
                      </p>
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
                        Active Employees
                      </p>
                      <p className="text-2xl font-bold">
                        {activeEmployees.length}
                      </p>
                      <p className="text-xs text-green-600">
                        Ready for reviews
                      </p>
                    </div>
                    <User className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Reviews Completed
                      </p>
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-xs text-gray-600">No reviews yet</p>
                    </div>
                    <Star className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Pending Reviews
                      </p>
                      <p className="text-2xl font-bold">
                        {activeEmployees.length}
                      </p>
                      <p className="text-xs text-purple-600">Need review</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Review
              </Button>
            </div>

            {/* Review System Setup */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Review System</CardTitle>
                <CardDescription>
                  Ready to start performance reviews for your {employees.length}{" "}
                  employees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold">Getting Started</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">
                          ✓
                        </div>
                        <div>
                          <p className="font-medium text-sm">Employees Added</p>
                          <p className="text-xs text-gray-600">
                            {employees.length} employees in database
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                          2
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            Setup Review Cycle
                          </p>
                          <p className="text-xs text-gray-600">
                            Configure review periods and criteria
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm">
                          3
                        </div>
                        <div>
                          <p className="font-medium text-sm">Start Reviews</p>
                          <p className="text-xs text-gray-600">
                            Begin performance evaluations
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">Available Features</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span>5-star rating system</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span>Employee goal tracking</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Database className="h-4 w-4 text-green-500" />
                        <span>Performance analytics</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Download className="h-4 w-4 text-purple-500" />
                        <span>Review export & reporting</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employee List for Reviews */}
            <Card>
              <CardHeader>
                <CardTitle>Employees Ready for Review</CardTitle>
                <CardDescription>
                  {activeEmployees.length} active employees available for
                  performance review
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeEmployees.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-sm text-gray-600">
                      No active employees to review
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeEmployees.slice(0, 9).map((employee) => (
                      <Card
                        key={employee.id}
                        className="border border-gray-200"
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div>
                              <h4 className="font-semibold">
                                {employee.personalInfo.firstName}{" "}
                                {employee.personalInfo.lastName}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {employee.jobDetails.position}
                              </p>
                              <p className="text-xs text-gray-500">
                                {employee.jobDetails.department}
                              </p>
                            </div>
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">
                                {employee.jobDetails.employeeId}
                              </Badge>
                              <Button size="sm" variant="outline">
                                Start Review
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {activeEmployees.length > 9 && (
                      <Card className="border border-gray-200 border-dashed">
                        <CardContent className="p-4 flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-sm font-medium">
                              +{activeEmployees.length - 9} more
                            </p>
                            <p className="text-xs text-gray-600">
                              employees ready
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
