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
  filterModuleNavConfigByPermissions,
} from "@/lib/moduleNav";
import type { ModuleNavConfig } from "@/lib/moduleNav";
import { type SectionId, navColors } from "@/lib/sectionTheme";
import {
  APP_NAV_ITEMS,
  isAppNavItemVisible,
  type AppNavItem,
} from "@/lib/appNavigation";
import {
  getRouteSidebarExpansion,
  isSidebarModuleActive,
  isSidebarPathActive,
  toggleExclusive,
} from "@/lib/sidebarNavigation";
import { prefetchRoute } from "@/lib/prefetch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Settings,
  ChevronRight,
  X,
  PanelLeftClose,
  MessageCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import { canUseDonorExport, canUseNgoReporting } from "@/lib/ngo/access";

// --- Module definitions (shared with MainNavigation via appNavigation) ---

type ModuleDef = AppNavItem & { config: ModuleNavConfig };

const DASHBOARD_ITEM = APP_NAV_ITEMS[0]!;
const MODULES = APP_NAV_ITEMS.filter(
  (item): item is ModuleDef => Boolean(item.config),
);

/** Light mode uses the current module color to make location obvious. */
const moduleActiveStyles: Record<SectionId, string> = {
  dashboard: "bg-primary/10 text-sidebar-foreground dark:bg-sidebar-accent/70",
  people: "bg-blue-50 text-sidebar-foreground dark:bg-sidebar-accent/70",
  scheduling: "bg-cyan-50 text-sidebar-foreground dark:bg-sidebar-accent/70",
  payroll: "bg-primary/10 text-sidebar-foreground dark:bg-sidebar-accent/70",
  money: "bg-indigo-50 text-sidebar-foreground dark:bg-sidebar-accent/70",
  accounting: "bg-orange-50 text-sidebar-foreground dark:bg-sidebar-accent/70",
  reports: "bg-violet-50 text-sidebar-foreground dark:bg-sidebar-accent/70",
};

// --- Helpers ---

function areSetsEqual<T>(left: Set<T>, right: Set<T>) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

// --- Custom hook: sidebar expansion state ---

function useSidebarExpansion(visibleModules: ModuleDef[]) {
  const location = useLocation();

  const activeExpansion = useMemo(
    () => getRouteSidebarExpansion(location.pathname, visibleModules),
    [location.pathname, visibleModules],
  );

  const [expandedModules, setExpandedModules] = useState<Set<string>>(activeExpansion.modules);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(activeExpansion.sections);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route changes own sidebar expansion
    setExpandedModules((prev) =>
      areSetsEqual(prev, activeExpansion.modules)
        ? prev
        : new Set(activeExpansion.modules),
    );
    setExpandedSections((prev) =>
      areSetsEqual(prev, activeExpansion.sections)
        ? prev
        : new Set(activeExpansion.sections),
    );
  }, [activeExpansion]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => toggleExclusive(prev, moduleId));
    setExpandedSections(new Set());
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => toggleExclusive(prev, key));
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
  const active = isSidebarPathActive(pathname, path);

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
              flex h-11 w-full items-center justify-center rounded-lg transition-colors
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

  const showIcon = indent < 2;

  return (
    <button
      key={path}
      onMouseEnter={() => prefetchRoute(path)}
      onClick={() => onNavigate(path)}
      aria-current={active ? "page" : undefined}
      className={`
        flex h-11 w-full items-center gap-3 rounded-lg pl-3 pr-3 text-sm transition-colors
        ${active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }
      `}
    >
      {showIcon && (
        <Icon className={`h-4 w-4 shrink-0 ${active && iconColorClass ? iconColorClass : ""}`} />
      )}
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
  pathname: string;
  onNavigate: (path: string) => void;
  t: (key: string) => string;
}

