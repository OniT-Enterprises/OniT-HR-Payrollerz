/**
 * MainNavigation - 6 main tabs with hover dropdown submenus
 * Desktop: hover a tab to see grouped sub-page links
 * Mobile: flat list (no dropdowns)
 */

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGuidance } from "@/contexts/GuidanceContext";
import { useI18n } from "@/i18n/I18nProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Users,
  Calculator,
  Landmark,
  Settings,
  LogOut,
  Sun,
  Moon,
  Languages,
  Shield,
  BarChart3,
  Menu,
  X,
  Wallet,
  Map,
  BookOpen,
  Check,
  FolderKanban,
  FileSpreadsheet,
  UserPlus,
  Clock,
  Calendar,
  CalendarDays,
  Building,
  Building2,
  Globe,
  Briefcase,
  UserCheck,
  MessageSquare,
  ClipboardList,
  Target,
  Award,
  GraduationCap,
  Play,
  DollarSign,
  FileText,
  Banknote,
  Receipt,
  Plus,
  Scale,
  Eye,
} from "lucide-react";
import { useState } from "react";
import { type SectionId, navColors, navActiveIndicator } from "@/lib/sectionTheme";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";

// Submenu group definition
interface NavSubGroup {
  title: string;
  links: Array<{ label: string; path: string; icon: typeof LayoutDashboard }>;
}

