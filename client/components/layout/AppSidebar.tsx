/**
 * AppSidebar — Left sidebar navigation (Gusto-style).
 * Renders the full module hierarchy from moduleNav.ts with collapsible sections.
 * Desktop: permanent sidebar (256px or 64px collapsed).
 * Mobile: slide-over drawer with backdrop.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLayout } from "@/contexts/LayoutContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTheme } from "@/contexts/ThemeContext";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import {
  peopleNavConfig,
  timeLeaveNavConfig,
  payrollNavConfig,
  moneyNavConfig,
  accountingNavConfig,
  reportsNavConfig,
  filterModuleNavConfigByPermissions,
} from "@/lib/moduleNav";
import type { ModuleNavConfig } from "@/lib/moduleNav";
import { type SectionId, navColors, navTreeLine } from "@/lib/sectionTheme";
import { prefetchRoute } from "@/lib/prefetch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Users,
  Clock,
  Calculator,
  Wallet,
  Landmark,
  BarChart3,
  Settings,
  ChevronRight,
  X,
  PanelLeftClose,
} from "lucide-react";
import type { ComponentType } from "react";
import type { ModulePermission } from "@/types/tenant";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";

// --- Module definitions (matches MainNavigation's NAV_ITEMS) ---

interface ModuleDef {
  id: SectionId;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  config: ModuleNavConfig;
  visibilityCheck: (hasModule: (m: ModulePermission) => boolean) => boolean;
}

const MODULES: ModuleDef[] = [
  {
    id: "people",
    labelKey: "nav.people",
    icon: Users,
    config: peopleNavConfig,
    visibilityCheck: (hm) => hm("staff") || hm("hiring") || hm("performance"),
  },
  {
    id: "scheduling",
    labelKey: "nav.scheduling",
    icon: Clock,
    config: timeLeaveNavConfig,
    visibilityCheck: (hm) => hm("timeleave"),
  },
  {
    id: "payroll",
    labelKey: "nav.payroll",
    icon: Calculator,
    config: payrollNavConfig,
    visibilityCheck: (hm) => hm("payroll"),
  },
  {
    id: "money",
    labelKey: "nav.money",
    icon: Wallet,
    config: moneyNavConfig,
    visibilityCheck: (hm) => hm("money"),
  },
  {
    id: "accounting",
    labelKey: "nav.accounting",
    icon: Landmark,
    config: accountingNavConfig,
    visibilityCheck: (hm) => hm("accounting"),
  },
  {
    id: "reports",
    labelKey: "nav.reports",
    icon: BarChart3,
    config: reportsNavConfig,
    visibilityCheck: (hm) => hm("reports"),
  },
];

// --- Helpers ---

function isPathActive(pathname: string, path: string): boolean {
  if (path === "/") return pathname === "/" || pathname === "/dashboard";
  return pathname === path || pathname.startsWith(path + "/");
}

function isModuleActive(pathname: string, config: ModuleNavConfig): boolean {
  if (config.overview?.path === pathname) {
    return true;
  }
  return config.sections.some((s) =>
    s.matchPaths.some((mp) => isPathActive(pathname, mp))
  );
}

function areSetsEqual<T>(left: Set<T>, right: Set<T>) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function getIndentClass(indent: number): string {
  if (indent === 0) return "pl-3";
  if (indent === 1) return "pl-4";
  return "pl-4";
}

// --- Custom hook: sidebar expansion state ---

function useSidebarExpansion(visibleModules: ModuleDef[]) {
  const location = useLocation();

  const activeExpansion = useMemo(() => {
    const modules = new Set<string>();
    for (const mod of visibleModules) {
      if (isModuleActive(location.pathname, mod.config)) {
        modules.add(mod.id);
        break;
      }
    }
    return { modules };
  }, [location.pathname, visibleModules]);

  const [expandedModules, setExpandedModules] = useState<Set<string>>(activeExpansion.modules);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeExpansion.modules.size > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing sidebar expansion with route changes
      setExpandedModules((prev) =>
        areSetsEqual(prev, activeExpansion.modules) ? prev : new Set(activeExpansion.modules)
      );
    }

    const activeSectionKeys = new Set<string>();
    for (const mod of visibleModules) {
      for (const section of mod.config.sections) {
        if (section.subPages.length > 0 && section.matchPaths.some((mp) => isPathActive(location.pathname, mp))) {
          activeSectionKeys.add(`${mod.id}:${section.id}`);
        }
      }
    }

    if (activeSectionKeys.size > 0) {
      setExpandedSections((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const key of activeSectionKeys) {
          if (!next.has(key)) {
            next.add(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [activeExpansion.modules, location.pathname, visibleModules]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return { expandedModules, expandedSections, toggleModule, toggleSection };
}

// --- Sub-components ---

interface NavLinkProps {
  label: string;
  path: string;
  Icon: ComponentType<{ className?: string }>;
  iconColorClass?: string;
  indent?: number;
  labelKey?: string;
  collapsed: boolean;
  pathname: string;
  onNavigate: (path: string) => void;
  t: (key: string) => string;
}

function NavLink({ label, path, Icon, iconColorClass, indent = 0, labelKey, collapsed, pathname, onNavigate, t }: NavLinkProps) {
  const displayLabel = labelKey ? (t(`nav.${labelKey}`) || label) : label;
  const active = isPathActive(pathname, path);

  if (collapsed) {
    return (
      <Tooltip key={path}>
        <TooltipTrigger asChild>
          <button
            onMouseEnter={() => prefetchRoute(path)}
            onClick={() => onNavigate(path)}
            aria-label={displayLabel}
            aria-current={active ? "page" : undefined}
            className={`
              w-full flex items-center justify-center h-10 rounded-lg transition-all
              ${active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }
            `}
          >
            <Icon className={`h-5 w-5 ${active && iconColorClass ? iconColorClass : ""}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {displayLabel}
        </TooltipContent>
      </Tooltip>
    );
  }

  const pl = getIndentClass(indent);

  return (
    <button
      key={path}
      onMouseEnter={() => prefetchRoute(path)}
      onClick={() => onNavigate(path)}
      aria-current={active ? "page" : undefined}
      className={`
        w-full flex items-center gap-3 h-9 ${pl} pr-3 text-sm transition-all relative
        ${indent > 0 ? "rounded-r-lg" : "rounded-lg"}
        ${active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }
      `}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active && iconColorClass ? iconColorClass : ""}`} />
      <span className="truncate">{displayLabel}</span>
    </button>
  );
}

interface SubSectionProps {
  mod: ModuleDef;
  section: ModuleDef["config"]["sections"][number];
  iconColor: string;
  sectionExpanded: boolean;
  onToggleSection: (key: string) => void;
  collapsed: boolean;
  pathname: string;
  onNavigate: (path: string) => void;
  t: (key: string) => string;
}

function SubSection({ mod, section, iconColor, sectionExpanded, onToggleSection, collapsed, pathname, onNavigate, t }: SubSectionProps) {
  const sectionKey = `${mod.id}:${section.id}`;
  const contentId = `sidebar-section-${mod.id}-${section.id}`;
  const sectionActive = section.matchPaths.some((mp) => isPathActive(pathname, mp));
  const SectionIcon = section.icon;

  return (
    <div key={sectionKey} className="space-y-0.5">
      <div
        className={`
          w-full flex items-center gap-3 h-9 pl-4 pr-3 rounded-r-lg text-sm transition-colors
          ${sectionActive
            ? "text-sidebar-foreground font-medium"
            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }
        `}
      >
        <button
          onClick={() => onNavigate(section.path)}
          aria-current={pathname === section.path ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <SectionIcon className={`h-4 w-4 shrink-0 ${sectionActive ? iconColor : ""}`} />
          <span className="truncate">{section.labelKey ? (t(`nav.${section.labelKey}`) || section.label) : section.label}</span>
        </button>
        <button
          onClick={() => onToggleSection(sectionKey)}
          aria-label={`${sectionExpanded ? t("common.collapse") : t("common.more")} ${section.labelKey ? t(`nav.${section.labelKey}`) || section.label : section.label}`}
          aria-expanded={sectionExpanded}
          aria-controls={contentId}
          className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-accent"
        >
          <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${sectionExpanded ? "rotate-90" : ""}`} />
        </button>
      </div>
      {sectionExpanded && (
        <div
          id={contentId}
          className={`relative ml-[2.19rem] border-l ${navTreeLine[mod.id]} space-y-0.5`}
        >
          {section.subPages.map((page) => (
            <NavLink
              key={page.path}
              label={page.label}
              path={page.path}
              Icon={page.icon}
              iconColorClass={iconColor}
              indent={2}
              labelKey={page.labelKey}
              collapsed={collapsed}
              pathname={pathname}
              onNavigate={onNavigate}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ModuleSectionProps {
  mod: ModuleDef;
  collapsed: boolean;
  pathname: string;
  isExpanded: boolean;
  expandedSections: Set<string>;
  onToggleModule: (id: string) => void;
  onToggleSection: (key: string) => void;
  onNavigate: (path: string) => void;
  t: (key: string) => string;
}

function ModuleSection({ mod, collapsed, pathname, isExpanded, expandedSections, onToggleModule, onToggleSection, onNavigate, t }: ModuleSectionProps) {
  const moduleActive = isModuleActive(pathname, mod.config);
  const Icon = mod.icon;
  const iconColor = navColors[mod.id];
  const dashboardPath = mod.config.overview?.path || mod.config.sections[0]?.path || "/";
  const contentId = `sidebar-module-${mod.id}`;

  if (collapsed) {
    return (
      <Tooltip key={mod.id}>
        <TooltipTrigger asChild>
          <button
            onClick={() => onNavigate(dashboardPath)}
            aria-label={t(mod.labelKey)}
            aria-current={pathname === dashboardPath ? "page" : undefined}
            className={`
              w-full flex items-center justify-center h-10 rounded-lg transition-colors
              ${moduleActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
              }
            `}
          >
            <Icon className={`h-5 w-5 ${moduleActive ? iconColor : ""}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {t(mod.labelKey)}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div key={mod.id} className="space-y-0.5">
      <div
        className={`
          w-full flex items-center h-10 rounded-lg text-sm font-medium transition-colors
          ${moduleActive
            ? "bg-sidebar-accent/70 text-sidebar-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }
        `}
      >
        <button
          onClick={() => onNavigate(dashboardPath)}
          aria-current={pathname === dashboardPath ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 pl-3 pr-2 text-left"
        >
          <Icon className={`h-4 w-4 shrink-0 ${moduleActive ? iconColor : ""}`} />
          <span className="truncate">{t(mod.labelKey)}</span>
        </button>
        <button
          onClick={() => onToggleModule(mod.id)}
          className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label={`${isExpanded ? t("common.collapse") : t("common.more")} ${t(mod.labelKey)}`}
          aria-expanded={isExpanded}
          aria-controls={contentId}
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </button>
      </div>
      {isExpanded && (
        <div
          id={contentId}
          className={`relative ml-[1.19rem] border-l ${navTreeLine[mod.id]} space-y-0.5`}
        >
          {mod.config.sections.map((section) => {
            if (section.subPages.length === 0) {
              return (
                <NavLink
                  key={section.path}
                  label={section.label}
                  path={section.path}
                  Icon={section.icon}
                  iconColorClass={iconColor}
                  indent={1}
                  labelKey={section.labelKey}
                  collapsed={collapsed}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  t={t}
                />
              );
            }
            return (
              <SubSection
                key={`${mod.id}:${section.id}`}
                mod={mod}
                section={section}
                iconColor={iconColor}
                sectionExpanded={expandedSections.has(`${mod.id}:${section.id}`)}
                onToggleSection={onToggleSection}
                collapsed={collapsed}
                pathname={pathname}
                onNavigate={onNavigate}
                t={t}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SidebarHeaderProps {
  collapsed: boolean;
  isDark: boolean;
  isMobile: boolean;
  onNavigate: (path: string) => void;
  onClose: () => void;
  closeLabel: string;
}

function SidebarHeader({ collapsed, isDark, isMobile, onNavigate, onClose, closeLabel }: SidebarHeaderProps) {
  return (
    <div className={`flex items-center ${collapsed ? "justify-center" : "px-4"} h-14 shrink-0 border-b border-sidebar-border`}>
      <button onClick={() => onNavigate("/")} className="flex min-w-0 items-center" title="Go to dashboard">
        {collapsed ? (
          <img
            src={isDark ? "/images/illustrations/xefe-mark-light.webp" : "/images/illustrations/xefe-mark-dark.webp"}
            alt="Xefe"
            className="h-8 w-auto"
          />
        ) : (
          <img
            src={isDark ? "/images/illustrations/xefe-logo-light.webp" : "/images/illustrations/xefe-logo-dark.webp"}
            alt="Xefe"
            className="h-9 w-auto"
          />
        )}
      </button>
      {isMobile && (
        <button
          onClick={onClose}
          data-sidebar-close
          className="ml-auto p-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          aria-label={closeLabel}
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

interface SidebarFooterProps {
  collapsed: boolean;
  isMobile: boolean;
  onNavigate: (path: string) => void;
  onToggleCollapsed: () => void;
  pathname: string;
  t: (key: string) => string;
  showSettings: boolean;
}

function SidebarFooter({ collapsed, isMobile, onNavigate, onToggleCollapsed, pathname, t, showSettings }: SidebarFooterProps) {
  return (
    <div className={`shrink-0 border-t border-sidebar-border py-2 ${collapsed ? "px-2" : "px-3"}`}>
      <div className="flex items-center gap-1">
        {showSettings && (
          <div className="flex-1">
            <NavLink
              label={t("common.settings")}
              path="/settings"
              Icon={Settings}
              collapsed={collapsed}
              pathname={pathname}
              onNavigate={onNavigate}
              t={t}
            />
          </div>
        )}
        {!isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapsed}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors shrink-0"
                aria-label={collapsed ? t("common.expandSidebar") : t("common.collapseSidebar")}
              >
                <PanelLeftClose className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {collapsed ? "Expand" : "Collapse"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// --- Sidebar content ---

interface SidebarContentProps {
  collapsed: boolean;
  isDark: boolean;
  isMobile: boolean;
  pathname: string;
  visibleModules: ModuleDef[];
  expandedModules: Set<string>;
  expandedSections: Set<string>;
  onNavigate: (path: string) => void;
  onClose: () => void;
  onToggleModule: (id: string) => void;
  onToggleSection: (key: string) => void;
  onToggleCollapsed: () => void;
  t: (key: string) => string;
  showSettings: boolean;
}

function SidebarContent({
  collapsed, isDark, isMobile, pathname, visibleModules,
  expandedModules, expandedSections, onNavigate, onClose,
  onToggleModule, onToggleSection, onToggleCollapsed, t, showSettings,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <SidebarHeader
        collapsed={collapsed}
        isDark={isDark}
        isMobile={isMobile}
        onNavigate={onNavigate}
        onClose={onClose}
        closeLabel={t("common.closeMenu")}
      />

      <ScrollArea className="flex-1 py-3">
        <div className={`space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
          <NavLink
            label={t("common.dashboard")}
            path="/"
            Icon={LayoutDashboard}
            iconColorClass="text-sidebar-primary"
            collapsed={collapsed}
            pathname={pathname}
            onNavigate={onNavigate}
            t={t}
          />

          <div className="h-px bg-sidebar-border my-2" />

          {visibleModules.map((mod) => (
            <ModuleSection
              key={mod.id}
              mod={mod}
              collapsed={collapsed}
              pathname={pathname}
              isExpanded={expandedModules.has(mod.id)}
              expandedSections={expandedSections}
              onToggleModule={onToggleModule}
              onToggleSection={onToggleSection}
              onNavigate={onNavigate}
              t={t}
            />
          ))}
        </div>
      </ScrollArea>

      <SidebarFooter
        collapsed={collapsed}
        isMobile={isMobile}
        onNavigate={onNavigate}
        onToggleCollapsed={onToggleCollapsed}
        pathname={pathname}
        t={t}
        showSettings={showSettings}
      />
    </div>
  );
}

function MobileSidebar({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("[data-sidebar-close]")
        ?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}
      <aside
        id="app-mobile-sidebar"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-hidden={!open}
        inert={!open}
        className={`
          fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {children}
      </aside>
    </>
  );
}

// --- Component ---

export default function AppSidebar() {
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleCollapsed } = useLayout();
  const isMobile = useIsMobile();
  const { isDark } = useTheme();
  const { hasModule, canManage, session } = useTenant();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const canManageTenant = canManage();
  const canManageTeam = canManageTenant || session?.role === "manager";

  const visibleModules = useMemo(() => {
    const hasReports = hasModule("reports");
    const ngoReportingEnabled = canUseNgoReporting(session, hasReports);
    const donorExportEnabled = canUseDonorExport(
      session,
      hasReports,
      canManageTenant
    );

    return MODULES.flatMap((module) => {
      if (!module.visibilityCheck(hasModule)) return [];
      let filteredConfig = filterModuleNavConfigByPermissions(
        module.config,
        hasModule,
        canManageTenant,
        canManageTeam,
      );

      if (!canManageTenant) {
        filteredConfig = {
          ...filteredConfig,
          sections: filteredConfig.sections
            .filter((section) => !section.path.includes("/settings"))
            .map((section) => ({
              ...section,
              subPages: section.subPages.filter(
                (page) => !page.path.includes("/settings")
              ),
            })),
        };
      }

      if (module.id === "reports") {
        filteredConfig = {
          ...filteredConfig,
          sections: filteredConfig.sections
            .filter((section) => section.id !== "ngo" || ngoReportingEnabled)
            .map((section) =>
              section.id === "ngo" && !donorExportEnabled
                ? {
                    ...section,
                    subPages: section.subPages.filter(
                      (page) => page.path !== "/reports/donor-export"
                    ),
                  }
                : section
            ),
        };
      }

      if (filteredConfig.sections.length === 0) return [];
      return [{ ...module, config: filteredConfig }];
    });
  }, [canManageTeam, canManageTenant, hasModule, session]);

  const { expandedModules, expandedSections, toggleModule, toggleSection } = useSidebarExpansion(visibleModules);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  };

  const collapsed = sidebarCollapsed && !isMobile;
  const sidebarWidth = collapsed ? "w-16" : "w-64";

  const contentProps: SidebarContentProps = {
    collapsed, isDark, isMobile, pathname: location.pathname,
    visibleModules, expandedModules, expandedSections,
    onNavigate: handleNavigate, onClose: () => setSidebarOpen(false),
    onToggleModule: toggleModule, onToggleSection: toggleSection,
    onToggleCollapsed: toggleCollapsed, t,
    showSettings: canManageTenant,
  };

  if (isMobile) {
    return (
      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        label={t("common.mainNavigation")}
      >
        <SidebarContent {...contentProps} />
      </MobileSidebar>
    );
  }

  return (
    <aside className={`shrink-0 ${sidebarWidth} transition-[width] duration-200`}>
      <SidebarContent {...contentProps} />
    </aside>
  );
}
