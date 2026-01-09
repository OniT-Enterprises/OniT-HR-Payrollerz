import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import HotDogStyleNavigation from "@/components/layout/HotDogStyleNavigation";
import {
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  Calendar,
  Download,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

export default function Dashboard() {
  // Local state for dashboard data
  const [dashboardData, setDashboardData] = useState({
    totalEmployees: 42,
    monthlyPayroll: 1247800,
    hoursThisWeek: 9856,
    openPositions: 18,
  });

  const stats = [
    {
      title: "Total Employees",
      value: dashboardData.totalEmployees.toString(),
      change: "+3",
      changeType: "positive" as const,
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Monthly Payroll",
      value: `$${dashboardData.monthlyPayroll.toLocaleString()}`,
      change: "+8.2%",
      changeType: "positive" as const,
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: "Hours This Week",
      value: dashboardData.hoursThisWeek.toLocaleString(),
      change: "-2.1%",
      changeType: "negative" as const,
      icon: <Clock className="h-5 w-5" />,
    },
    {
      title: "Open Positions",
      value: dashboardData.openPositions.toString(),
      change: "+5",
      changeType: "neutral" as const,
      icon: <TrendingUp className="h-5 w-5" />,
    },
  ];

  const recentPayrolls = [
    {
      period: "November 2024",
      amount: "$1,247,800",
      status: "completed",
      employees: 42,
    },
    {
      period: "October 2024",
      amount: "$1,198,250",
      status: "completed",
      employees: 41,
    },
    {
      period: "September 2024",
      amount: "$1,156,900",
      status: "completed",
      employees: 39,
    },
  ];

  const upcomingTasks = [
    {
      task: "Process December Payroll",
      dueDate: "Dec 31, 2024",
      priority: "high",
    },
    {
      task: "Year-end Tax Reports",
      dueDate: "Jan 15, 2025",
      priority: "high",
    },
    {
      task: "Benefits Enrollment Review",
      dueDate: "Dec 15, 2024",
      priority: "medium",
    },
    {
      task: "Q4 Performance Reviews",
      dueDate: "Dec 20, 2024",
      priority: "medium",
    },
  ];

  const recentHires = [
    {
      name: "Sarah Johnson",
      position: "Software Engineer",
      department: "Engineering",
      startDate: "Dec 2, 2024",
      avatar: "/api/placeholder/32/32",
    },
    {
      name: "Michael Chen",
      position: "Product Manager",
      department: "Product",
      startDate: "Nov 28, 2024",
      avatar: "/api/placeholder/32/32",
    },
    {
      name: "Emily Rodriguez",
      position: "UX Designer",
      department: "Design",
      startDate: "Nov 25, 2024",
      avatar: "/api/placeholder/32/32",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <HotDogStyleNavigation />

      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">HR Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's what's happening with your HR operations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className="text-muted-foreground">{stat.icon}</div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {stat.changeType === "positive" && (
                    <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                  )}
                  {stat.changeType === "negative" && (
                    <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                  )}
                  {stat.changeType === "neutral" && (
                    <Minus className="h-3 w-3 text-gray-500 mr-1" />
                  )}
                  <span
                    className={
                      stat.changeType === "positive"
                        ? "text-green-500"
                        : stat.changeType === "negative"
                          ? "text-red-500"
                          : "text-gray-500"
                    }
                  >
                    {stat.change}
                  </span>
                  <span className="ml-1">from last month</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Payroll Progress */}
          <Card>
            <CardHeader>
              <CardTitle>December Payroll Progress</CardTitle>
              <CardDescription>
                Track the current payroll processing status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Employee Data Review</span>
                  <span>100%</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Time & Attendance</span>
                  <span>95%</span>
                </div>
                <Progress value={95} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Deductions & Benefits</span>
                  <span>80%</span>
                </div>
                <Progress value={80} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Final Processing</span>
                  <span>0%</span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Upcoming Tasks</CardTitle>
                  <CardDescription>
                    Important HR tasks and deadlines
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingTasks.map((task, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{task.task}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.dueDate}
                      </p>
                    </div>
                    <Badge
                      variant={
                        task.priority === "high"
                          ? "destructive"
                          : task.priority === "medium"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Payrolls */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Payrolls</CardTitle>
              <CardDescription>
                Last 3 months of payroll processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentPayrolls.map((payroll, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{payroll.period}</p>
                      <p className="text-xs text-muted-foreground">
                        {payroll.employees} employees
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{payroll.amount}</p>
                      <Badge variant="outline" className="text-xs">
                        {payroll.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Hires */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Hires</CardTitle>
              <CardDescription>
                New team members who joined recently
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentHires.map((hire, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={hire.avatar} alt={hire.name} />
                      <AvatarFallback>
                        {hire.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium">{hire.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {hire.position} • {hire.department}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {hire.startDate}
                      </p>
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
