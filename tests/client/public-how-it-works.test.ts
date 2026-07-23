import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en";
import pt from "@/i18n/locales/pt";
import tet from "@/i18n/locales/tet";

const repoRoot = process.cwd();
const read = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

describe("public how Xefe works page", () => {
  it("uses one canonical public route and keeps the old URL compatible", () => {
    const routes = read("client/routes.tsx");
    // The shell-skipping public path list lives in publicPaths.ts (shared by
    // AppLayout and the boot-splash dismissal in TenantContext).
    const publicPaths = read("client/lib/publicPaths.ts");

    expect(routes).toContain(
      '<Route path="/how-it-works" element={marketingRoute(<ProductDetails />)} />',
    );
    expect(routes).toContain(
      '<Route path="/features" element={<Navigate to="/how-it-works" replace />} />',
    );
    expect(publicPaths).toContain('"/how-it-works"');
  });

  it("links the landing page and public discovery files to the canonical page", () => {
    const landing = read("client/pages/Landing.tsx");
    const sitemap = read("public/sitemap.xml");
    const llms = read("public/llms.txt");

    expect(landing).toContain('<Link to="/how-it-works">');
    expect(landing).not.toContain('<Link to="/features">');
    expect(sitemap).toContain("https://xefe.tl/how-it-works");
    expect(sitemap).not.toContain("https://xefe.tl/features");
    expect(llms).toContain("https://xefe.tl/how-it-works");
  });

  it("keeps the explanation usable in all three product languages", () => {
    for (const locale of [en, tet, pt]) {
      expect(locale.howItWorks.hero.title).toBeTruthy();
      expect(locale.howItWorks.audience.everyday.title).toBeTruthy();
      expect(locale.howItWorks.audience.professional.title).toBeTruthy();
      expect(locale.howItWorks.workflow.accounting.description).toBeTruthy();
      expect(locale.howItWorks.workflow.verifyNote).toBeTruthy();
      expect(locale.howItWorks.example.synthetic).toBeTruthy();
      expect(locale.howItWorks.evidence.description).toBeTruthy();
      expect(locale.howItWorks.evidence.honestyDescription).toBeTruthy();
      expect(JSON.stringify(locale.howItWorks)).not.toMatch(
        /email data|de-identified|deidentified|firm workpapers|client data|live payroll data/i,
      );
    }
  });

  it("shows an inspectable balanced example without presenting it as client payroll", () => {
    const page = read("client/pages/ProductDetails.tsx");
    // Engine-consistent synthetic example: $1,200 base + 12h OT at 1.5x of
    // the 190.6667h-divisor hourly rate ($6.29 × 1.5 × 12 = $113.22) + $100
    // food allowance. OT and the food allowance sit OUTSIDE the INSS base
    // (DL 20/2017 Art. 9), so INSS is 4%/6% of the $1,200 base only.
    const grossPay = 1_413.22;
    const employeeWit = 91.32; // 10% × (1,413.22 − 500)
    const employeeInss = 48; // 4% × 1,200
    const employerInss = 72; // 6% × 1,200

    expect(Math.round((grossPay - employeeWit - employeeInss) * 100) / 100).toBe(1_273.9);
    expect(Math.round((grossPay + employerInss) * 100) / 100).toBe(1_485.22);
    expect(page).toContain("value: 1273.9");
    expect(page).toContain("value: 1485.22");
    expect(page).toContain("formatUSD(1485.22, locale)");
    expect(page).toContain('t("howItWorks.example.synthetic")');
    expect(page).not.toMatch(/from ["']recharts["']/);
  });
});
