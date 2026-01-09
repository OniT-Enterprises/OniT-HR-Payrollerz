import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/localAuth";
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
  Target,
  Award,
  Heart,
  CreditCard,
} from "lucide-react";

// Module configuration
const moduleConfig = {
  hiring: {
    id: "hiring",
    label: "Hiring",
    icon: <UserPlus className="h-5 w-5" />,
    color: "text-green-400",
    activeColor: "border-green-400 bg-green-50 text-green-700",
    dashboardPath: "/",
    submenu: [
      {
        label: "Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
        path: "/",
      },
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
  staff: {
    id: "staff",
    label: "Staff",
    icon: <Users className="h-5 w-5" />,
    color: "text-blue-400",
    activeColor: "border-blue-400 bg-blue-50 text-blue-700",
    dashboardPath: "/",
    submenu: [
      {
        label: "Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
        path: "/",
      },
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
  timeleave: {
    id: "timeleave",
    label: "Time & Leave",
    icon: <Clock className="h-5 w-5" />,
    color: "text-purple-400",
    activeColor: "border-purple-400 bg-purple-50 text-purple-700",
    dashboardPath: "/",
    submenu: [
      {
        label: "Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
        path: "/",
      },
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
  performance: {
    id: "performance",
    label: "Performance",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "text-orange-400",
    activeColor: "border-orange-400 bg-orange-50 text-orange-700",
    dashboardPath: "/",
    submenu: [
      {
        label: "Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
        path: "/",
      },
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
  payroll: {
    id: "payroll",
    label: "Payroll",
    icon: <Calculator className="h-5 w-5" />,
    color: "text-yellow-400",
    activeColor: "border-yellow-400 bg-yellow-50 text-yellow-700",
    dashboardPath: "/",
    submenu: [
      {
        label: "Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
        path: "/",
      },
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
  reports: {
    id: "reports",
    label: "Reports",
    icon: <BarChart3 className="h-5 w-5" />,
    color: "text-pink-400",
    activeColor: "border-pink-400 bg-pink-50 text-pink-700",
    dashboardPath: "/",
    submenu: [
      {
        label: "Dashboard",
        icon: <BarChart3 className="h-4 w-4" />,
        path: "/",
      },
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
};

export default function HotDogNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();

  // Determine active module based on current path
  const getActiveModuleFromPath = () => {
    const path = location.pathname;
    for (const [moduleId, config] of Object.entries(moduleConfig)) {
      if (
        path.startsWith(`/${moduleId}`) ||
        config.submenu.some((item) => path === item.path)
      ) {
        return moduleId;
      }
    }
    return "staff"; // Default to staff module
  };

  const [activeModule, setActiveModule] = useState(getActiveModuleFromPath());

  // Get current active submenu item
  const getActiveSubmenuItem = () => {
    const path = location.pathname;
    const module = moduleConfig[activeModule as keyof typeof moduleConfig];
    return module?.submenu.find((item) => item.path === path);
  };

  const handleModuleClick = (moduleId: string) => {
    const module = moduleConfig[moduleId as keyof typeof moduleConfig];
    if (module) {
      setActiveModule(moduleId);
      // Navigate to the module's dashboard by default
      navigate(module.dashboardPath);
    }
  };

  const handleSubmenuClick = (path: string) => {
    navigate(path);
  };

  const activeModuleConfig =
    moduleConfig[activeModule as keyof typeof moduleConfig];
  const activeSubmenuItem = getActiveSubmenuItem();

  return (
    <div className="bg-gray-900 border-b border-gray-700">
      {/* Top-level navigation bar */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Main Navigation */}
          <div className="flex items-center">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center mr-8">
              <Building className="h-8 w-8 text-blue-400 mr-3" />
              <Button
                variant="ghost"
                onClick={() => navigate("/")}
                className="text-white font-semibold text-lg hover:bg-gray-700 px-2"
              >
                Payroll
              </Button>
            </div>

            {/* Main Module Navigation */}
            <div className="flex space-x-1">
              {Object.entries(moduleConfig).map(([moduleId, config]) => (
                <Button
                  key={moduleId}
                  variant="ghost"
                  onClick={() => handleModuleClick(moduleId)}
                  className={`
                    flex items-center gap-2 px-4 py-2 h-12 relative transition-all duration-200
                    ${
                      activeModule === moduleId
                        ? `${config.activeColor} border-b-2 font-medium`
                        : "text-gray-300 hover:text-white hover:bg-gray-700"
                    }
                  `}
                >
                  <span
                    className={activeModule === moduleId ? "" : config.color}
                  >
                    {config.icon}
                  </span>
                  {config.label}

                  {/* Active indicator underline */}
                  {activeModule === moduleId && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-current" />
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Right side - User avatar */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative p-0 h-10 w-10 rounded-full hover:bg-gray-700 group"
                  title={
                    user ? `${user.name} - Click for settings` : "User menu"
                  }
                >
                  {/* Gear wheel hint */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-50 transition-opacity duration-300">
                    <Cog className="h-10 w-10 text-gray-400 animate-spin-slow" />
                  </div>

                  {/* User Avatar */}
                  <Avatar className="h-8 w-8 relative z-10">
                    <AvatarFallback className="bg-blue-600 text-white text-sm font-medium">
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
                className="w-64 bg-gray-900 border-gray-700"
                align="end"
                sideOffset={5}
              >
                {user && (
                  <>
                    <DropdownMenuItem className="text-gray-300 flex-col items-start pointer-events-none">
                      <div className="flex items-center gap-2 w-full">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {user.role}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {user.company}
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-700" />
                  </>
                )}

                <DropdownMenuItem
                  className="text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer"
                  onClick={() => navigate("/settings")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer"
                  onClick={() => navigate("/profile")}
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-gray-700" />

                <DropdownMenuItem
                  className="text-red-400 hover:text-red-300 hover:bg-gray-700 cursor-pointer"
                  onClick={() => {
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
      </div>

      {/* Contextual submenu bar */}
      {activeModuleConfig && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-12 space-x-1 overflow-x-auto">
            {activeModuleConfig.submenu.map((item, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => handleSubmenuClick(item.path)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 h-8 whitespace-nowrap transition-all duration-200
                  ${
                    activeSubmenuItem?.path === item.path
                      ? "bg-gray-700 text-white font-medium"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                  }
                `}
              >
                {item.icon}
                <span className="text-sm">{item.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
