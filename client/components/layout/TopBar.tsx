/**
 * TopBar — Slim top bar for the sidebar layout.
 * Contains: sidebar toggle, locale switcher, theme toggle, user menu, banners.
 */

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLayout } from "@/contexts/LayoutContext";
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
  Settings,
  LogOut,
  Sun,
  Moon,
  Shield,
  Map,
  Menu,
  WifiOff,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Bot,
  Bell,
  ChevronRight,
  AlertCircle,
  CalendarDays,
  Building2,
  ChevronsUpDown,
  Check,
  CreditCard,
  X,
} from "lucide-react";
import { PlanBadge } from "@/components/layout/MainNavigation";
import { useIsSubscribed } from "@/hooks/useBilling";
import { useChatStore } from "@/stores/chatStore";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { usePayrollRuns } from "@/hooks/usePayroll";
import { useTaxFilingsDueSoon } from "@/hooks/useTaxFiling";
import { useActiveEmployeeSummary } from "@/hooks/useEmployees";
import { useToast } from "@/hooks/use-toast";

// --- Helpers ---

function getUserInitials(user: { displayName?: string | null; email?: string | null }): string {
  return (
    user.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || user.email?.[0].toUpperCase() || "U"
  );
}

interface NotificationCounts {
  pendingLeave: number;
  blockingIssues: number;
  overdueTaxes: number;
  pendingPayroll: number;
  total: number;
}

function useNotificationCounts(hasPayroll: boolean, hasTimeleave: boolean, hasStaff: boolean): NotificationCounts {
  // Defer notification queries until after first meaningful paint
  const [notificationsReady, setNotificationsReady] = useState(false);

  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setNotificationsReady(true), { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(() => setNotificationsReady(true), 2000);
    return () => clearTimeout(id);
  }, []);

  const { data: leaveStats } = useLeaveStats(hasTimeleave && notificationsReady);
  const { data: filingsDue = [] } = useTaxFilingsDueSoon(2, hasPayroll && notificationsReady);
  const { data: employeeSummary } = useActiveEmployeeSummary(hasStaff && notificationsReady);
  const { data: processingRuns = [] } = usePayrollRuns({ status: "processing", limit: 10 }, hasPayroll && notificationsReady);

  const pendingLeave = hasTimeleave ? leaveStats?.pendingRequests ?? 0 : 0;
  const blockingIssues = hasStaff ? employeeSummary?.employeesWithIssues ?? 0 : 0;
  const overdueTaxes = filingsDue.filter((f) => f.isOverdue).length;
  const pendingPayroll = hasPayroll ? processingRuns.length : 0;
  const total = (overdueTaxes > 0 ? 1 : 0) + (blockingIssues > 0 ? 1 : 0) + (pendingLeave > 0 ? 1 : 0) + (pendingPayroll > 0 ? 1 : 0);

  return { pendingLeave, blockingIssues, overdueTaxes, pendingPayroll, total };
}

// --- Sub-components ---

