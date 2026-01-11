import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/i18n/I18nProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
  UserCog,
  Building2,
  DollarSign,
  Shield,
  ChevronDown,
  Target,
  Award,
  Heart,
  CreditCard,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  BookOpen,
  Scale,
  Receipt,
  Landmark,
  ClipboardList,
  UserCheck,
  GraduationCap,
  CalendarDays,
  Banknote,
  FileSpreadsheet,
  LayoutDashboard,
  Languages,
} from "lucide-react";

// Navigation structure: 3 pillars + Dashboard
const NAVIGATION = {
  people: {
    id: "people",
    labelKey: "nav.people",
    icon: Users,
    gradient: "from-blue-500 to-indigo-500",
    hoverBg: "hover:bg-blue-500/10 dark:hover:bg-blue-500/20",
    sections: [
      {
        titleKey: "nav.staff",
        items: [
          { labelKey: "nav.allEmployees", icon: Users, path: "/people/employees" },
          { labelKey: "nav.addEmployee", icon: UserPlus, path: "/people/add" },
          { labelKey: "nav.departments", icon: Building, path: "/people/departments" },
          { labelKey: "nav.orgChart", icon: Building2, path: "/people/org-chart" },
        ],
      },
      {
        titleKey: "nav.hiring",
        items: [
          { labelKey: "nav.jobPostings", icon: Briefcase, path: "/people/jobs" },
          { labelKey: "nav.candidates", icon: UserCheck, path: "/people/candidates" },
          { labelKey: "nav.interviews", icon: Calendar, path: "/people/interviews" },
          { labelKey: "nav.onboarding", icon: UserPlus, path: "/people/onboarding" },
          { labelKey: "nav.offboarding", icon: UserCog, path: "/people/offboarding" },
        ],
      },
      {
        titleKey: "nav.timeLeave",
        items: [
          { labelKey: "nav.timeTracking", icon: Clock, path: "/people/time-tracking" },
          { labelKey: "nav.attendance", icon: CalendarDays, path: "/people/attendance" },
          { labelKey: "nav.leaveRequests", icon: Heart, path: "/people/leave" },
          { labelKey: "nav.shiftSchedules", icon: Calendar, path: "/people/schedules" },
        ],
      },
      {
        titleKey: "nav.performance",
        items: [
          { labelKey: "nav.goalsOkrs", icon: Target, path: "/people/goals" },
          { labelKey: "nav.reviews", icon: Award, path: "/people/reviews" },
          { labelKey: "nav.training", icon: GraduationCap, path: "/people/training" },
          { labelKey: "nav.disciplinary", icon: Shield, path: "/people/disciplinary" },
        ],
      },
    ],
  },
  payroll: {
    id: "payroll",
    labelKey: "nav.payroll",
    icon: Calculator,
    gradient: "from-emerald-500 to-green-500",
    hoverBg: "hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20",
    items: [
      { labelKey: "nav.runPayroll", icon: Calculator, path: "/payroll/run" },
      { labelKey: "nav.payrollHistory", icon: FileText, path: "/payroll/history" },
      { labelKey: "nav.bankTransfers", icon: Banknote, path: "/payroll/transfers" },
      { labelKey: "nav.taxReports", icon: FileSpreadsheet, path: "/payroll/taxes" },
      { labelKey: "nav.benefits", icon: Heart, path: "/payroll/benefits" },
      { labelKey: "nav.deductions", icon: DollarSign, path: "/payroll/deductions" },
    ],
  },
  accounting: {
    id: "accounting",
    labelKey: "nav.accounting",
    icon: Landmark,
    gradient: "from-amber-500 to-orange-500",
    hoverBg: "hover:bg-amber-500/10 dark:hover:bg-amber-500/20",
    items: [
      { labelKey: "nav.chartOfAccounts", icon: BookOpen, path: "/accounting/chart-of-accounts" },
      { labelKey: "nav.journalEntries", icon: Receipt, path: "/accounting/journal-entries" },
      { labelKey: "nav.generalLedger", icon: FileText, path: "/accounting/general-ledger" },
      { labelKey: "nav.trialBalance", icon: Scale, path: "/accounting/trial-balance" },
      { labelKey: "nav.financialReports", icon: BarChart3, path: "/accounting/reports" },
    ],
  },
};

