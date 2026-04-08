/**
 * TopBar — Slim top bar for the sidebar layout.
 * Contains: sidebar toggle, locale switcher, theme toggle, user menu, banners.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useTenant, useTenantId } from "@/contexts/TenantContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGuidance } from "@/contexts/GuidanceContext";
import { useLayout } from "@/contexts/LayoutContext";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  BookOpen,
  Check,
  FolderKanban,
  FileSpreadsheet,
  Menu,
  WifiOff,
  RotateCcw,
  AlertTriangle,
  Bot,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";

export default function TopBar() {
  const navigate = useNavigate();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { isOnline, isConnected, retryConnection } = useFirebase();
  const { session, hasModule, canManage } = useTenant();
  const tenantId = useTenantId();
  const { isDark, toggleTheme } = useTheme();
  const { guidanceEnabled, toggleGuidance } = useGuidance();
  const { toggleSidebar, toggleCollapsed } = useLayout();
  const isMobile = useIsMobile();
  const { setOpen: setChatOpen } = useChatStore();
  const { t } = useI18n();

  const ngoReportingEnabled = canUseNgoReporting(session, hasModule("reports"));
  const donorExportEnabled = canUseDonorExport(session, hasModule("reports"), canManage());

  const { data: setupProgress } = useQuery({
    queryKey: ["tenants", tenantId, "setupProgress", "nav"],
    queryFn: () => settingsService.getSetupProgress(tenantId).catch(() => null),
    enabled: Boolean(user && tenantId && !isSuperAdmin),
    staleTime: 5 * 60 * 1000,
  });

  const handleNavigate = (path: string) => navigate(path);

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
    <header className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="px-4 sm:px-6">
        <div className="flex h-14 items-center gap-4">
          {/* Sidebar toggle — drawer on mobile, collapse on desktop */}
          <Button
            variant="ghost"
            size="icon"
            onClick={isMobile ? toggleSidebar : toggleCollapsed}
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side tools */}
          <div className="flex items-center gap-2">
            <LocaleSwitcher className="hidden sm:flex" />

            {/* Chat / Meza Assistant */}
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

            {/* User Menu */}
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
                    <DropdownMenuItem onClick={() => handleNavigate("/admin/tenants")} className="text-amber-600">
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
          </div>
        </div>
      </div>

      {/* Connection / Setup banners */}
      {(hasConnectionIssue || setupIncomplete) && (
        <div className="px-4 sm:px-6 border-t border-border/50 py-3">
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
                  onClick={() => { void retryConnection(); }}
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
                    <p className="text-sm font-semibold text-foreground">{t("nav.setupBannerTitle")}</p>
                    <p className="text-sm text-muted-foreground">{t("nav.setupBannerDesc", { percent: setupPercent })}</p>
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
    </header>
  );
}
