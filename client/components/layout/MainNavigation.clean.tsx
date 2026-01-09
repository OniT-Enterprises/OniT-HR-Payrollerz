import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAuthenticated } from "@/lib/localAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  Settings,
  Users,
  UserPlus,
  BarChart3,
  Calculator,
  FileText,
  Calendar,
  Clock,
  TrendingUp,
  Briefcase,
  Cog,
  UserCog,
  Building2,
  DollarSign,
  PieChart,
  Activity,
  Shield,
  ChevronDown,
  Target,
  Award,
  Heart,
  CreditCard,
} from "lucide-react";

export default function MainNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const user = getCurrentUser();

  const navigationItems = [
    {
      id: "hiring",
      label: "Hiring",
      icon: <UserPlus className="h-5 w-5" />,
      color: "text-green-400",
      items: [
        {
          label: "Create Job",
          icon: <Briefcase className="h-4 w-4" />,
          path: "/hiring/create-job",
        },
        {
          label: "Candidate Selection",
          icon: <Users className="h-4 w-4" />,
          path: "/hiring/candidates",
        },
        {
          label: "Interviews",
          icon: <Calendar className="h-4 w-4" />,
          path: "/hiring/interviews",
        },
        {
          label: "Onboarding",
          icon: <UserPlus className="h-4 w-4" />,
          path: "/hiring/onboarding",
        },
        {
          label: "Offboarding",
          icon: <UserCog className="h-4 w-4" />,
          path: "/hiring/offboarding",
        },
      ],
    },
    {
      id: "staff",
      label: "Staff",
      icon: <Users className="h-5 w-5" />,
      color: "text-blue-400",
      items: [
        {
          label: "All Employees",
          icon: <Users className="h-4 w-4" />,
          path: "/staff/employees",
        },
        {
          label: "Add Employee",
          icon: <UserPlus className="h-4 w-4" />,
          path: "/staff/add",
        },
        {
          label: "Departments",
          icon: <Building className="h-4 w-4" />,
          path: "/staff/departments",
        },
        {
          label: "Organization Chart",
          icon: <Building2 className="h-4 w-4" />,
          path: "/staff/org-chart",
        },
      ],
    },
    {
      id: "timeleave",
      label: "Time & Leave",
      icon: <Clock className="h-5 w-5" />,
      color: "text-purple-400",
      items: [
        {
          label: "Time Tracking",
          icon: <Clock className="h-4 w-4" />,
          path: "/time-leave/tracking",
        },
        {
          label: "Attendance",
          icon: <Calendar className="h-4 w-4" />,
          path: "/time-leave/attendance",
        },
        {
          label: "Leave Requests",
          icon: <Heart className="h-4 w-4" />,
          path: "/time-leave/requests",
        },
        {
          label: "Shift Scheduling",
          icon: <Calendar className="h-4 w-4" />,
          path: "/time-leave/scheduling",
        },
      ],
    },
    {
      id: "performance",
      label: "Performance",
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-orange-400",
      items: [
        {
          label: "Goals & OKRs",
          icon: <Target className="h-4 w-4" />,
          path: "/performance/goals",
        },
        {
          label: "Reviews",
          icon: <Award className="h-4 w-4" />,
          path: "/performance/reviews",
        },
        {
          label: "Training & Certifications",
          icon: <Award className="h-4 w-4" />,
          path: "/performance/training",
        },
        {
          label: "Disciplinary",
          icon: <Shield className="h-4 w-4" />,
          path: "/performance/disciplinary",
        },
      ],
    },
    {
      id: "payroll",
      label: "Payroll",
      icon: <Calculator className="h-5 w-5" />,
      color: "text-yellow-400",
      items: [
        {
          label: "Run Payroll",
          icon: <Calculator className="h-4 w-4" />,
          path: "/payroll/run",
        },
        {
          label: "Payroll History",
          icon: <FileText className="h-4 w-4" />,
          path: "/payroll/history",
        },
        {
          label: "Bank Transfers",
          icon: <CreditCard className="h-4 w-4" />,
          path: "/payroll/transfers",
        },
        {
          label: "Tax Reports",
          icon: <FileText className="h-4 w-4" />,
          path: "/payroll/taxes",
        },
        {
          label: "Benefits Enrollment",
          icon: <Heart className="h-4 w-4" />,
          path: "/payroll/benefits",
        },
        {
          label: "Deductions & Advances",
          icon: <DollarSign className="h-4 w-4" />,
          path: "/payroll/deductions",
        },
      ],
    },
    {
      id: "reports",
      label: "Reports",
      icon: <BarChart3 className="h-5 w-5" />,
      color: "text-pink-400",
      items: [
        {
          label: "Employee Reports",
          icon: <Users className="h-4 w-4" />,
          path: "/reports/employees",
        },
        {
          label: "Payroll Reports",
          icon: <Calculator className="h-4 w-4" />,
          path: "/reports/payroll",
        },
        {
          label: "Attendance Reports",
          icon: <Calendar className="h-4 w-4" />,
          path: "/reports/attendance",
        },
        {
          label: "Custom Reports",
          icon: <PieChart className="h-4 w-4" />,
          path: "/reports/custom",
        },
      ],
    },
  ];

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const isActiveSection = (sectionId: string) => {
    const section = navigationItems.find((item) => item.id === sectionId);
    if (!section) return false;

    return section.items.some((item) => isActiveRoute(item.path));
  };

  const handleDropdownClick = (dropdownId: string) => {
    setActiveDropdown(activeDropdown === dropdownId ? null : dropdownId);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setActiveDropdown(null);
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16">
        {/* Logo and Main Navigation */}
        <div className="flex items-center">
          <div className="flex-shrink-0 flex items-center">
            <Building className="h-8 w-8 text-blue-400 mr-3" />
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-white font-semibold text-lg hover:bg-gray-700 px-2"
            >
              Payroll
            </Button>
          </div>

          {/* Main Navigation Items */}
          <div className="hidden md:ml-6 md:flex md:space-x-2">
            {navigationItems.map((section) => (
              <DropdownMenu
                key={section.id}
                open={activeDropdown === section.id}
                onOpenChange={(open) =>
                  setActiveDropdown(open ? section.id : null)
                }
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`text-white hover:bg-gray-700 flex items-center gap-2 ${
                      isActiveSection(section.id) ? "bg-gray-700" : ""
                    }`}
                    onClick={() => handleDropdownClick(section.id)}
                  >
                    <span className={section.color}>{section.icon}</span>
                    {section.label}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56 bg-gray-900 border-gray-700"
                  align="start"
                  sideOffset={5}
                >
                  {section.items.map((item, index) => (
                    <DropdownMenuItem
                      key={index}
                      className={`text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer ${
                        isActiveRoute(item.path) ? "bg-gray-700 text-white" : ""
                      }`}
                      onClick={() => handleNavigate(item.path)}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>
        </div>

        {/* Right side - User info and settings */}
        <div className="flex items-center gap-3">
          {/* Company/Tenant Info */}
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg">
              <Building className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300">{user.company}</span>
              <Badge variant="outline" className="text-xs">
                {user.role}
              </Badge>
            </div>
          )}

          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="p-0 h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {user
                      ? user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                      : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 bg-gray-900 border-gray-700"
              align="end"
              sideOffset={5}
            >
              {user && (
                <>
                  <DropdownMenuItem className="text-gray-300 flex-col items-start">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                </>
              )}
              <DropdownMenuItem
                className="text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer"
                onClick={() => handleNavigate("/settings")}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer"
                onClick={() => handleNavigate("/profile")}
              >
                <UserCog className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem
                className="text-red-400 hover:text-red-300 hover:bg-gray-700 cursor-pointer"
                onClick={() => {
                  // Handle sign out
                  const { signOutLocal } = require("@/lib/localAuth");
                  signOutLocal();
                  window.location.reload();
                }}
              >
                <Activity className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
