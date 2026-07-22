import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const read = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const collectTsxFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });

describe("interface guardrails", () => {
  it("keeps shared phone controls at a comfortable target size", () => {
    expect(read("client/components/ui/button.tsx")).toContain("min-h-11");
    expect(read("client/components/ui/select.tsx")).toContain("h-11");
    expect(read("client/components/ui/textarea.tsx")).toContain("text-base");
  });

  it("gives every icon-only button an explicit accessible name", () => {
    const unnamedButtons: string[] = [];

    for (const filePath of collectTsxFiles(join(repoRoot, "client"))) {
      const source = readFileSync(filePath, "utf8");
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      const visit = (node: ts.Node) => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText(sourceFile) === "Button"
        ) {
          const attributes = node.attributes.properties.filter(
            ts.isJsxAttribute,
          );
          const getAttribute = (name: string) =>
            attributes.find(
              (attribute) => attribute.name.getText(sourceFile) === name,
            );
          const size = getAttribute("size")
            ?.initializer?.getText(sourceFile)
            .replace(/["']/g, "");

          if (size === "icon" && !getAttribute("aria-label")) {
            const line =
              sourceFile.getLineAndCharacterOfPosition(
                node.getStart(sourceFile),
              ).line + 1;
            unnamedButtons.push(
              `${filePath.slice(repoRoot.length + 1)}:${line}`,
            );
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    expect(unnamedButtons).toEqual([]);
  });

  it("does not force multi-column employee fields on phones", () => {
    const source = read("client/pages/staff/AddEmployee.tsx");
    expect(source).not.toMatch(/className="grid grid-cols-[234]\b/);
    expect(source).not.toContain('type="checkbox"');
  });

  it("keeps module dashboards compact and chart-free", () => {
    const dashboardDir = join(repoRoot, "client/pages");
    const moduleDashboards = readdirSync(dashboardDir)
      .filter(
        (name) => name.endsWith("Dashboard.tsx") && name !== "Dashboard.tsx",
      )
      .map((name) => read(`client/pages/${name}`));

    for (const source of moduleDashboards) {
      expect(source).not.toMatch(/from ["']recharts["']/);
    }

    for (const name of [
      "PeopleDashboard.tsx",
      "SchedulingDashboard.tsx",
      "PayrollDashboard.tsx",
      "MoneyDashboard.tsx",
      "AccountingDashboard.tsx",
      "ReportsDashboard.tsx",
    ]) {
      expect(read(`client/pages/${name}`)).toContain("grid grid-cols-2 gap-3");
    }
  });

  it("keeps Time & Leave operational without adding another summary row", () => {
    const dashboard = read("client/pages/SchedulingDashboard.tsx");
    const impersonation = read(
      "client/components/layout/ImpersonationBanner.tsx",
    );
    const topBar = read("client/components/layout/TopBar.tsx");
    const globalStyles = read("client/global.css");

    // Compact live signals stay surfaced — recorded-attendance in the header
    // subtitle and shift/attendance counts in the attention strip — while the
    // hub cards are pure navigation (purpose + action), matching every module.
    expect(dashboard).toContain("moduleDashboards.scheduling.subtitleRecorded");
    expect(dashboard).toContain(
      '"moduleDashboards.scheduling.attention.draftShifts"',
    );
    expect(dashboard).not.toContain(
      'title: t("moduleDashboards.scheduling.cards.timeTracking")',
    );
    // The loading skeleton reserves a compact attention strip (row-height
    // placeholders), never a tall summary block.
    expect(dashboard).toContain("px-4 py-3.5");
    expect(dashboard).not.toContain("h-40 w-full");

    expect(impersonation).toContain("bg-amber-800");
    expect(impersonation).not.toContain("bg-gradient");
    expect(topBar).toContain('title={t("common.askAI")}');
    expect(globalStyles).toContain("--sidebar-background: 220 24% 7%");
  });

  it("keeps report pages compact, neutral, and phone-safe", () => {
    const reportsDir = join(repoRoot, "client/pages/reports");
    const reportSources = readdirSync(reportsDir)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => read(`client/pages/reports/${name}`));

    for (const source of reportSources) {
      expect(source).not.toContain("shadow-lg");
      expect(source).not.toContain("drop-shadow-lg");
      expect(source).not.toContain('className="text-2xl font-bold"');
    }

    for (const name of [
      "AttendanceReports.tsx",
      "CustomReports.tsx",
      "DepartmentReports.tsx",
      "DonorExportPack.tsx",
      "EmployeeReports.tsx",
      "PayrollAllocationReport.tsx",
      "PayrollReports.tsx",
      "SetupReports.tsx",
    ]) {
      expect(read(`client/pages/reports/${name}`)).toContain("<ReportPage");
    }

    expect(read("client/pages/reports/AttendanceReports.tsx")).not.toContain(
      't("reports.attendance.breakdown.title")',
    );
    expect(read("client/pages/reports/DepartmentReports.tsx")).not.toContain(
      't("reports.department.distribution.title")',
    );
    expect(read("client/pages/reports/PayrollAllocationReport.tsx")).toContain(
      "<ReportSummary",
    );
    expect(read("client/pages/reports/DonorExportPack.tsx")).toContain(
      "<ReportSummary",
    );
  });

  it("keeps onboarding focused on required first-run decisions", () => {
    const source = read("client/pages/settings/SetupWizard.tsx");
    expect(source).not.toContain('{ id: "leave"');
    expect(source).not.toContain('t("setupWizard.tradingName")');
    expect(source).toContain("TL_DEFAULT_LEAVE_POLICIES");
  });

  it("preserves the phone invoice layout and explicit list status", () => {
    const form = read("client/pages/money/InvoiceForm.tsx");
    const list = read("client/pages/money/Invoices.tsx");
    expect(form).toContain("expandedLineItems");
    expect(form).toContain("sticky bottom-0");
    expect(list).not.toContain("InvoiceStatusTimeline");
  });

  it("does not reintroduce legacy card accents or eager guest Firestore", () => {
    expect(read("client/lib/sectionTheme.ts")).not.toContain("borderLeft");
    expect(read("client/contexts/AuthContext.tsx")).not.toContain(
      'from "firebase/firestore"',
    );
    expect(read("client/contexts/FirebaseContext.tsx")).not.toContain(
      'from "@/lib/firebase"',
    );
  });
});
