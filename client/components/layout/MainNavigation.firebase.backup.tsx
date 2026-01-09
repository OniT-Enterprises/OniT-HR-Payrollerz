import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { signInWithEmail, signInDev, getAuthStatus } from "@/lib/devAuth";
import { autoSetupTenantForUser } from "@/lib/tenantSetup";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const [authStatus, setAuthStatus] = useState(getAuthStatus());
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Monitor auth status
  useEffect(() => {
    const interval = setInterval(() => {
      setAuthStatus(getAuthStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return;

    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
      setAuthStatus(getAuthStatus());
      setShowLogin(false);
      setEmail('');
      setPassword('');

      // Auto-setup tenant
      const status = getAuthStatus();
      if (status.isSignedIn && status.user) {
        await autoSetupTenantForUser(status.user.uid, status.user.email || 'user@example.com');
        window.location.reload(); // Refresh to load tenant
      }
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setIsLoading(true);
    try {
      await signInDev();
      setAuthStatus(getAuthStatus());

      // Auto-setup tenant
      const status = getAuthStatus();
      if (status.isSignedIn && status.user) {
        await autoSetupTenantForUser(status.user.uid, status.user.email || 'anonymous@example.com');
        window.location.reload(); // Refresh to load tenant
      }
    } catch (error) {
      console.error('Anonymous login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
      color: "text-purple-400",
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
          icon: <BarChart3 className="h-4 w-4" />,
          path: "/staff/org-chart",
        },
      ],
    },
    {
      id: "time-leave",
      label: "Time & Leave",
      icon: <Clock className="h-5 w-5" />,
      color: "text-blue-400",
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
          label: "Leave Requests & Approvals",
          icon: <FileText className="h-4 w-4" />,
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
          label: "Reviews",
          icon: <FileText className="h-4 w-4" />,
          path: "/performance/reviews",
        },
        {
          label: "Goals & OKRs",
          icon: <Target className="h-4 w-4" />,
          path: "/performance/goals",
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
      color: "text-emerald-400",
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
          label: "Tax Reports",
          icon: <PieChart className="h-4 w-4" />,
          path: "/payroll/taxes",
        },
        {
          label: "Bank Transfers",
          icon: <DollarSign className="h-4 w-4" />,
          path: "/payroll/transfers",
        },
        {
          label: "Benefits Enrollment",
          icon: <Heart className="h-4 w-4" />,
          path: "/payroll/benefits",
        },
        {
          label: "Deductions/Advances",
          icon: <CreditCard className="h-4 w-4" />,
          path: "/payroll/deductions",
        },
      ],
    },
    {
      id: "reports",
      label: "Reports",
      icon: <FileText className="h-5 w-5" />,
      color: "text-pink-400",
      items: [
        {
          label: "Payroll Reports",
          icon: <Calculator className="h-4 w-4" />,
          path: "/reports/payroll",
        },
        {
          label: "Employee Reports",
          icon: <Users className="h-4 w-4" />,
          path: "/reports/employees",
        },
        {
          label: "Attendance Reports",
          icon: <Clock className="h-4 w-4" />,
          path: "/reports/attendance",
        },
        {
          label: "Custom Reports",
          icon: <BarChart3 className="h-4 w-4" />,
          path: "/reports/custom",
        },
      ],
    },
  ];

  const handleDropdownClick = (itemId: string) => {
    // Navigate to module dashboard
    navigate(`/${itemId}`);
    setActiveDropdown(itemId);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    // Don't close dropdown when navigating to submenu items
  };

  const isActiveModule = (moduleId: string) => {
    return location.pathname.startsWith(`/${moduleId}`);
  };

  const isMainDashboard = () => {
    return location.pathname === "/" || location.pathname === "/dashboard";
  };

  // Determine which module should show submenu based on current path
  const getCurrentModule = () => {
    const path = location.pathname;
    if (path.startsWith("/hiring")) return "hiring";
    if (path.startsWith("/staff")) return "staff";
    if (path.startsWith("/time-leave")) return "time-leave";
    if (path.startsWith("/performance")) return "performance";
    if (path.startsWith("/payroll")) return "payroll";
    if (path.startsWith("/reports")) return "reports";
    return null;
  };

  // Set active dropdown based on current path
  React.useEffect(() => {
    const currentModule = getCurrentModule();
    if (currentModule && !isMainDashboard()) {
      setActiveDropdown(currentModule);
    } else {
      setActiveDropdown(null);
    }
  }, [location.pathname]);

  return (
    <div className="sticky top-0 z-50">
      <nav className="bg-gray-900 border-b border-gray-800 h-14 flex items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="flex items-center gap-2 hover:bg-gray-800 text-white p-2"
            onClick={() => navigate("/")}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
              <Building className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">Payroll</span>
          </Button>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="flex items-center gap-6 w-full max-w-6xl">
            {navigationItems.map((item) => {
              const isActive =
                isActiveModule(item.id) || activeDropdown === item.id;

              // Define exact colors to match the image
              const getModuleColors = (moduleId: string) => {
                switch (moduleId) {
                  case "hiring":
                    return { border: "#4ade80", bg: "#22c55e" }; // Green
                  case "staff":
                    return { border: "#8b5cf6", bg: "#7c3aed" }; // Purple
                  case "time-leave":
                    return { border: "#3b82f6", bg: "#2563eb" }; // Blue
                  case "performance":
                    return { border: "#f97316", bg: "#ea580c" }; // Orange
                  case "payroll":
                    return { border: "#10b981", bg: "#059669" }; // Emerald
                  case "reports":
                    return { border: "#ec4899", bg: "#db2777" }; // Pink
                  default:
                    return { border: "#6b7280", bg: "#4b5563" };
                }
              };

              const colors = getModuleColors(item.id);

              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`flex items-center gap-2 px-4 py-2 h-10 border rounded-md transition-all ${
                    isActive
                      ? "text-white"
                      : "text-gray-300 hover:text-white border-gray-600 hover:border-gray-500"
                  }`}
                  style={{
                    borderColor: isActive ? colors.border : "#6b7280",
                    backgroundColor: isActive
                      ? "rgba(55, 65, 81, 0.5)"
                      : "transparent",
                  }}
                  onClick={() => handleDropdownClick(item.id)}
                >
                  <span className={item.color}>{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${activeDropdown === item.id ? "rotate-180" : ""}`}
                  />
                </Button>
              );
            })}
          </div>
        </div>

        {/* Right Side - Tenant Switcher & User Menu */}
        <div className="flex items-center gap-3">
          {/* Login Section */}
          {!authStatus.isSignedIn && (
            <div className="flex items-center gap-2">
              {!showLogin ? (
                <>
                  <Button
                    onClick={() => setShowLogin(true)}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-gray-700"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={handleAnonymousLogin}
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    {isLoading ? '...' : 'Guest'}
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-32 h-8 bg-gray-700 border-gray-600 text-white"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-32 h-8 bg-gray-700 border-gray-600 text-white"
                  />
                  <Button
                    onClick={handleLogin}
                    disabled={!email || !password || isLoading}
                    size="sm"
                  >
                    {isLoading ? '...' : 'Go'}
                  </Button>
                  <Button
                    onClick={() => setShowLogin(false)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400"
                  >
                    ✕
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Tenant Switcher */}
          <TenantSwitcher className="w-64" />
          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="p-0 h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    JD
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 bg-gray-900 border-gray-700"
              align="end"
              sideOffset={5}
            >
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer"
                onClick={() => handleNavigation("/setup/company")}
              >
                <Building2 className="h-4 w-4 text-blue-400" />
                <span>Company Details</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer"
                onClick={() => handleNavigation("/setup/departments")}
              >
                <Building className="h-4 w-4 text-blue-400" />
                <span>Departments</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer"
                onClick={() => handleNavigation("/setup/payments")}
              >
                <DollarSign className="h-4 w-4 text-blue-400" />
                <span>Payment Structure</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer"
                onClick={() => handleNavigation("/setup/users")}
              >
                <UserCog className="h-4 w-4 text-blue-400" />
                <span>User Management</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer">
                <Users className="h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer"
                onClick={() => navigate("/settings")}
              >
                <Settings className="h-4 w-4" />
                <span>Account Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer">
                <Activity className="h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={() => navigate("/settings")}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      {/* Sub-menu area below main navigation */}
      {activeDropdown && !isMainDashboard() && (
        <div className="sticky top-16 z-40 bg-gray-800 border-b border-gray-700 py-2">
          <div className="px-8">
            <div className="flex items-center justify-center gap-4 max-w-6xl mx-auto">
              {navigationItems
                .find((item) => item.id === activeDropdown)
                ?.items.map((subItem, index) => {
                  const moduleColor = navigationItems.find(
                    (item) => item.id === activeDropdown,
                  )?.color;
                  const isActiveSubItem = location.pathname === subItem.path;

                  // Get the proper module color for highlighting
                  const getHighlightColor = (moduleId: string) => {
                    switch (moduleId) {
                      case "hiring":
                        return "#22c55e";
                      case "staff":
                        return "#7c3aed";
                      case "time-leave":
                        return "#2563eb";
                      case "performance":
                        return "#ea580c";
                      case "payroll":
                        return "#059669";
                      case "reports":
                        return "#db2777";
                      default:
                        return "#4b5563";
                    }
                  };

                  return (
                    <Button
                      key={index}
                      variant="ghost"
                      className={`flex items-center gap-3 px-3 py-2 h-8 rounded-md transition-all border ${
                        isActiveSubItem
                          ? "text-white border-transparent"
                          : "text-gray-300 hover:text-white hover:bg-gray-700 border-gray-600"
                      }`}
                      style={{
                        backgroundColor: isActiveSubItem
                          ? getHighlightColor(activeDropdown)
                          : "transparent",
                      }}
                      onClick={() => handleNavigation(subItem.path)}
                    >
                      <span className={`${moduleColor} text-sm`}>
                        {subItem.icon}
                      </span>
                      <span className="text-xs font-medium whitespace-nowrap">
                        {subItem.label}
                      </span>
                    </Button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
