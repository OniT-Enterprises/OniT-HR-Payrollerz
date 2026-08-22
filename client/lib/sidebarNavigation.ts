import type { ModuleNavConfig } from "@/lib/moduleNav";

export interface SidebarModuleLike {
  id: string;
  config: ModuleNavConfig;
}

export function isSidebarPathActive(pathname: string, path: string): boolean {
  if (path === "/") return pathname === "/" || pathname === "/dashboard";
  return pathname === path || pathname.startsWith(path + "/");
}

export function isSidebarModuleActive(
  pathname: string,
  config: ModuleNavConfig,
): boolean {
  if (config.overview?.path === pathname) return true;
  return config.sections.some((section) =>
    section.matchPaths.some((path) => isSidebarPathActive(pathname, path)),
  );
}

/** The route owns expansion: at most one module and one nested group are open. */
export function getRouteSidebarExpansion(
  pathname: string,
  modules: SidebarModuleLike[],
): { modules: Set<string>; sections: Set<string> } {
  const activeModule = modules.find((module) =>
    isSidebarModuleActive(pathname, module.config),
  );

  if (!activeModule) {
    return { modules: new Set(), sections: new Set() };
  }

  const activeSection = activeModule.config.sections.find(
    (section) =>
      section.subPages.length > 0 &&
      section.matchPaths.some((path) =>
        isSidebarPathActive(pathname, path),
      ),
  );

  return {
    modules: new Set([activeModule.id]),
    sections: activeSection
      ? new Set([`${activeModule.id}:${activeSection.id}`])
      : new Set(),
  };
}

/** Accordion toggle used for both modules and their nested groups. */
export function toggleExclusive(
  current: Set<string>,
  key: string,
): Set<string> {
  return current.has(key) ? new Set() : new Set([key]);
}
