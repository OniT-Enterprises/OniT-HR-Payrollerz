/**
 * TopBar — Slim top bar for the sidebar layout.
 * Contains: sidebar toggle, locale switcher, theme toggle, user menu, banners.
 */

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  Bot,
  Bell,
  ChevronRight,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useLeaveStats } from "@/hooks/useLeaveRequests";
import { useTaxFilingsDueSoon } from "@/hooks/useTaxFiling";
import { useEmployeeDirectory } from "@/hooks/useEmployees";
import { getComplianceIssues } from "@/lib/employeeUtils";

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
  total: number;
}

function useNotificationCounts(hasPayroll: boolean, hasTimeleave: boolean, hasStaff: boolean): NotificationCounts {
  // Defer notification queries until after first meaningful paint
  const [notificationsReady, setNotificationsReady] = useState(false);

  useEffect(() => {
    const id = typeof requestIdleCallback === "function"
      ? requestIdleCallback(() => setNotificationsReady(true), { timeout: 3000 })
      : (setTimeout(() => setNotificationsReady(true), 2000) as unknown as number);
    return () => {
      if (typeof cancelIdleCallback === "function") {
        cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, []);

  const { data: leaveStats } = useLeaveStats(hasTimeleave && notificationsReady);
  const { data: filingsDue = [] } = useTaxFilingsDueSoon(2, hasPayroll && notificationsReady);
  const { data: employees = [] } = useEmployeeDirectory({ status: "active" }, hasStaff && notificationsReady);

  const pendingLeave = hasTimeleave ? leaveStats?.pendingRequests ?? 0 : 0;
  const blockingIssues = hasStaff ? getComplianceIssues(employees).length : 0;
  const overdueTaxes = filingsDue.filter((f) => f.isOverdue).length;
  const total = (overdueTaxes > 0 ? 1 : 0) + (blockingIssues > 0 ? 1 : 0) + (pendingLeave > 0 ? 1 : 0);

  return { pendingLeave, blockingIssues, overdueTaxes, total };
}

// --- Sub-components ---

interface NotificationsDropdownProps {
  counts: NotificationCounts;
  onNavigate: (path: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function NotificationsDropdown({ counts, onNavigate, t }: NotificationsDropdownProps) {
  const { pendingLeave, blockingIssues, overdueTaxes, total } = counts;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground relative">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
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
}

function TopBarUserMenu({ user, userInitials, isSuperAdmin, onNavigate, onSignOut, t }: TopBarUserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
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
            <DropdownMenuItem onClick={() => onNavigate("/admin/tenants")} className="text-amber-600">
              <Shield className="h-4 w-4 mr-2" />
              {t("common.adminConsole")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => onNavigate("/settings")}>
          <Settings className="h-4 w-4 mr-2" />
          {t("common.settings")}
        </DropdownMenuItem>
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
  t: (key: string, params?: Record<string, string | number>) => string;
}

function SetupBanner({ setupPercent, onNavigate, t }: SetupBannerProps) {
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
      <Button
        size="sm"
        onClick={() => onNavigate("/setup")}
        className="self-start bg-sky-600 text-white hover:bg-sky-700 sm:self-auto"
      >
        {t("dashboard.resumeSetup")}
      </Button>
    </div>
  );
}

// --- Main component ---

export default function TopBar() {
  const navigate = useNavigate();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { isOnline, isConnected, retryConnection } = useFirebase();
  const { hasModule, canManage } = useTenant();
  const tenantId = useTenantId();
  const { isDark, toggleTheme } = useTheme();
  const { toggleSidebar } = useLayout();
  const { setOpen: setChatOpen } = useChatStore();
  const { t } = useI18n();
  const canManageTenant = canManage();

  const notifCounts = useNotificationCounts(hasModule("payroll"), hasModule("timeleave"), hasModule("staff"));

  const { data: setupProgress } = useQuery({
    queryKey: ["tenants", tenantId, "setupProgress", "nav"],
    queryFn: () => settingsService.getSetupProgress(tenantId).catch(() => null),
    enabled: Boolean(user && tenantId && !isSuperAdmin && canManageTenant),
    staleTime: 5 * 60 * 1000,
  });

  const handleNavigate = (path: string) => navigate(path);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/login");
  };

  const userInitials = user ? getUserInitials(user) : "U";
  const hasConnectionIssue = !isOnline || !isConnected;
  const setupIncomplete = canManageTenant && setupProgress?.isComplete === false;
  const setupPercent = setupProgress?.percentComplete ?? 0;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="px-4 sm:px-6">
        <div className="flex h-14 items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <LocaleSwitcher className="hidden sm:flex" />
            <NotificationsDropdown counts={notifCounts} onNavigate={handleNavigate} t={t} />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChatOpen(true)}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title="Meza Assistant"
            >
              <Bot className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <TopBarUserMenu
              user={user}
              userInitials={userInitials}
              isSuperAdmin={isSuperAdmin}
              onNavigate={handleNavigate}
              onSignOut={handleSignOut}
              t={t}
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
              <SetupBanner setupPercent={setupPercent} onNavigate={handleNavigate} t={t} />
            )}
          </div>
        </div>
      )}
    </header>
  );
}
