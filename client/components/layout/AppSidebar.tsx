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
import { type SectionId, navColors, navTreeLine } from "@/lib/sectionTheme";
import { prefetchRoute } from "@/lib/prefetch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompanyBrand } from "./CompanyBrand";
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
  const sectionActive = section.matchPaths.some((mp) => isPathActive(pathname, mp));
  const SectionIcon = section.icon;

  return (
    <div key={sectionKey} className="space-y-0.5">
      <button
        onClick={() => onToggleSection(sectionKey)}
        className={`
          w-full flex items-center gap-3 h-9 pl-4 pr-3 rounded-r-lg text-sm transition-colors
          ${sectionActive
            ? "text-sidebar-foreground font-medium"
            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }
        `}
      >
        <SectionIcon className={`h-4 w-4 shrink-0 ${sectionActive ? iconColor : ""}`} />
        <span className="truncate">{section.labelKey ? (t(`nav.${section.labelKey}`) || section.label) : section.label}</span>
        <ChevronRight className={`h-3 w-3 ml-auto shrink-0 transition-transform ${sectionExpanded ? "rotate-90" : ""}`} />
      </button>
      {sectionExpanded && (
        <div className={`relative ml-[2.19rem] border-l ${navTreeLine[mod.id]} space-y-0.5`}>
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

  if (collapsed) {
    return (
      <Tooltip key={mod.id}>
        <TooltipTrigger asChild>
          <button
            onClick={() => onNavigate(mod.config.overview?.path || mod.config.sections[0]?.path || "/")}
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
        onClick={() => onToggleModule(mod.id)}
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
        <div className={`relative ml-[1.19rem] border-l ${navTreeLine[mod.id]} space-y-0.5`}>
          {mod.config.overview && (
            <NavLink
              label={mod.config.overview.label}
              path={mod.config.overview.path}
              Icon={mod.config.overview.icon}
              iconColorClass={iconColor}
              indent={1}
              labelKey={mod.config.overview.labelKey}
              collapsed={collapsed}
              pathname={pathname}
              onNavigate={onNavigate}
              t={t}
            />
          )}
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
}

function SidebarHeader({ collapsed, isDark, isMobile, onNavigate, onClose }: SidebarHeaderProps) {
  return (
    <div className={`flex items-center ${collapsed ? "justify-center" : "px-4"} h-14 shrink-0 border-b border-sidebar-border`}>
      <button onClick={() => onNavigate("/")} className="flex min-w-0 items-center" title="Go to dashboard">
        <CompanyBrand isDark={isDark} variant="sidebar" collapsed={collapsed} />
      </button>
      {isMobile && (
        <button
          onClick={onClose}
          className="ml-auto p-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
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
}

function SidebarFooter({ collapsed, isMobile, onNavigate, onToggleCollapsed, pathname, t }: SidebarFooterProps) {
  return (
    <div className={`shrink-0 border-t border-sidebar-border py-2 ${collapsed ? "px-2" : "px-3"}`}>
      <div className="flex items-center gap-1">
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
        {!isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapsed}
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
}

function SidebarContent({
  collapsed, isDark, isMobile, pathname, visibleModules,
  expandedModules, expandedSections, onNavigate, onClose,
  onToggleModule, onToggleSection, onToggleCollapsed, t,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <SidebarHeader
        collapsed={collapsed}
        isDark={isDark}
        isMobile={isMobile}
        onNavigate={onNavigate}
        onClose={onClose}
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
      />
    </div>
  );
}

function MobileSidebar({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}
      <aside
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
  const { hasModule } = useTenant();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleModules = useMemo(
    () =>
      MODULES.flatMap((module) => {
        if (!module.visibilityCheck(hasModule)) return [];
        const filteredConfig = filterModuleNavConfigByPermissions(module.config, hasModule);
        if (filteredConfig.sections.length === 0) return [];
        return [{ ...module, config: filteredConfig }];
      }),
    [hasModule]
  );

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
  };

  if (isMobile) {
    return (
      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
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
