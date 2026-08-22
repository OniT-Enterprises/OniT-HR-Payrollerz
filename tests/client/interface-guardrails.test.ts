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

const authenticatedPageDirectories = [
  "accounting",
  "help",
  "hiring",
  "money",
  "payroll",
  "performance",
  "reports",
  "settings",
  "staff",
  "time-leave",
];
const publicPageExceptions = new Set(["PublicApply.tsx", "PublicInvoice.tsx"]);
const topLevelAuthenticatedPages = [
  "AccountantPortfolioDashboard.tsx",
  "AccountingDashboard.tsx",
  "Billing.tsx",
  "Dashboard.tsx",
  "MoneyDashboard.tsx",
  "PayrollDashboard.tsx",
  "PeopleDashboard.tsx",
  "ReportsDashboard.tsx",
  "SchedulingDashboard.tsx",
  "Settings.tsx",
  "Sitemap.tsx",
];
const authenticatedPageFiles = () => [
  ...authenticatedPageDirectories
    .flatMap((directory) =>
      collectTsxFiles(join(repoRoot, "client/pages", directory)),
    )
    .filter((path) => !publicPageExceptions.has(path.split("/").at(-1) ?? "")),
  ...topLevelAuthenticatedPages.map((name) =>
    join(repoRoot, "client/pages", name),
  ),
];

describe("interface guardrails", () => {
  it("keeps shared phone controls at a comfortable target size", () => {
    expect(read("client/components/ui/button.tsx")).toContain("min-h-11");
    expect(read("client/components/ui/select.tsx")).toContain("h-11");
    expect(read("client/components/ui/textarea.tsx")).toContain("text-base");
    expect(read("client/components/ui/card.tsx")).toContain(
      "text-base font-semibold leading-snug",
    );

    const calendar = read("client/components/ui/calendar.tsx");
    expect(calendar).not.toMatch(/button_(previous|next):[\s\S]*?h-7 w-7/);
    expect(calendar.match(/h-11 w-11/g)?.length).toBeGreaterThanOrEqual(3);
    expect(
      calendar.match(/md:h-11 md:min-h-11/g)?.length,
    ).toBeGreaterThanOrEqual(3);
    expect(calendar).toContain('className={cn("p-1 sm:p-3", className)}');

    const datePicker = read("client/components/ui/date-picker.tsx");
    expect(datePicker).toContain("max-w-[calc(100vw-0.5rem)]");
    expect(datePicker).toContain('align="center"');
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

  it("keeps high-use money entry forms single-column on phones", () => {
    for (const path of [
      "client/components/money/QuickBillDialog.tsx",
      "client/pages/money/Expenses.tsx",
      "client/pages/money/Customers.tsx",
    ]) {
      const source = read(path);
      expect(source).not.toContain('className="grid grid-cols-2 gap-4"');
      expect(source).toContain("grid grid-cols-1 gap-4 sm:grid-cols-2");
    }
  });

  it("leaves authenticated page height and scrolling to AppLayout", () => {
    for (const path of authenticatedPageFiles()) {
      expect(readFileSync(path, "utf8"), path).not.toContain("min-h-screen");
    }

    for (const path of [
      "client/components/reports/ReportLayout.tsx",
      "client/components/PageSkeleton.tsx",
      "client/components/payroll/PayrollLoadingSkeleton.tsx",
      "client/components/settings/SettingsHubSkeleton.tsx",
      "client/components/settings/SettingsSkeleton.tsx",
      "client/pages/AccountantPortfolioDashboard.tsx",
      "client/pages/Billing.tsx",
      "client/pages/Sitemap.tsx",
    ]) {
      expect(read(path)).not.toContain("min-h-screen");
    }
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
      const source = read(`client/pages/${name}`);
      expect(source).toContain("grid grid-cols-2 gap-3");
      expect(source).not.toContain("min-h-screen");
      expect(source).not.toContain("sm:space-y-8");
    }
  });

  it("keeps shared product chrome calm and consistent", () => {
    const pageHeader = read("client/components/layout/PageHeader.tsx");
    const hubCard = read("client/components/dashboard/HubCard.tsx");
    const peopleDashboard = read("client/pages/PeopleDashboard.tsx");

    expect(pageHeader).toContain('"absolute inset-y-0 left-0 w-16"');
    expect(pageHeader).toContain("[&>*]:flex-1");
    expect(pageHeader).not.toContain("animate-dashboard-header");

    expect(hubCard).not.toMatch(/blur-|hover:shadow|group-hover:translate/);
    expect(hubCard).toContain("hover:bg-");

    // Module colour identifies the destination; the product's primary green
    // still owns completion actions.
    expect(peopleDashboard).not.toContain("bg-blue-600 text-white");
  });

  it("keeps authenticated screens still and primary actions recognizable", () => {
    for (const path of authenticatedPageFiles()) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toMatch(
        /animate-(fade-in|fade-up|scale-in|slide-in-right|bounce-subtle|pulse-subtle)|stagger-[1-6]/,
      );
      expect(source, path).not.toMatch(
        /bg-(blue|cyan|indigo|orange|violet)-600[^"']*hover:bg-(blue|cyan|indigo|orange|violet)-700/,
      );
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
    const reportLayout = read("client/components/reports/ReportLayout.tsx");
    const reportSources = readdirSync(reportsDir)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => read(`client/pages/reports/${name}`));

    for (const source of reportSources) {
      expect(source).not.toContain("shadow-lg");
      expect(source).not.toContain("drop-shadow-lg");
      expect(source).not.toContain('className="text-2xl font-bold"');
    }

    expect(reportLayout).toContain(
      "mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6",
    );
    expect(reportLayout).not.toContain("max-w-screen-xl");
    expect(reportLayout).not.toContain(
      'titleClassName="break-words whitespace-normal text-2xl"',
    );

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

  it("keeps docked absence hours correctable in the payroll wizard", () => {
    // absenceHours is the ONLY pay lever for a salaried worker: calculateRegularPay
    // ignores hours for salaried staff, so every shortfall is docked through the
    // absence deduction and raising regularHours cannot undo an over-dock. It was
    // omitted from the editable set, which left a wrong dock — e.g. the Art. 53(4)
    // paid job-search credit, which has no leave type behind it — impossible to
    // correct anywhere in the UI. Keep it editable and keep the input rendered.
    const hook = read("client/hooks/usePayrollCalculator.ts");
    const hourFields = hook.slice(
      hook.indexOf("const hourFields = ["),
      hook.indexOf("const moneyFields = ["),
    );
    expect(hourFields).toContain('"absenceHours"');

    const card = read("client/components/payroll/PayrollEmployeeCard.tsx");
    expect(card).toContain('field="absenceHours"');
    expect(card).toContain("data.originalValues.absenceHours");
  });
});
