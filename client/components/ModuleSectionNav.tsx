/**
 * ModuleSectionNav — Shared 2-level section navigation for all modules.
 *
 * Modes:
 *   - (default) Auto: collapsed on hub/overview pages, expanded on leaf pages
 *   - "collapsed": Always shows Level 1 section tabs only
 *   - "expanded": Only shows Level 2 sub-pages for the active section
 *     (renders nothing if active section has no sub-pages)
 *
 * Usage on leaf pages:
 *   <ModuleSectionNav config={peopleNavConfig} mode="collapsed" />  ← above hero
 *   <hero />
 *   <ModuleSectionNav config={peopleNavConfig} mode="expanded" />   ← below hero
 *
 * Usage on hub/overview pages:
 *   <ModuleSectionNav config={peopleNavConfig} />  ← auto mode, shows collapsed
 */

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { SectionId } from "@/lib/sectionTheme";
import { filterModuleNavConfigByPermissions, type ModuleNavConfig } from "@/lib/moduleNav";
import { useLayoutOptional } from "@/contexts/LayoutContext";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Static map of active tab styles per module.
 * Full class names so Tailwind's purge can find them.
 */
const activeStyles: Record<SectionId, string> = {
  dashboard: "border-primary text-primary dark:text-primary",
  people:    "border-blue-500 text-blue-600 dark:text-blue-400",
  scheduling:"border-cyan-500 text-cyan-600 dark:text-cyan-400",
  payroll:   "border-primary text-primary dark:text-primary",
  money:     "border-indigo-500 text-indigo-600 dark:text-indigo-400",
  accounting:"border-orange-500 text-orange-600 dark:text-orange-400",
  reports:   "border-violet-500 text-violet-600 dark:text-violet-400",
};

interface ModuleSectionNavProps {
  config: ModuleNavConfig;
  /** "collapsed" = Level 1 only; "expanded" = Level 2 only (active section's sub-pages) */
  mode?: "collapsed" | "expanded";
}

function isPathActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(path + "/");
}

function isExactPath(pathname: string, path: string) {
  return pathname === path;
}

export default function ModuleSectionNav(props: ModuleSectionNavProps) {
  const layoutCtx = useLayoutOptional();
  if (layoutCtx) return null;
  return <ModuleSectionNavInner {...props} />;
}

interface NavTab {
  key: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  isAnchor: boolean;
}

function buildTabs(
  visibleConfig: ReturnType<typeof filterModuleNavConfigByPermissions>,
  pathname: string,
  mode: ModuleSectionNavProps['mode'],
): NavTab[] {
  const activeSection = visibleConfig.sections.find((s) =>
    s.matchPaths.some((mp) => isPathActive(pathname, mp))
  );
  const tabs: NavTab[] = [];

  if (visibleConfig.overview) {
    tabs.push({
      key: visibleConfig.overview.path,
      label: visibleConfig.overview.label,
      path: visibleConfig.overview.path,
      icon: visibleConfig.overview.icon,
      active: isExactPath(pathname, visibleConfig.overview.path),
      isAnchor: true,
    });
  }

  for (const section of visibleConfig.sections) {
    const isSectionActive = section.id === activeSection?.id;
    if (mode === "expanded" && !isSectionActive) continue;

    const shouldExpand = mode === "expanded"
      ? section.subPages.length > 0
      : mode === "collapsed"
        ? false
        : isSectionActive && section.subPages.length > 0 && pathname !== section.path;

    if (shouldExpand) {
      for (const sub of section.subPages) {
        tabs.push({ key: sub.path, label: sub.label, path: sub.path, icon: sub.icon, active: isPathActive(pathname, sub.path), isAnchor: false });
      }
    } else {
      tabs.push({ key: section.id, label: section.label, path: section.path, icon: section.icon, active: isSectionActive, isAnchor: true });
    }
  }
  return tabs;
}

function NavTabButton({
  tab, activeClass, onClick,
}: {
  tab: NavTab; activeClass: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap
        border-b-2 transition-colors
        ${tab.active
          ? `${activeClass} font-medium`
          : tab.isAnchor
            ? "border-transparent text-muted-foreground hover:text-foreground hover:border-border font-medium"
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
        }
      `}
    >
      <tab.icon className="h-4 w-4" />
      {tab.label}
    </button>
  );
}

function ModuleSectionNavInner({ config, mode }: ModuleSectionNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hasModule } = useTenant();
  const visibleConfig = React.useMemo(
    () => filterModuleNavConfigByPermissions(config, hasModule),
    [config, hasModule],
  );

  const tabs = React.useMemo(
    () => buildTabs(visibleConfig, pathname, mode),
    [visibleConfig, pathname, mode],
  );

  if (visibleConfig.sections.length === 0) return null;
  if (mode === "expanded" && tabs.length === 0) return null;

  const activeClass = activeStyles[visibleConfig.moduleId];

  return (
    <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label={`${visibleConfig.moduleId} sections`}>
          {tabs.map((tab) => (
            <NavTabButton key={tab.key} tab={tab} activeClass={activeClass} onClick={() => navigate(tab.path)} />
          ))}
        </nav>
      </div>
    </div>
  );
}
