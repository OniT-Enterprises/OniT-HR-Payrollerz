/**
 * AppSidebar — Left sidebar navigation (Gusto-style).
 * Renders the full module hierarchy from moduleNav.ts with collapsible sections.
 * Desktop: permanent sidebar (256px or 64px collapsed).
 * Mobile: slide-over drawer with backdrop.
 */

import React, { useEffect, useMemo, useState } from "react";
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
import { type SectionId, navColors } from "@/lib/sectionTheme";
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

// --- Component ---

export default function AppSidebar() {
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleCollapsed } = useLayout();
  const isMobile = useIsMobile();
  const { isDark } = useTheme();
  const { hasModule } = useTenant();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleModules = useMemo(
    () =>
      MODULES.flatMap((module) => {
        if (!module.visibilityCheck(hasModule)) {
          return [];
        }

        const filteredConfig = filterModuleNavConfigByPermissions(module.config, hasModule);
        if (filteredConfig.sections.length === 0) {
          return [];
        }

        return [{ ...module, config: filteredConfig }];
      }),
    [hasModule]
  );

  // Compute which module + section should be expanded based on current path
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

  // Which modules and sub-sections are expanded
  const [expandedModules, setExpandedModules] = useState<Set<string>>(activeExpansion.modules);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // When navigation changes, collapse everything except the active module
  // and auto-expand the active sub-section
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

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  };

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

  const collapsed = sidebarCollapsed && !isMobile;
  const sidebarWidth = collapsed ? "w-16" : "w-64";

  // --- Render helpers ---

  const renderNavLink = (
    label: string,
    path: string,
    Icon: ComponentType<{ className?: string }>,
    iconColorClass?: string,
    indent: number = 0,
    labelKey?: string,
  ) => {
    const displayLabel = labelKey ? (t(`nav.${labelKey}`) || label) : label;
    const active = isPathActive(location.pathname, path);
    const pl = indent === 0 ? "pl-3" : indent === 1 ? "pl-8" : "pl-12";

    if (collapsed) {
      return (
        <Tooltip key={path}>
          <TooltipTrigger asChild>
            <button
              onMouseEnter={() => prefetchRoute(path)}
              onClick={() => handleNavigate(path)}
              className={`
                w-full flex items-center justify-center h-10 rounded-lg transition-all
                ${active
                  ? `bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-[3px] ${iconColorClass ? iconColorClass.replace("text-", "border-") : "border-sidebar-primary"}`
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-[3px] border-transparent"
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

    // Derive border color from icon color (e.g. "text-blue-500" → "border-blue-500")
    const activeBorderColor = iconColorClass ? iconColorClass.replace("text-", "border-") : "border-sidebar-primary";

    return (
      <button
        key={path}
        onMouseEnter={() => prefetchRoute(path)}
        onClick={() => handleNavigate(path)}
        className={`
          w-full flex items-center gap-3 h-9 ${pl} pr-3 rounded-lg text-sm transition-all relative
          ${active
            ? `bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-[3px] ${activeBorderColor}`
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-[3px] border-transparent"
          }
        `}
      >
        <Icon className={`h-4 w-4 shrink-0 ${active && iconColorClass ? iconColorClass : ""}`} />
        <span className="truncate">{displayLabel}</span>
      </button>
    );
  };

  const renderModule = (mod: ModuleDef) => {
    const isExpanded = expandedModules.has(mod.id);
    const moduleActive = isModuleActive(location.pathname, mod.config);
    const Icon = mod.icon;
    const iconColor = navColors[mod.id];

    if (collapsed) {
      return (
        <Tooltip key={mod.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleNavigate(mod.config.sections[0]?.path || "/")}
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
        <button
          onClick={() => toggleModule(mod.id)}
          className={`
            w-full flex items-center gap-3 h-10 pl-3 pr-3 rounded-lg text-sm font-medium transition-colors
            ${moduleActive
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }
          `}
        >
          <Icon className={`h-4 w-4 shrink-0 ${moduleActive ? iconColor : ""}`} />
          <span className="truncate">{t(mod.labelKey)}</span>
          <ChevronRight className={`h-3.5 w-3.5 ml-auto shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </button>
        {isExpanded && (
          <div className="space-y-0.5">
            {mod.config.sections.map((section) => {
              if (section.subPages.length === 0) {
                // Direct link — no children
                return renderNavLink(section.label, section.path, section.icon, iconColor, 1, section.labelKey);
              }

              // Collapsible sub-section
              const sectionKey = `${mod.id}:${section.id}`;
              const sectionExpanded = expandedSections.has(sectionKey);
              const sectionActive = section.matchPaths.some((mp) => isPathActive(location.pathname, mp));

              return (
                <div key={sectionKey} className="space-y-0.5">
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className={`
                      w-full flex items-center gap-3 h-9 pl-8 pr-3 rounded-lg text-sm transition-colors
                      ${sectionActive
                        ? "text-sidebar-foreground font-medium"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <section.icon className={`h-4 w-4 shrink-0 ${sectionActive ? iconColor : ""}`} />
                    <span className="truncate">{section.labelKey ? (t(`nav.${section.labelKey}`) || section.label) : section.label}</span>
                    <ChevronRight className={`h-3 w-3 ml-auto shrink-0 transition-transform ${sectionExpanded ? "rotate-90" : ""}`} />
                  </button>
                  {sectionExpanded && (
                    <div className="space-y-0.5">
                      {section.subPages.map((page) =>
                        renderNavLink(page.label, page.path, page.icon, iconColor, 2, page.labelKey)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // --- Sidebar content ---

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "px-4"} h-14 shrink-0 border-b border-sidebar-border`}>
        <button onClick={() => handleNavigate("/")} className="flex items-center">
          <img
            src={isDark ? "/images/illustrations/logo-v2-dark.webp" : "/images/illustrations/logo-v2-light.webp"}
            alt="Meza"
            className={collapsed ? "h-7 w-auto" : "h-8 w-auto"}
          />
        </button>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto p-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <div className={`space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
          {/* Dashboard */}
          {renderNavLink(
            t("common.dashboard"),
            "/",
            LayoutDashboard,
            "text-sidebar-primary",
            0,
          )}

          {/* Module separator */}
          <div className="h-px bg-sidebar-border my-2" />

          {/* Modules */}
          {visibleModules.map(renderModule)}
        </div>
      </ScrollArea>

      {/* Bottom section */}
      <div className={`shrink-0 border-t border-sidebar-border py-2 ${collapsed ? "px-2" : "px-3"}`}>
        <div className="flex items-center gap-1">
          <div className="flex-1">
            {renderNavLink(t("common.settings"), "/settings", Settings, undefined, 0)}
          </div>
          {!isMobile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleCollapsed}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors shrink-0"
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
    </div>
  );

  // --- Mobile drawer ---

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Drawer */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  // --- Desktop sidebar ---

  return (
    <aside className={`shrink-0 ${sidebarWidth} transition-[width] duration-200`}>
      {sidebarContent}
    </aside>
  );
}