interface NotificationsDropdownProps {
  counts: NotificationCounts;
  onNavigate: (path: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function NotificationsDropdown({ counts, onNavigate, t }: NotificationsDropdownProps) {
  const { pendingLeave, blockingIssues, overdueTaxes, pendingPayroll, total } = counts;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground" aria-label={t("common.notifications")}>
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span aria-hidden className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">{t("common.notifications") || "Notifications"}</p>
        </div>
        <DropdownMenuSeparator />
        {total === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            {t("dashboard.allGood") || "All good — nothing needs attention"}
          </div>
        ) : (
          <>
            {pendingPayroll > 0 && (
              <DropdownMenuItem onClick={() => onNavigate("/payroll/history")} className="gap-3 py-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.pendingPayrollTitle") || "Payroll awaiting approval"}</p>
                  <p className="text-xs text-muted-foreground">{pendingPayroll} {t("dashboard.pendingPayrollDesc") || "run(s) need review"}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </DropdownMenuItem>
            )}
            {overdueTaxes > 0 && (
              <DropdownMenuItem onClick={() => onNavigate("/payroll/tax")} className="gap-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.taxOverdue") || "Tax filings overdue"}</p>
                  <p className="text-xs text-muted-foreground">{overdueTaxes} {t("dashboard.overdueFilings") || "filing(s) past deadline"}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </DropdownMenuItem>
            )}
            {blockingIssues > 0 && (
              <DropdownMenuItem onClick={() => onNavigate("/people/employees?filter=blocking-issues")} className="gap-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.attentionRequired") || "Attention required"}</p>
                  <p className="text-xs text-muted-foreground">{blockingIssues} {t("dashboard.attentionRequiredDesc") || "employees need documents"}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </DropdownMenuItem>
            )}
            {pendingLeave > 0 && (
              <DropdownMenuItem onClick={() => onNavigate("/time-leave/leave")} className="gap-3 py-2.5">
                <CalendarDays className="h-4 w-4 text-cyan-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("dashboard.pendingRequests") || "Pending leave"}</p>
                  <p className="text-xs text-muted-foreground">{pendingLeave} {t("dashboard.reviewLeaveRequests", { count: pendingLeave })}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TopBarUserMenuProps {
  user: { displayName?: string | null; email?: string | null } | null;
  userInitials: string;
  isSuperAdmin: boolean;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  t: (key: string) => string;
  canManageTenant: boolean;
  subscribed: boolean | undefined;
  isDark: boolean;
  onToggleTheme: () => void;
  onAskAI: () => void;
}

function TopBarUserMenu({
  user,
  userInitials,
  isSuperAdmin,
  onNavigate,
  onSignOut,
  t,
  canManageTenant,
  subscribed,
  isDark,
  onToggleTheme,
  onAskAI,
}: TopBarUserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full p-0" aria-label={t("common.accountMenu")}>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
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
            <DropdownMenuItem onClick={() => onNavigate("/admin")} className="text-amber-600">
              <Shield className="h-4 w-4 mr-2" />
              {t("common.adminConsole")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <div
          className="px-2 py-2 sm:hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
            {t("common.language")}
          </p>
          <LocaleSwitcher variant="buttons" />
        </div>
        <DropdownMenuSeparator className="sm:hidden" />
        <DropdownMenuItem onClick={onAskAI} className="sm:hidden">
          <Bot className="h-4 w-4 mr-2" />
          {t("common.askAI")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleTheme}>
          {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
          {isDark ? t("common.switchToLight") : t("common.switchToDark")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canManageTenant && (
          <DropdownMenuItem onClick={() => onNavigate("/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            {t("common.settings")}
          </DropdownMenuItem>
        )}
        {canManageTenant && (
          <DropdownMenuItem onClick={() => onNavigate("/billing")}>
            <CreditCard className="h-4 w-4 mr-2" />
            {t("nav.billingPlan")}
            <PlanBadge subscribed={subscribed} t={t} />
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onNavigate("/sitemap")}>
          <Map className="h-4 w-4 mr-2" />
          {t("common.sitemap")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-red-500">
          <LogOut className="h-4 w-4 mr-2" />
          {t("common.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ConnectionBannerProps {
  isOnline: boolean;
  retryConnection: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function ConnectionBanner({ isOnline, retryConnection, t }: ConnectionBannerProps) {
  return (
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
        onClick={() => { void retryConnection(); }}
        disabled={!isOnline}
        className="self-start sm:self-auto"
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        {t("common.retry")}
      </Button>
    </div>
  );
}

interface SetupBannerProps {
  setupPercent: number;
  onNavigate: (path: string) => void;
  onHide: () => void;
  compact: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function SetupBanner({ setupPercent, onNavigate, onHide, compact, t }: SetupBannerProps) {
  if (compact) {
    return (
      <div className="flex min-h-12 flex-1 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-1.5 dark:border-sky-900/40 dark:bg-sky-950/20">
        <AlertTriangle className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
        <button
          type="button"
          onClick={() => onNavigate("/setup")}
          className="min-h-11 min-w-0 flex-1 text-left text-sm font-medium text-foreground"
        >
          <span className="block truncate">{t("dashboard.finishSetup")}</span>
          <span className="block text-xs font-normal text-muted-foreground">{setupPercent}%</span>
        </button>
        <Button variant="ghost" size="icon" onClick={onHide} aria-label={t("common.hide")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-900/40 dark:bg-sky-950/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-sky-500 p-2 text-white">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t("nav.setupBannerTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("nav.setupBannerDesc", { percent: setupPercent })}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 self-start sm:self-auto">
        <Button
          size="sm"
          onClick={() => onNavigate("/setup")}
          className="bg-sky-700 text-white hover:bg-sky-800"
        >
          {setupPercent > 0 ? t("dashboard.resumeSetup") : t("dashboard.startSetup")}
        </Button>
        <Button variant="ghost" size="icon" onClick={onHide} aria-label={t("common.hide")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --- Business selector ---

interface BusinessSelectorProps {
  currentName: string;
  availableTenants: Array<{ id: string; name: string }>;
  onSwitch: (tid: string) => void;
  currentTenantId: string;
}

function BusinessSelector({ currentName, availableTenants, onSwitch, currentTenantId }: BusinessSelectorProps) {
  const hasMultiple = availableTenants.length > 1;

  if (!hasMultiple) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold truncate">{currentName}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-3 min-w-0 max-w-[240px]">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold truncate">{currentName}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {availableTenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => onSwitch(tenant.id)}
            className="gap-2"
          >
            <Check className={`h-4 w-4 shrink-0 ${tenant.id === currentTenantId ? "opacity-100" : "opacity-0"}`} />
            <span className="truncate">{tenant.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Main component ---

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { isOnline, isConnected, retryConnection } = useFirebase();
  const { hasModule, canManage, availableTenants, switchTenant, session } = useTenant();
  const tenantId = useTenantId();
  const { isDark, toggleTheme } = useTheme();
  const { toggleSidebar, sidebarOpen } = useLayout();
  const { setOpen: setChatOpen } = useChatStore();
  const { t } = useI18n();
  const { toast } = useToast();
  const [setupBannerHidden, setSetupBannerHidden] = useState(false);
  const canManageTenant = canManage();
  // Billing visibility: admins always see where they stand (free vs subscribed)
  const subscribed = useIsSubscribed(canManageTenant);

  const notifCounts = useNotificationCounts(
    hasModule("payroll") && canManageTenant,
    hasModule("timeleave"),
    hasModule("staff"),
  );

  const { data: setupProgress } = useQuery({
    queryKey: ["tenants", tenantId, "setupProgress", "nav"],
    queryFn: () => settingsService.getSetupProgress(tenantId).catch(() => null),
    enabled: Boolean(user && tenantId && !isSuperAdmin && canManageTenant),
    staleTime: 5 * 60 * 1000,
  });

  const handleNavigate = (path: string) => navigate(path);

  useEffect(() => {
    setSetupBannerHidden(
      sessionStorage.getItem(`xefe-setup-banner-hidden:${tenantId}`) === "true",
    );
  }, [tenantId]);

  const hideSetupBanner = () => {
    sessionStorage.setItem(`xefe-setup-banner-hidden:${tenantId}`, "true");
    setSetupBannerHidden(true);
  };

  const handleTenantSwitch = async (tid: string) => {
    try {
      await switchTenant(tid);
    } catch (error) {
      console.error("Failed to switch organization:", error);
      toast({
        title: t("common.connectionIssueTitle"),
        description: t("common.connectionIssueDesc"),
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
      toast({
        title: t("common.error"),
        description: t("auth.errors.signOutFailed"),
        variant: "destructive",
      });
    }
  };

  const userInitials = user ? getUserInitials(user) : "U";
  const hasConnectionIssue = !isOnline || !isConnected;
  const setupProgressIsAlreadyVisible =
    location.pathname === "/setup" || location.pathname.startsWith("/settings");
  const setupIncomplete =
    canManageTenant &&
    setupProgress?.isComplete === false &&
    !setupBannerHidden &&
    !setupProgressIsAlreadyVisible;
  const setupPercent = setupProgress?.percentComplete ?? 0;
  const isDashboard = location.pathname === "/" || location.pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="px-4 sm:px-6">
        <div className="flex h-14 items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="shrink-0 text-muted-foreground hover:text-foreground md:hidden"
            aria-label={t("common.openMenu")}
            aria-expanded={sidebarOpen}
            aria-controls="app-mobile-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <BusinessSelector
              currentName={session?.config?.name || ""}
              availableTenants={availableTenants}
              onSwitch={(tid) => { void handleTenantSwitch(tid); }}
              currentTenantId={tenantId}
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <LocaleSwitcher className="hidden sm:flex" />
            <NotificationsDropdown counts={notifCounts} onNavigate={handleNavigate} t={t} />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChatOpen(true)}
              className="hidden h-9 w-9 text-muted-foreground hover:text-foreground sm:inline-flex"
              aria-label={t("common.askAI")}
              title={t("common.askAI")}
            >
              <Bot className="h-4 w-4" />
            </Button>

            <TopBarUserMenu
              user={user}
              userInitials={userInitials}
              isSuperAdmin={isSuperAdmin}
              onNavigate={handleNavigate}
              onSignOut={handleSignOut}
              t={t}
              canManageTenant={canManageTenant}
              subscribed={subscribed}
              isDark={isDark}
              onToggleTheme={toggleTheme}
              onAskAI={() => setChatOpen(true)}
            />
          </div>
        </div>
      </div>

      {(hasConnectionIssue || setupIncomplete) && (
        <div className="px-4 sm:px-6 border-t border-border/50 py-3">
          <div className="flex flex-col gap-2 lg:flex-row">
            {hasConnectionIssue && (
              <ConnectionBanner isOnline={isOnline} retryConnection={retryConnection} t={t} />
            )}
            {setupIncomplete && (
              <SetupBanner
                setupPercent={setupPercent}
                onNavigate={handleNavigate}
                onHide={hideSetupBanner}
                compact={!isDashboard}
                t={t}
              />
            )}
          </div>
        </div>
      )}
    </header>
  );
}
