import { Button } from "@/components/ui/button";
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
import MainNavigation from "@/components/layout/MainNavigation";
import { employeeService } from "@/services/employeeService";
import FirebaseTestComponent from "@/components/FirebaseTestComponent";
import { DirectEmailLogin } from "@/components/DirectEmailLogin";
import { EmergencyFetchFix } from "@/components/EmergencyFetchFix";
import { FirestoreRulesDeploy } from "@/components/FirestoreRulesDeploy";
import React, { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  Calendar,
  FileText,
  CheckCircle,
  MoreHorizontal,
  Download,
  Plus,
} from "lucide-react";

export default function Dashboard() {
  const [totalEmployees, setTotalEmployees] = useState(0);

  useEffect(() => {
    loadEmployeeCount();
  }, []);

  const loadEmployeeCount = async () => {
    try {
      const employees = await employeeService.getAllEmployees();
      setTotalEmployees(employees.length);
    } catch (error) {
      console.error("Error loading employee count:", error);
    }
  };

  const stats = [
    {
      title: "Total Employees",
      value: totalEmployees.toString(),
      change: "Live data",
      changeType: "positive" as const,
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Monthly Payroll",
      value: "$1,247,800",
      change: "+8.2%",
      changeType: "positive" as const,
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: "Hours This Week",
      value: "9,856",
      change: "-2.1%",
      changeType: "negative" as const,
      icon: <Clock className="h-5 w-5" />,
    },
    {
      title: "Open Positions",
      value: "18",
      change: "+5",
      changeType: "neutral" as const,
      icon: <TrendingUp className="h-5 w-5" />,
    },
  ];

  const recentPayrolls = [
    {
      period: "November 2024",
      amount: "$1,247,800",
      status: "Completed",
      date: "Nov 30, 2024",
    },
    {
      period: "October 2024",
      amount: "$1,198,450",
      status: "Completed",
      date: "Oct 31, 2024",
    },
    {
      period: "September 2024",
      amount: "$1,156,200",
      status: "Completed",
      date: "Sep 30, 2024",
    },
  ];

  const upcomingTasks = [
    { task: "Process December Payroll", due: "Dec 31, 2024", priority: "high" },
    { task: "Year-end Tax Reports", due: "Jan 15, 2025", priority: "high" },
    {
      task: "Benefits Enrollment Review",
      due: "Dec 15, 2024",
      priority: "medium",
    },
    {
      task: "Performance Review Cycle",
      due: "Dec 20, 2024",
      priority: "medium",
    },
  ];

  const recentActivity = [
    {
      user: "Sarah Chen",
      action: "completed payroll review",
      time: "2 hours ago",
      avatar: "SC",
    },
    {
      user: "Mike Rodriguez",
      action: "updated employee benefits",
      time: "4 hours ago",
      avatar: "MR",
    },
    {
      user: "Emma Thompson",
      action: "submitted time-off request",
      time: "6 hours ago",
      avatar: "ET",
    },
    {
      user: "System",
      action: "automated backup completed",
      time: "8 hours ago",
      avatar: "SY",
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      <div className="p-6">
        {/* Direct Email Login for celestinod@gmail.com */}
        <DirectEmailLogin />

        {/* Emergency Fetch Fix */}
        <EmergencyFetchFix />

        {/* Firestore Rules Deployment */}
        <FirestoreRulesDeploy />

        {/* Temporary Firebase Test Component for Debugging */}
        <FirebaseTestComponent />
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Main Dashboard!?</h1>
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
                <p
                  className={`text-xs flex items-center gap-1 ${
                    stat.changeType === "positive"
                      ? "text-green-600"
                      : stat.changeType === "negative"
                        ? "text-red-600"
                        : "text-muted-foreground"
                  }`}
                >
                  {stat.change}
                  <span className="text-muted-foreground">from last month</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Payroll Progress */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>December Payroll Progress</CardTitle>
              <CardDescription>
                Track the current payroll processing status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                  <span>Tax Calculations</span>
                  <span>45%</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
              <div className="pt-4">
                <Button className="w-full">Continue Payroll Processing</Button>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Upcoming Tasks</CardTitle>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingTasks.map((task, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{task.task}</p>
                    <p className="text-xs text-muted-foreground">{task.due}</p>
                  </div>
                  <Badge variant={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-4">
                View All Tasks
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Payrolls */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Payrolls</CardTitle>
              <CardDescription>
                Latest payroll processing history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentPayrolls.map((payroll, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{payroll.period}</p>
                      <p className="text-xs text-muted-foreground">
                        {payroll.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{payroll.amount}</p>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-green-600">
                          {payroll.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                View Payroll History
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {activity.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user}</span>{" "}
                        {activity.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                View All Activity
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