// 6-tab navigation with optional dropdown submenus
const NAV_ITEMS: Array<{
  id: SectionId;
  label: string;
  labelKey: string;
  path: string;
  icon: typeof LayoutDashboard;
  subtitle?: string;
  subtitleKey?: string;
  subGroups?: NavSubGroup[];
}> = [
  {
    id: "dashboard",
    label: "Dashboard",
    labelKey: "common.dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    id: "people",
    label: "People",
    labelKey: "nav.people",
    path: "/people",
    icon: Users,
    subGroups: [
      {
        title: "Staff",
        links: [
          { label: "Employees", path: "/people/employees", icon: Users },
          { label: "Add Employee", path: "/people/add", icon: UserPlus },
        ],
      },
      {
        title: "Scheduling & Attendance",
        links: [
          { label: "Time Tracking", path: "/people/time-tracking", icon: Clock },
          { label: "Attendance", path: "/people/attendance", icon: Calendar },
          { label: "Leave Requests", path: "/people/leave", icon: CalendarDays },
          { label: "Shift Schedules", path: "/people/schedules", icon: UserCheck },
        ],
      },
      {
        title: "Organization",
        links: [
          { label: "Departments", path: "/people/departments", icon: Building },
          { label: "Org Chart", path: "/people/org-chart", icon: Building2 },
          { label: "Foreign Workers", path: "/admin/foreign-workers", icon: Globe },
        ],
      },
      {
        title: "Hiring",
        links: [
          { label: "Job Postings", path: "/people/jobs", icon: Briefcase },
          { label: "Candidates", path: "/people/candidates", icon: ClipboardList },
          { label: "Interviews", path: "/people/interviews", icon: MessageSquare },
          { label: "Onboarding", path: "/people/onboarding", icon: UserPlus },
        ],
      },
      {
        title: "Performance",
        links: [
          { label: "Goals", path: "/people/goals", icon: Target },
          { label: "Reviews", path: "/people/reviews", icon: Award },
          { label: "Training", path: "/people/training", icon: GraduationCap },
        ],
      },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    labelKey: "nav.payroll",
    path: "/payroll",
    icon: Calculator,
    subGroups: [
      {
        title: "Run",
        links: [
          { label: "Run Payroll", path: "/payroll/run", icon: Play },
        ],
      },
      {
        title: "Setup & History",
        links: [
          { label: "Benefits", path: "/payroll/benefits", icon: DollarSign },
          { label: "Deductions", path: "/payroll/deductions", icon: Receipt },
          { label: "Payroll History", path: "/payroll/history", icon: FileText },
          { label: "Bank Transfers", path: "/payroll/transfers", icon: Banknote },
          { label: "Tax Reports", path: "/payroll/taxes", icon: FileSpreadsheet },
        ],
      },
    ],
  },
  {
    id: "money",
    label: "Money",
    labelKey: "nav.money",
    path: "/money",
    icon: Wallet,
    subtitle: "Daily",
    subtitleKey: "nav.moneySubtitle",
    subGroups: [
      {
        title: "Money In",
        links: [
          { label: "Invoices", path: "/money/invoices", icon: FileText },
          { label: "New Invoice", path: "/money/invoices/new", icon: Plus },
          { label: "Customers", path: "/money/customers", icon: Users },
        ],
      },
      {
        title: "Money Out",
        links: [
          { label: "Bills", path: "/money/bills", icon: Receipt },
          { label: "Expenses", path: "/money/expenses", icon: DollarSign },
          { label: "Vendors", path: "/money/vendors", icon: Building2 },
        ],
      },
      {
        title: "Reports",
        links: [
          { label: "Profit & Loss", path: "/money/profit-loss", icon: BarChart3 },
          { label: "VAT Settings", path: "/money/vat-settings", icon: Settings },
          { label: "VAT Returns", path: "/money/vat-returns", icon: FileSpreadsheet },
        ],
      },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    labelKey: "nav.accounting",
    path: "/accounting",
    icon: Landmark,
    subtitle: "Formal",
    subtitleKey: "nav.accountingSubtitle",
    subGroups: [
      {
        title: "Core",
        links: [
          { label: "Chart of Accounts", path: "/accounting/chart-of-accounts", icon: BookOpen },
          { label: "Journal Entries", path: "/accounting/journal-entries", icon: FileText },
          { label: "General Ledger", path: "/accounting/general-ledger", icon: ClipboardList },
        ],
      },
      {
        title: "Reports",
        links: [
          { label: "Trial Balance", path: "/accounting/trial-balance", icon: Scale },
          { label: "Income Statement", path: "/accounting/income-statement", icon: BarChart3 },
          { label: "Balance Sheet", path: "/accounting/balance-sheet", icon: FileSpreadsheet },
          { label: "Fiscal Periods", path: "/accounting/fiscal-periods", icon: Calendar },
          { label: "Audit Trail", path: "/accounting/audit-trail", icon: Eye },
        ],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    labelKey: "nav.reports",
    path: "/reports",
    icon: BarChart3,
    subGroups: [
      {
        title: "Standard",
        links: [
          { label: "Payroll", path: "/reports/payroll", icon: DollarSign },
          { label: "Employees", path: "/reports/employees", icon: Users },
          { label: "Attendance", path: "/reports/attendance", icon: Calendar },
          { label: "Departments", path: "/reports/departments", icon: Building },
        ],
      },
      {
        title: "Compliance",
        links: [
          { label: "Monthly WIT", path: "/reports/attl-monthly-wit", icon: FileText },
          { label: "Monthly INSS", path: "/reports/inss-monthly", icon: Shield },
          { label: "Custom Reports", path: "/reports/custom", icon: FileSpreadsheet },
        ],
      },
    ],
  },
];

export default function MainNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { session, hasModule, canManage } = useTenant();
  const { isDark, toggleTheme } = useTheme();
  const { guidanceEnabled, toggleGuidance } = useGuidance();
  const { t, locale, setLocale, localeLabels } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const localeOptions = Object.entries(localeLabels) as Array<[typeof locale, string]>;
  const ngoReportingEnabled = canUseNgoReporting(session, hasModule("reports"));
  const donorExportEnabled = canUseDonorExport(
    session,
    hasModule("reports"),
    canManage()
  );
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.id === "dashboard") {
      return true;
    }

    if (item.id === "people") {
      return (["staff", "hiring", "timeleave", "performance"] as const).some((module) =>
        hasModule(module)
      );
    }

    if (item.id === "payroll") {
      return hasModule("payroll");
    }

    if (item.id === "money") {
      return hasModule("money");
    }

    if (item.id === "accounting") {
      return hasModule("accounting");
    }

    if (item.id === "reports") {
      return hasModule("reports");
    }

    return true;
  });

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/login");
  };

  const userInitials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || user?.email?.[0].toUpperCase() || "U";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => handleNavigate("/")}
              className="flex items-center"
            >
              <img
                src={isDark ? "/images/illustrations/logo-v2-dark.webp" : "/images/illustrations/logo-v2-light.webp"}
                alt="Meza"
                className="h-8 w-auto"
              />
            </button>

            {/* Desktop Navigation - Tabs with dropdown submenus */}
            <div className="hidden md:flex items-center gap-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                const iconColor = navColors[item.id];
                const indicatorColor = navActiveIndicator[item.id];
                const dropdownAlign = ["money", "accounting", "reports"].includes(item.id) ? "right-0" : "left-0";
                const maxCols = Math.min(item.subGroups?.length ?? 0, 3);
                return (
                  <div key={item.id} className="relative group">
                    <Button
                      variant="ghost"
                      onClick={() => handleNavigate(item.path)}
                      className={`
                        relative px-3 h-10 text-sm font-medium transition-all
                        ${active
                          ? "text-foreground bg-accent"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        }
                      `}
                    >
                      <Icon className={`h-4 w-4 mr-2 ${active ? iconColor : ""}`} />
                      <span className="flex items-center gap-1.5">
                        {t(item.labelKey) || item.label}
                        {item.subtitleKey && (
                          <span className="text-[10px] text-muted-foreground font-normal opacity-70">
                            ({t(item.subtitleKey) || item.subtitle})
                          </span>
                        )}
                      </span>
                      {active && (
                        <span className={`absolute bottom-0 left-2 right-2 h-0.5 ${indicatorColor} rounded-full`} />
                      )}
                    </Button>
                    {item.subGroups && item.subGroups.length > 0 && (
                      <div
                        className={`
                          absolute ${dropdownAlign} top-full pt-2 z-50
                          hidden group-hover:block
                        `}
                      >
                        <div className="bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                          <div className={`h-0.5 ${indicatorColor}`} />
                          <div
                            className="p-4 grid gap-x-6 gap-y-4"
                            style={{ gridTemplateColumns: `repeat(${maxCols}, max-content)` }}
                          >
                            {item.subGroups.map((group) => (
                              <div key={group.title}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
                                  {group.title}
                                </p>
                                <div className="space-y-0.5">
                                  {group.links.map((link) => {
                                    const LinkIcon = link.icon;
                                    return (
                                      <button
                                        key={link.path}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleNavigate(link.path);
                                        }}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent text-foreground/80 hover:text-foreground transition-colors text-left whitespace-nowrap"
                                      >
                                        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        {link.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Settings - visible on desktop */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleNavigate("/settings")}
              className="hidden md:flex h-9 w-9 text-muted-foreground hover:text-foreground"
              title={t("common.settings")}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* Language */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  title={t("common.language")}
                >
                  <Languages className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {localeOptions.map(([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setLocale(key)}
                    className={locale === key ? "bg-accent" : ""}
                  >
                    {label}
                    {locale === key && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full p-0"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-violet-500 text-white text-sm font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user && (
                  <>
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{user.displayName || "User"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isSuperAdmin && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleNavigate("/admin/tenants")}
                      className="text-amber-600"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Admin Console
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => handleNavigate("/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t("common.settings")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate("/sitemap")}>
                  <Map className="h-4 w-4 mr-2" />
                  Sitemap
                </DropdownMenuItem>
                {ngoReportingEnabled && (
                  <>
                    <DropdownMenuSeparator />
                    <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                      {t("reports.dashboard.ngo.title")}
                    </p>
                    <DropdownMenuItem onClick={() => handleNavigate("/reports/payroll-allocation")}>
                      <FolderKanban className="h-4 w-4 mr-2" />
                      {t("reports.dashboard.ngo.allocationTitle")}
                    </DropdownMenuItem>
                    {donorExportEnabled && (
                      <DropdownMenuItem onClick={() => handleNavigate("/reports/donor-export")}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        {t("reports.dashboard.ngo.donorExportTitle")}
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuItem onClick={toggleGuidance}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Guidance
                  {guidanceEnabled && <Check className="h-4 w-4 ml-auto text-emerald-500" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-500">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("common.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                const iconColor = navColors[item.id];
                const indicatorColor = navActiveIndicator[item.id];
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    onClick={() => handleNavigate(item.path)}
                    className={`
                      relative justify-start h-12 text-base overflow-hidden
                      ${active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground"
                      }
                    `}
                  >
                    {active && (
                      <span className={`absolute left-0 top-2 bottom-2 w-1 ${indicatorColor} rounded-r-full`} />
                    )}
                    <Icon className={`h-5 w-5 mr-3 ml-2 ${active ? iconColor : ""}`} />
                    {t(item.labelKey) || item.label}
                  </Button>
                );
              })}
              <DropdownMenuSeparator className="my-2" />
              <Button
                variant="ghost"
                onClick={() => handleNavigate("/settings")}
                className="justify-start h-12 text-base text-muted-foreground"
              >
                <Settings className="h-5 w-5 mr-3" />
                {t("common.settings")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleNavigate("/sitemap")}
                className="justify-start h-12 text-base text-muted-foreground"
              >
                <Map className="h-5 w-5 mr-3" />
                Sitemap
              </Button>
              {ngoReportingEnabled && (
                <>
                  <DropdownMenuSeparator className="my-2" />
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t("reports.dashboard.ngo.title")}
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => handleNavigate("/reports/payroll-allocation")}
                    className="justify-start h-12 text-base text-muted-foreground"
                  >
                    <FolderKanban className="h-5 w-5 mr-3" />
                    {t("reports.dashboard.ngo.allocationTitle")}
                  </Button>
                  {donorExportEnabled && (
                    <Button
                      variant="ghost"
                      onClick={() => handleNavigate("/reports/donor-export")}
                      className="justify-start h-12 text-base text-muted-foreground"
                    >
                      <FileSpreadsheet className="h-5 w-5 mr-3" />
                      {t("reports.dashboard.ngo.donorExportTitle")}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