function SubSection({ mod, section, iconColor, sectionExpanded, onToggleSection, pathname, onNavigate, t }: SubSectionProps) {
  const sectionKey = `${mod.id}:${section.id}`;
  const contentId = `sidebar-section-${mod.id}-${section.id}`;
  const sectionActive = section.matchPaths.some((path) =>
    isSidebarPathActive(pathname, path),
  );
  const SectionIcon = section.icon;
  const displayLabel = section.labelKey
    ? (t(`nav.${section.labelKey}`) || section.label)
    : section.label;

  return (
    <div key={sectionKey} className="space-y-0.5">
      <button
        type="button"
        onClick={() => onToggleSection(sectionKey)}
        aria-expanded={sectionExpanded}
        aria-controls={contentId}
        className={`
          flex h-11 w-full items-center gap-3 rounded-lg pl-3 pr-2 text-left text-sm transition-colors
          ${sectionActive
            ? "text-sidebar-foreground font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }
        `}
      >
        <SectionIcon className={`h-4 w-4 shrink-0 ${sectionActive ? iconColor : ""}`} />
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        <ChevronRight
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 text-sidebar-foreground/70 transition-transform ${sectionExpanded ? "rotate-90" : ""}`}
        />
        <span className="sr-only">
          {sectionExpanded ? t("common.collapse") : t("common.expand")}
        </span>
      </button>
      {sectionExpanded && (
        <div id={contentId} className="ml-10 space-y-0.5">
          {section.subPages.map((page) => (
            <NavLink
              key={page.path}
              label={page.label}
              path={page.path}
              Icon={page.icon}
              iconColorClass={iconColor}
              indent={2}
              labelKey={page.labelKey}
              collapsed={false}
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
  const moduleActive = isSidebarModuleActive(pathname, mod.config);
  const Icon = mod.icon;
  const iconColor = navColors[mod.id];
  const activeStyle = moduleActiveStyles[mod.id];
  const dashboardPath = mod.config.overview?.path || mod.config.sections[0]?.path || "/";
  const contentId = `sidebar-module-${mod.id}`;

  if (collapsed) {
    return (
      <Tooltip key={mod.id}>
        <TooltipTrigger asChild>
          <button
            onClick={() => onNavigate(dashboardPath)}
            aria-label={t(mod.labelKey) || mod.label}
            aria-current={pathname === dashboardPath ? "page" : undefined}
            className={`
              w-full flex items-center justify-center h-11 rounded-lg transition-colors md:h-10
              ${moduleActive
                ? activeStyle
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
              }
            `}
          >
            <Icon className={`h-5 w-5 ${moduleActive ? iconColor : ""}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {t(mod.labelKey) || mod.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div key={mod.id} className="space-y-0.5">
      <div
        className={`
          w-full flex items-center h-11 rounded-lg text-sm font-medium transition-colors md:h-10
          ${moduleActive
            ? activeStyle
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }
        `}
      >
        <button
          onClick={() => onNavigate(dashboardPath)}
          aria-current={pathname === dashboardPath ? "page" : undefined}
          className="flex min-w-0 flex-1 self-stretch items-center gap-3 pl-3 pr-2 text-left"
        >
          <Icon className={`h-4 w-4 shrink-0 ${moduleActive ? iconColor : ""}`} />
          <span className="truncate">{t(mod.labelKey) || mod.label}</span>
        </button>
        <button
          onClick={() => onToggleModule(mod.id)}
          className="mr-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground md:mr-1"
          aria-label={`${isExpanded ? t("common.collapse") : t("common.expand")} ${t(mod.labelKey) || mod.label}`}
          aria-expanded={isExpanded}
          aria-controls={contentId}
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </button>
      </div>
      {isExpanded && (
        <div id={contentId} className="ml-3 space-y-0.5">
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
      <button onClick={() => onNavigate("/")} className="flex min-h-11 min-w-0 items-center" title="Go to dashboard">
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
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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

/**
 * Always-available rescue path. Our users are first-time software users on a
 * phone; when they get stuck, a human on WhatsApp is the fastest way out.
 *
 * This used to open WhatsApp directly, on the reasoning that an external link
 * never depends on app state. It now opens /help — which leads with that same
 * WhatsApp link as its first and largest element, so the human is one tap
 * further away and the written answers become reachable at all. The state
 * argument survives the change: rendering this sidebar already proves routing
 * works, so a route here fails in no case the old link would have survived.
 */
function HelpLink({
  collapsed,
  onNavigate,
  pathname,
  t,
}: {
  collapsed: boolean;
  onNavigate: (path: string) => void;
  pathname: string;
  t: (key: string) => string;
}) {
  const label = t("common.getHelp") || "Get help";
  const active = pathname === "/help" || pathname.startsWith("/help/");
  const base = active
    ? "bg-sidebar-accent text-sidebar-foreground"
    : "text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground";

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onNavigate("/help")}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 w-full items-center justify-center rounded-lg md:h-10 ${base}`}
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate("/help")}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-11 w-full items-center gap-3 rounded-lg pl-3 pr-3 text-sm md:h-9 ${base}`}
    >
      <MessageCircle className="h-5 w-5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SidebarFooter({ collapsed, isMobile, onNavigate, onToggleCollapsed, pathname, t, showSettings }: SidebarFooterProps) {
  return (
    <div className={`shrink-0 border-t border-sidebar-border py-2 ${collapsed ? "px-2" : "px-3"}`}>
      <div className="mb-1">
        <HelpLink
          collapsed={collapsed}
          onNavigate={onNavigate}
          pathname={pathname}
          t={t}
        />
      </div>
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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
  const primaryModules = visibleModules.filter((module) =>
    ["people", "scheduling", "payroll"].includes(module.id),
  );
  const moreToolModules = visibleModules.filter((module) =>
    ["money", "accounting", "reports"].includes(module.id),
  );

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
            label={t(DASHBOARD_ITEM.labelKey) || DASHBOARD_ITEM.label}
            path={DASHBOARD_ITEM.path}
            Icon={DASHBOARD_ITEM.icon}
            iconColorClass="text-sidebar-primary"
            collapsed={collapsed}
            pathname={pathname}
            onNavigate={onNavigate}
            t={t}
          />

          <div className="h-px bg-sidebar-border my-2" />

          {primaryModules.map((mod) => (
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

          {moreToolModules.length > 0 && (
            <>
              {collapsed ? (
                <div className="my-2 h-px bg-sidebar-border" />
              ) : (
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/70">
                  {t("nav.financeReports")}
                </p>
              )}
              {moreToolModules.map((mod) => (
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
            </>
          )}
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
          fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-1.5rem))] transform transition-transform duration-300 ease-out
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
  const { hasModule, canManage, session, showAdvancedTax } = useTenant();
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
      if (!isAppNavItemVisible(module, hasModule)) return [];
      let filteredConfig = filterModuleNavConfigByPermissions(
        module.config,
        hasModule,
        canManageTenant,
        canManageTeam,
        showAdvancedTax,
        session?.role,
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
  }, [canManageTeam, canManageTenant, hasModule, session, showAdvancedTax]);

  const { expandedModules, expandedSections, toggleModule, toggleSection } = useSidebarExpansion(visibleModules);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  };

  const collapsed = sidebarCollapsed && !isMobile;
  const sidebarWidth = collapsed ? "w-16" : "w-[17rem]";

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
    <aside
      aria-label={t("common.mainNavigation")}
      className={`shrink-0 ${sidebarWidth} transition-[width] duration-200`}
    >
      <SidebarContent {...contentProps} />
    </aside>
  );
}
