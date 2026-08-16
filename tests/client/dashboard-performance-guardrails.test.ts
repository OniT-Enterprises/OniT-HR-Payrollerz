import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("home dashboard performance guardrails", () => {
  it("reveals independent dashboard regions without a whole-page data gate", () => {
    const dashboard = read("client/pages/Dashboard.tsx");

    expect(dashboard).not.toContain("if (loading)");
    expect(dashboard).toContain("const payrollCardReady =");
    expect(dashboard).toContain("const attentionDataReady =");
    expect(dashboard).toContain("usePayrollTaxFilingsDueSoon(");
    expect(dashboard).toContain("<DashboardOverviewCardSkeleton");
    expect(dashboard).toContain("<DashboardTasksSkeleton");
    expect(dashboard).toContain("summaryLoading={!dashboardSummaryReady}");
  });

  it("derives active employee issue counts from the roster already fetched", () => {
    const service = read("client/services/employeeService.ts");
    const start = service.indexOf("async getActiveEmployeeSummary");
    const end = service.indexOf(
      "async getEmployeesWithComplianceIssues",
      start,
    );
    const summaryMethod = service.slice(start, end);

    expect(summaryMethod).toContain(
      "const activeDocs = await getDocs(activeQuery)",
    );
    expect(summaryMethod).toContain("data.compliance?.hasIssues === true");
    expect(summaryMethod).toContain(
      "data.compliance?.hasBlockingIssue === true",
    );
    expect(summaryMethod).not.toContain("getCountFromServer");
  });

  it("keeps payroll surfaces out of the business-turnover deadline sweep", () => {
    const hooks = read("client/hooks/useTaxFiling.ts");
    const service = read("client/services/taxFilingService.ts");

    expect(hooks).toContain("getPayrollFilingsDueSoon(tenantId, months)");
    expect(service).toContain("includeBusinessTaxes: false");
    expect(service).toContain("if (options.includeBusinessTaxes !== false)");
  });
});
