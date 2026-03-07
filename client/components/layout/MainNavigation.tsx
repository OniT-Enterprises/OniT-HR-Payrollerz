/**
 * MainNavigation - 7 main tabs, click-to-navigate (no hover dropdowns).
 * Sub-navigation is handled by ModuleSectionNav on each page.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGuidance } from "@/contexts/GuidanceContext";
import { useI18n } from "@/i18n/I18nProvider";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { settingsService } from "@/services/settingsService";
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
  Clock,
  WifiOff,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { type SectionId, navColors, navActiveIndicator } from "@/lib/sectionTheme";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";

// 7-tab navigation — no dropdowns, click navigates to module hub
const NAV_ITEMS: Array<{
  id: SectionId;
  label: string;
  labelKey: string;
  path: string;
  icon: typeof LayoutDashboard;
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
  },
  {
    id: "scheduling",
    label: "Time & Leave",
    labelKey: "nav.scheduling",
    path: "/time-leave",
    icon: Clock,
  },
  {
    id: "payroll",
    label: "Payroll",
    labelKey: "nav.payroll",
    path: "/payroll",
    icon: Calculator,
  },
  {
    id: "money",
    label: "Money",
    labelKey: "nav.money",
    path: "/money",
    icon: Wallet,
  },
  {
    id: "accounting",
    label: "Accounting",
    labelKey: "nav.accounting",
    path: "/accounting",
    icon: Landmark,
  },
  {
    id: "reports",
    label: "Reports",
    labelKey: "nav.reports",
    path: "/reports",
    icon: BarChart3,
  },
];

export default function MainNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { isOnline, isConnected, retryConnection } = useFirebase();
  const { session, hasModule, canManage } = useTenant();
  const tenantId = useTenantId();
  const { isDark, toggleTheme } = useTheme();
  const { guidanceEnabled, toggleGuidance } = useGuidance();
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const ngoReportingEnabled = canUseNgoReporting(session, hasModule("reports"));
  const donorExportEnabled = canUseDonorExport(
    session,
    hasModule("reports"),
    canManage()
  );
  const { data: setupProgress } = useQuery({
    queryKey: ["tenants", tenantId, "setupProgress", "nav"],
    queryFn: () => settingsService.getSetupProgress(tenantId).catch(() => null),
    enabled: Boolean(user && tenantId && !isSuperAdmin),
    staleTime: 5 * 60 * 1000,
  });
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.id === "dashboard") {
      return true;
    }

    if (item.id === "people") {
      return (["staff", "hiring", "performance"] as const).some((module) =>
        hasModule(module)
      );
    }

    if (item.id === "scheduling") {
      return hasModule("timeleave");
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

  const isActive = (item: typeof NAV_ITEMS[number]) => {
    if (item.path === "/") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(item.path);
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
  const hasConnectionIssue = !isOnline || !isConnected;
  const setupIncomplete = setupProgress?.isComplete === false;
  const setupPercent = setupProgress?.percentComplete ?? 0;

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

            {/* Desktop Navigation - Simple click-to-navigate tabs */}
            <div className="hidden md:flex items-center gap-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                const iconColor = navColors[item.id];
                const indicatorColor = navActiveIndicator[item.id];
                return (
                  <Button
                    key={item.id}
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
                    {t(item.labelKey) || item.label}
                    {active && (
                      <span className={`absolute bottom-0 left-2 right-2 h-0.5 ${indicatorColor} rounded-full`} />
                    )}
                  </Button>
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
              className="hidden lg:flex h-9 w-9 text-muted-foreground hover:text-foreground"
              title={t("common.settings")}
            >
              <Settings className="h-4 w-4" />
            </Button>

            <LocaleSwitcher className="hidden md:flex" />

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
                      {t("common.adminConsole")}
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
                  {t("common.sitemap")}
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
                  {t("common.guidance")}
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
            <div className="mb-4 rounded-xl border border-border/50 bg-muted/30 p-3">
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("common.language")}
                  </p>
                  <LocaleSwitcher variant="buttons" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
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
                {t("common.sitemap")}
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

        {(hasConnectionIssue || setupIncomplete) && (
          <div className="border-t border-border/50 py-3">
            <div className="flex flex-col gap-2 lg:flex-row">
              {hasConnectionIssue && (
                <div className="flex flex-1 flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-amber-500 p-2 text-white">
                      <WifiOff className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {t(isOnline ? "common.connectionIssueTitle" : "common.offlineTitle")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t(isOnline ? "common.connectionIssueDesc" : "common.offlineDesc")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void retryConnection();
                    }}
                    disabled={!isOnline}
                    className="self-start sm:self-auto"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t("common.retry")}
                  </Button>
                </div>
              )}

              {setupIncomplete && (
                <div className="flex flex-1 flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-900/40 dark:bg-sky-950/20 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-sky-500 p-2 text-white">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {t("nav.setupBannerTitle")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("nav.setupBannerDesc", { percent: setupPercent })}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleNavigate("/setup")}
                    className="self-start bg-sky-600 text-white hover:bg-sky-700 sm:self-auto"
                  >
                    {t("dashboard.resumeSetup")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