export default function MainNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, locale, setLocale, localeLabels } = useI18n();
  const localeOptions = Object.entries(localeLabels) as Array<[typeof locale, string]>;

  const isActiveRoute = (path: string) => location.pathname === path;
  const isActiveSection = (basePath: string) => location.pathname.startsWith(basePath);

  const handleNavigate = (path: string) => {
    navigate(path);
    setActiveDropdown(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/login");
  };

  const userInitials = user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || user?.email?.[0].toUpperCase() || "U";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Desktop Navigation */}
          <div className="flex items-center gap-1">
            <div className="hidden lg:flex items-center gap-1">
              {/* Dashboard Link */}
                <Button
                  variant="ghost"
                  onClick={() => handleNavigate("/")}
                  className={`
                  px-3 py-2 h-9 text-sm font-medium
                  text-muted-foreground hover:text-foreground
                  transition-all duration-200
                  hover:bg-primary/10
                  ${location.pathname === "/" || location.pathname === "/dashboard" ? "text-foreground bg-accent" : ""}
                `}
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                {t("common.dashboard")}
              </Button>

              {/* People Mega Menu */}
              <DropdownMenu
                open={activeDropdown === "people"}
                onOpenChange={(open) => setActiveDropdown(open ? "people" : null)}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`
                      relative px-3 py-2 h-9 text-sm font-medium
                      text-muted-foreground hover:text-foreground
                      transition-all duration-200
                      ${NAVIGATION.people.hoverBg}
                      ${isActiveSection("/people") ? "text-foreground bg-accent" : ""}
                    `}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {t(NAVIGATION.people.labelKey)}
                    <ChevronDown className={`ml-1 h-3 w-3 transition-transform duration-200 ${activeDropdown === "people" ? "rotate-180" : ""}`} />
                    {isActiveSection("/people") && (
                      <span className={`absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r ${NAVIGATION.people.gradient} rounded-full`} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[500px] p-4 bg-popover/95 backdrop-blur-xl border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20"
                  align="start"
                  sideOffset={8}
                >
                  <div className="grid grid-cols-2 gap-4">
                    {NAVIGATION.people.sections.map((section) => (
                      <div key={section.titleKey}>
                        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                          {t(section.titleKey)}
                        </DropdownMenuLabel>
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <DropdownMenuItem
                              key={item.path}
                              className={`
                                flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer
                                text-muted-foreground hover:text-foreground
                                transition-colors duration-150
                                ${isActiveRoute(item.path) ? `bg-gradient-to-r ${NAVIGATION.people.gradient} text-white` : "hover:bg-accent"}
                              `}
                              onClick={() => handleNavigate(item.path)}
                            >
                              <Icon className={`h-4 w-4 ${isActiveRoute(item.path) ? "text-white" : ""}`} />
                              <span className="font-medium text-sm">{t(item.labelKey)}</span>
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Payroll Dropdown */}
              <DropdownMenu
                open={activeDropdown === "payroll"}
                onOpenChange={(open) => setActiveDropdown(open ? "payroll" : null)}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`
                      relative px-3 py-2 h-9 text-sm font-medium
                      text-muted-foreground hover:text-foreground
                      transition-all duration-200
                      ${NAVIGATION.payroll.hoverBg}
                      ${isActiveSection("/payroll") ? "text-foreground bg-accent" : ""}
                    `}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    {t(NAVIGATION.payroll.labelKey)}
                    <ChevronDown className={`ml-1 h-3 w-3 transition-transform duration-200 ${activeDropdown === "payroll" ? "rotate-180" : ""}`} />
                    {isActiveSection("/payroll") && (
                      <span className={`absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r ${NAVIGATION.payroll.gradient} rounded-full`} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56 p-2 bg-popover/95 backdrop-blur-xl border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20"
                  align="start"
                  sideOffset={8}
                >
                  {NAVIGATION.payroll.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.path}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                          text-muted-foreground hover:text-foreground
                          transition-colors duration-150
                          ${isActiveRoute(item.path) ? `bg-gradient-to-r ${NAVIGATION.payroll.gradient} text-white` : "hover:bg-accent"}
                        `}
                        onClick={() => handleNavigate(item.path)}
                      >
                        <Icon className={`h-4 w-4 ${isActiveRoute(item.path) ? "text-white" : ""}`} />
                        <span className="font-medium">{t(item.labelKey)}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Accounting Dropdown */}
              <DropdownMenu
                open={activeDropdown === "accounting"}
                onOpenChange={(open) => setActiveDropdown(open ? "accounting" : null)}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`
                      relative px-3 py-2 h-9 text-sm font-medium
                      text-muted-foreground hover:text-foreground
                      transition-all duration-200
                      ${NAVIGATION.accounting.hoverBg}
                      ${isActiveSection("/accounting") ? "text-foreground bg-accent" : ""}
                    `}
                  >
                    <Landmark className="h-4 w-4 mr-2" />
                    {t(NAVIGATION.accounting.labelKey)}
                    <ChevronDown className={`ml-1 h-3 w-3 transition-transform duration-200 ${activeDropdown === "accounting" ? "rotate-180" : ""}`} />
                    {isActiveSection("/accounting") && (
                      <span className={`absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r ${NAVIGATION.accounting.gradient} rounded-full`} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56 p-2 bg-popover/95 backdrop-blur-xl border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20"
                  align="start"
                  sideOffset={8}
                >
                  {NAVIGATION.accounting.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.path}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                          text-muted-foreground hover:text-foreground
                          transition-colors duration-150
                          ${isActiveRoute(item.path) ? `bg-gradient-to-r ${NAVIGATION.accounting.gradient} text-white` : "hover:bg-accent"}
                        `}
                        onClick={() => handleNavigate(item.path)}
                      >
                        <Icon className={`h-4 w-4 ${isActiveRoute(item.path) ? "text-white" : ""}`} />
                        <span className="font-medium">{t(item.labelKey)}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title={t("common.language")}
                >
                  <Languages className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-44 p-1 bg-popover/95 backdrop-blur-xl border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20"
                align="end"
                sideOffset={8}
              >
                {localeOptions.map(([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ${
                      locale === key ? "text-foreground bg-accent" : ""
                    }`}
                    onClick={() => setLocale(key)}
                  >
                    <span className="font-medium text-sm">{label}</span>
                    {locale === key && <span className="text-xs">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {isDark ? (
                <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12" />
              )}
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-lg p-0 hover:bg-accent group"
                  title={user?.displayName || user?.email || t("common.userMenu")}
                >
                  <Avatar className="h-8 w-8 transition-transform duration-200 group-hover:scale-105">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-violet-500 text-primary-foreground text-sm font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 p-2 bg-popover/95 backdrop-blur-xl border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20"
                align="end"
                sideOffset={8}
              >
                {user && (
                  <>
                    <div className="px-3 py-3 mb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-violet-500 text-primary-foreground font-semibold">
                            {userInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {user.displayName || t("common.user")}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        <Sparkles className="h-4 w-4 text-amber-500" />
                      </div>
                    </div>
                    <DropdownMenuSeparator className="bg-border/50 my-2" />
                  </>
                )}
                <DropdownMenuItem
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  onClick={() => handleNavigate("/settings")}
                >
                  <Settings className="h-4 w-4" />
                  <span className="font-medium">{t("common.settings")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50 my-2" />
                <DropdownMenuItem
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="font-medium">{t("common.signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
