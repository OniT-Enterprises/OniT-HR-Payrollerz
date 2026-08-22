/**
 * Shared top-level application navigation.
 *
 * The sidebar and the legacy top navigation both consume this list so module
 * labels, icons, destinations, and feature visibility cannot drift apart.
 */

import type { ComponentType } from "react";
import {
  BarChart3,
  Calculator,
  Clock,
  Landmark,
  LayoutDashboard,
  Users,
  Wallet,
} from "lucide-react";
import type { ModulePermission } from "@/types/tenant";
import type { SectionId } from "@/lib/sectionTheme";
import {
  accountingNavConfig,
  moneyNavConfig,
  payrollNavConfig,
  peopleNavConfig,
  reportsNavConfig,
  timeLeaveNavConfig,
  type ModuleNavConfig,
} from "@/lib/moduleNav";

export interface AppNavItem {
  id: SectionId;
  label: string;
  /** Full i18n key; unlike module child labels, this is not nav-prefixed. */
  labelKey: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  config?: ModuleNavConfig;
  requiredModule?: ModulePermission;
  requiredAnyModules?: ModulePermission[];
}

export const APP_NAV_ITEMS: AppNavItem[] = [
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
    config: peopleNavConfig,
    requiredAnyModules: ["staff", "hiring", "performance"],
  },
  {
    id: "scheduling",
    label: "Time & Leave",
    labelKey: "nav.scheduling",
    path: "/time-leave",
    icon: Clock,
    config: timeLeaveNavConfig,
    requiredModule: "timeleave",
  },
  {
    id: "payroll",
    label: "Payroll",
    labelKey: "nav.payroll",
    path: "/payroll",
    icon: Calculator,
    config: payrollNavConfig,
    requiredModule: "payroll",
  },
  {
    id: "money",
    label: "Money",
    labelKey: "nav.money",
    path: "/money",
    icon: Wallet,
    config: moneyNavConfig,
    requiredModule: "money",
  },
  {
    id: "accounting",
    label: "Accounting",
    labelKey: "nav.accounting",
    path: "/accounting",
    icon: Landmark,
    config: accountingNavConfig,
    requiredModule: "accounting",
  },
  {
    id: "reports",
    label: "Workforce Reports",
    labelKey: "nav.reports",
    path: "/reports",
    icon: BarChart3,
    config: reportsNavConfig,
    requiredModule: "reports",
  },
];

export function isAppNavItemVisible(
  item: AppNavItem,
  hasModule: (module: ModulePermission) => boolean,
): boolean {
  if (item.requiredModule && !hasModule(item.requiredModule)) return false;
  if (item.requiredAnyModules?.length) {
    return item.requiredAnyModules.some((module) => hasModule(module));
  }
  return true;
}

export function getVisibleAppNavItems(
  hasModule: (module: ModulePermission) => boolean,
): AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => isAppNavItemVisible(item, hasModule));
}
