import { describe, expect, it } from "vitest";
import {
  APP_NAV_ITEMS,
  getVisibleAppNavItems,
} from "@/lib/appNavigation";
import {
  getRouteSidebarExpansion,
  toggleExclusive,
} from "@/lib/sidebarNavigation";
import type { ModulePermission } from "@/types/tenant";

const modules = APP_NAV_ITEMS.flatMap((item) =>
  item.config ? [{ id: item.id, config: item.config }] : [],
);

describe("application sidebar navigation", () => {
  it("keeps one ordered source of truth with unique modules and destinations", () => {
    expect(APP_NAV_ITEMS.map((item) => item.id)).toEqual([
      "dashboard",
      "people",
      "scheduling",
      "payroll",
      "money",
      "accounting",
      "reports",
    ]);
    expect(new Set(APP_NAV_ITEMS.map((item) => item.id)).size).toBe(
      APP_NAV_ITEMS.length,
    );
    expect(new Set(APP_NAV_ITEMS.map((item) => item.path)).size).toBe(
      APP_NAV_ITEMS.length,
    );
  });

  it("shows only modules enabled for the tenant", () => {
    const enabled = new Set<ModulePermission>(["staff", "timeleave", "payroll"]);
    const visible = getVisibleAppNavItems((module) => enabled.has(module));

    expect(visible.map((item) => item.id)).toEqual([
      "dashboard",
      "people",
      "scheduling",
      "payroll",
    ]);
  });

  it("shows People when any People capability is enabled", () => {
    for (const capability of ["staff", "hiring", "performance"] as const) {
      const visible = getVisibleAppNavItems(
        (module) => module === capability,
      );
      expect(visible.map((item) => item.id)).toEqual([
        "dashboard",
        "people",
      ]);
    }
  });

  it("opens only the module and nested group that own the route", () => {
    expect(getRouteSidebarExpansion("/people/employees", modules)).toEqual({
      modules: new Set(["people"]),
      sections: new Set(["people:employees"]),
    });

    expect(
      getRouteSidebarExpansion(
        "/accounting/statements/balance-sheet",
        modules,
      ),
    ).toEqual({
      modules: new Set(["accounting"]),
      sections: new Set(["accounting:statements"]),
    });
  });

  it("closes all branches on Home and keeps accordion toggles exclusive", () => {
    expect(getRouteSidebarExpansion("/", modules)).toEqual({
      modules: new Set(),
      sections: new Set(),
    });

    expect(toggleExclusive(new Set(["people"]), "payroll")).toEqual(
      new Set(["payroll"]),
    );
    expect(toggleExclusive(new Set(["payroll"]), "payroll")).toEqual(
      new Set(),
    );
  });
});
