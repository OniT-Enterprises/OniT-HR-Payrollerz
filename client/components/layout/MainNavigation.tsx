/**
 * MainNavigation - Simplified for Low Brain Power UX
 * 5 main tabs + user menu, no dropdowns
 */

import React from "react";
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
} from "lucide-react";
import { useState } from "react";
import { type SectionId, navColors, navActiveIndicator } from "@/lib/sectionTheme";

// Simple 6-tab navigation
const NAV_ITEMS: Array<{
  id: SectionId;
  label: string;
  labelKey: string;
  path: string;
  icon: typeof LayoutDashboard;
  subtitle?: string;
  subtitleKey?: string;
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
    subtitle: "Daily",
    subtitleKey: "nav.moneySubtitle",
  },
  {
    id: "accounting",
    label: "Accounting",
    labelKey: "nav.accounting",
    path: "/accounting",
    icon: Landmark,
    subtitle: "Formal",
    subtitleKey: "nav.accountingSubtitle",
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
  const { isDark, toggleTheme } = useTheme();
  const { t, locale, setLocale, localeLabels } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const localeOptions = Object.entries(localeLabels) as Array<[typeof locale, string]>;

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
              className="flex items-center gap-2 font-bold text-lg"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center">
                <span className="text-white text-sm font-bold">HR</span>
              </div>
              <span className="hidden sm:inline text-foreground">OniT</span>
            </button>

            {/* Desktop Navigation - Simple tabs */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
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
              {NAV_ITEMS.map((item) => {
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
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
