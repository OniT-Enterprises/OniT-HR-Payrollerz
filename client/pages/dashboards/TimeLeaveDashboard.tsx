import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";
import { employeeService, type Employee } from "@/services/employeeService";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Calendar,
  Users,
  UserCheck,
  Plus,
  CheckCircle,
  CalendarDays,
} from "lucide-react";

function TimeLeaveDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Header Skeleton */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <Skeleton className="h-8 w-36 mb-2" />
                <Skeleton className="h-5 w-72" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-5 rounded" />
                  </div>
                  <Skeleton className="h-9 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-6 w-28 mb-2" />
                      <Skeleton className="h-4 w-44" />
                    </div>
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-36 mb-1" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions Skeleton */}
          <div>
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimeLeaveDashboard() {
  const navigate = useNavigate();
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

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((emp) => emp.status === "active").length;

  const stats = [
    {
      title: "Total Employees",
      value: totalEmployees,
      subtitle: "In database",
      icon: Users,
    },
    {
      title: "Active Employees",
      value: activeEmployees,
      subtitle: "Available for tracking",
      icon: UserCheck,
    },
    {
      title: "Time Entries",
      value: 0,
      subtitle: "No data yet",
      icon: Clock,
    },
    {
      title: "Leave Requests",
      value: 0,
      subtitle: "No requests yet",
      icon: Calendar,
    },
  ];

  const setupSteps = [
    {
      step: 1,
      title: "Add Employees",
      description: "Import or add employees to your database",
      complete: totalEmployees > 0,
    },
    {
      step: 2,
      title: "Configure Time Tracking",
      description: "Set up time tracking policies and rules",
      complete: false,
    },
    {
      step: 3,
      title: "Setup Leave Policies",
      description: "Define leave types and approval workflows",
      complete: false,
    },
  ];

  if (loading) {
    return <TimeLeaveDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Clean Header */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Time & Leave</h1>
                <p className="text-muted-foreground mt-1">
                  Attendance, time tracking, and leave management
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2" onClick={() => navigate("/people/time-tracking")}>
                  <Clock className="h-4 w-4" />
                  Track Time
                </Button>
                <Button onClick={() => navigate("/people/leave")} className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </span>
                    <stat.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-sm text-muted-foreground mt-1">{stat.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Status</CardTitle>
                    <CardDescription>Real-time employee data</CardDescription>
                  </div>
                  <Badge variant="secondary">Live</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Database Connected</p>
                      <p className="text-xs text-muted-foreground">Connected to Firebase</p>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      Live
                    </Badge>
                  </div>

                  {totalEmployees > 0 ? (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Employees Available</p>
                        <p className="text-xs text-muted-foreground">{activeEmployees} active employees</p>
                      </div>
                      <span className="text-xl font-bold">{activeEmployees}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-lg bg-muted">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">No Employee Data</p>
                        <p className="text-xs text-muted-foreground">Add employees to enable tracking</p>
                      </div>
                      <Badge variant="secondary">Empty</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Getting Started */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Getting Started</CardTitle>
                    <CardDescription>Setup time & leave tracking</CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {setupSteps.filter(s => s.complete).length}/{setupSteps.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {setupSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                        step.complete ? "bg-primary/5" : "bg-muted/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${step.complete ? "bg-primary/10" : "bg-muted"}`}>
                        {step.complete ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <span className="h-4 w-4 flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {step.step}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{step.title}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                      <Badge variant="secondary" className={step.complete ? "bg-primary/10 text-primary" : ""}>
                        {step.complete ? "Done" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Time Tracking", icon: Clock, path: "/people/time-tracking" },
                { label: "Attendance", icon: Calendar, path: "/people/attendance" },
                { label: "Leave Requests", icon: CalendarDays, path: "/people/leave" },
                { label: "Scheduling", icon: CalendarDays, path: "/people/schedules" },
              ].map((action, index) => (
                <button
                  key={index}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                >
                  <action.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
