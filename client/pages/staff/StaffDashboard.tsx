import React from "react";
import HotDogNavigation from "@/components/layout/HotDogNavigation";
import { ModuleDashboard } from "@/components/ModuleDashboard";
import { SimpleLogin } from "@/components/SimpleLogin";
import {
  Users,
  UserPlus,
  Building,
  TrendingUp,
  Plus,
  FileText,
} from "lucide-react";

export default function StaffDashboard() {
  const stats = [
    {
      title: "Total Employees",
      value: "42",
      change: "+3",
      changeType: "positive" as const,
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "New Hires (This Month)",
      value: "3",
      change: "+1",
      changeType: "positive" as const,
      icon: <UserPlus className="h-5 w-5" />,
    },
    {
      title: "Departments",
      value: "5",
      change: "0",
      changeType: "neutral" as const,
      icon: <Building className="h-5 w-5" />,
    },
    {
      title: "Employee Retention",
      value: "94%",
      change: "+2%",
      changeType: "positive" as const,
      icon: <TrendingUp className="h-5 w-5" />,
    },
  ];

  const quickActions = [
    {
      label: "Add Employee",
      icon: <Plus className="h-4 w-4" />,
      action: () => (window.location.href = "/staff/add"),
    },
    {
      label: "View All",
      icon: <FileText className="h-4 w-4" />,
      action: () => (window.location.href = "/staff/employees"),
      variant: "outline" as const,
    },
  ];

  const recentItems = [
    {
      title: "Sarah Johnson",
      subtitle: "Software Engineer - Started",
      status: "Active",
      date: "Dec 2, 2024",
    },
    {
      title: "Michael Chen",
      subtitle: "Product Manager - Started",
      status: "Active",
      date: "Nov 28, 2024",
    },
    {
      title: "Emily Rodriguez",
      subtitle: "UX Designer - Started",
      status: "Active",
      date: "Nov 25, 2024",
    },
    {
      title: "Engineering Department",
      subtitle: "Team structure updated",
      date: "Nov 20, 2024",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <HotDogNavigation />
      <SimpleLogin />

      <ModuleDashboard
        moduleName="Staff"
        moduleIcon={<Users className="h-8 w-8" />}
        moduleColor="text-blue-500"
        stats={stats}
        quickActions={quickActions}
        recentItems={recentItems}
      />
    </div>
  );
}
