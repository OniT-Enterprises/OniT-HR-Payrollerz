import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en";
import pt from "@/i18n/locales/pt";
import tet from "@/i18n/locales/tet";
import { PRIMOS_BOOT_PARTNER } from "@/lib/accountantPartners";

const repoRoot = process.cwd();
const read = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

describe("accountant partner funnel", () => {
  it("withholds the unsigned partner's identity while keeping internal ids stable", () => {
    // The partnership is not signed yet: the firm's real name, logo, and
    // contact details must not ship anywhere public, but the internal ids
    // must stay stable so stored selections survive the announcement.
    expect(PRIMOS_BOOT_PARTNER).toMatchObject({
      id: "primos-boot",
      tenantId: "primos-boot",
      connectionsOpen: false,
      website: "",
      email: "",
      phone: "",
      logoDarkText: "",
      logoLightText: "",
      mark: "",
    });
    expect(PRIMOS_BOOT_PARTNER.name).not.toMatch(/primos/i);

    // No partner logo assets bundled, and no real identity in public surfaces.
    expect(existsSync(join(repoRoot, "public/images/partners"))).toBe(false);
    for (const surface of [
      "client/lib/seo-config.ts",
      "public/llms.txt",
      "client/pages/AccountantPartners.tsx",
      "client/pages/Landing.tsx",
    ]) {
      expect(read(surface)).not.toMatch(/primos bo'ot|primosboot/i);
    }
  });

  it("publishes one discoverable, shell-free accountant page", () => {
    const routes = read("client/routes.tsx");
    // The shell-skipping public path list lives in publicPaths.ts (shared by
    // AppLayout and the boot-splash dismissal in TenantContext).
    const publicPaths = read("client/lib/publicPaths.ts");
    const landing = read("client/pages/Landing.tsx");
    const seo = read("client/lib/seo-config.ts");

    expect(routes).toContain('<Route path="/accountants" element={marketingRoute(<AccountantPartners />)} />');
    expect(publicPaths).toContain('"/accountants"');
    expect(landing).toContain('<Link to="/accountants">');
    expect(landing).toContain("PRIMOS_BOOT_PARTNER.name");
    expect(seo).toContain("url: '/accountants'");
    expect(read("public/sitemap.xml")).toContain("https://xefe.tl/accountants");
    expect(read("public/llms.txt")).toContain("https://xefe.tl/accountants");
  });

  it("explains consent and access boundaries in all product languages", () => {
    for (const locale of [en, tet, pt]) {
      expect(JSON.stringify(locale)).not.toMatch(/primos bo'ot|primosboot/i);
      expect(locale.accountantPartners.partner.title).toBeTruthy();
      expect(locale.accountantPartners.selection.privacy).toBeTruthy();
      expect(locale.accountantPartners.access.consentNote).toBeTruthy();
      expect(locale.accountantPartners.access.can.payroll).toBeTruthy();
      expect(locale.accountantPartners.access.cannot.users).toBeTruthy();
      expect(locale.accountantPortfolio.cards.connected).toBeTruthy();
      expect(JSON.stringify(locale.accountantPartners)).not.toMatch(
        /mail corpus|test email|email dataset|worked email|client payroll example/i,
      );
    }
  });

  it("carries an optional choice through both signup paths without granting access", () => {
    const signup = read("client/pages/auth/Signup.tsx");
    const onboarding = read("client/pages/auth/Onboarding.tsx");
    const provisioning = read("client/services/provisionOrg.ts");
    const functions = read("functions/src/accountantPartners.ts");
    const requestFlow = functions
      .split("export const requestAccountantPartnerConnection")[1]
      .split("export const cancelAccountantPartnerConnection")[0];

    expect(signup).toContain("<AccountantChoice");
    expect(signup).toContain("accountantPartnerId,");
    expect(onboarding).toContain("<AccountantChoice");
    expect(onboarding).toContain("accountantPartnerId,");
    expect(provisioning).toContain('status: "selected"');
    expect(provisioning).toContain("requestConnection(");
    expect(requestFlow).toContain('status: "requested"');
    expect(requestFlow).not.toContain("/members");
    expect(requestFlow).not.toContain('role: "accountant"');
  });

  it("hard-blocks all pre-launch communication to Primos Bo'ot", () => {
    const provisioning = read("client/services/provisionOrg.ts");
    const functions = read("functions/src/accountantPartners.ts");
    const bootstrap = read("scripts/bootstrap-primos-partner.mjs");
    const requestFlow = functions
      .split("export const requestAccountantPartnerConnection")[1]
      .split("export const cancelAccountantPartnerConnection")[0];

    expect(provisioning).toContain("if (PRIMOS_BOOT_PARTNER.connectionsOpen)");
    expect(functions).toContain("connectionRequestsOpen: false");
    expect(requestFlow).toContain("requireConnectionRequestsOpen(partner)");
    expect(functions).toContain("Blocked pre-launch accountant partner email");
    expect(functions).toContain("requireConnectionRequestsOpen(partner)");
    expect(bootstrap).toContain("partnerCommunicationsEnabled = false");
  });

  it("requires firm acceptance and explicit owner grant, then supports full revocation", () => {
    const functions = read("functions/src/accountantPartners.ts");
    const grantFlow = functions
      .split("export const grantAccountantPartnerAccess")[1]
      .split("export const revokeAccountantPartnerAccess")[0];
    const revokeFlow = functions.split("export const revokeAccountantPartnerAccess")[1];

    expect(grantFlow).toContain('["owner"]');
    expect(grantFlow).toContain('requestSnap.data()?.status !== "accepted"');
    expect(grantFlow).toContain('role: "accountant"');
    expect(grantFlow).toContain("ACCOUNTANT_MODULES");
    expect(revokeFlow).toContain('.where("partnerId", "==", partner.id)');
    expect(revokeFlow).toContain("memberRef.delete()");
    expect(revokeFlow).toContain("FieldValue.arrayRemove(tenantId)");
    expect(revokeFlow).toContain("delete tenants[tenantId]");
  });

  it("gives every Primos team member an individual restricted client membership", () => {
    const functions = read("functions/src/accountantPartners.ts");
    const activationFlow = functions
      .split("export const activateAccountantPartnerClientAccess")[1]
      .split("export const grantAccountantPartnerAccess")[0];
    const dashboard = read("client/pages/AccountantPortfolioDashboard.tsx");
    const app = read("client/App.tsx");

    expect(activationFlow).toContain("requirePartnerTeamAccess");
    expect(activationFlow).toContain('requestData.status !== "connected"');
    expect(activationFlow).toContain('role: "accountant"');
    expect(dashboard).toContain("activateClientAccess(item.requestId)");
    expect(dashboard).toContain("switchTenant(item.tenantId)");
    expect(dashboard).not.toMatch(/from ["']recharts["']/);
    expect(app).toContain("isAccountantPartnerTenant(session.tid)");
    expect(functions).toContain("removeDepartedAccountantPartnerAccess");
    expect(functions).toContain('action: "accountant.team_access_removed"');
  });

  it("keeps the partner connection and its status visible at the bottom of the dashboard", () => {
    const dashboard = read("client/pages/Dashboard.tsx");
    const connectionCard = read("client/components/settings/AccountantPartnerCard.tsx");
    const settings = read("client/pages/Settings.tsx");

    // The dashboard shows the quiet one-line banner (name + status, no action
    // buttons); the full interactive card stays on the Settings page.
    expect(dashboard).toContain("<AccountantPartnerBanner />");
    expect(dashboard.indexOf("<AccountantPartnerBanner />")).toBeGreaterThan(
      dashboard.indexOf('t("dashboard.thingsToDo")'),
    );
    expect(settings).toContain("<AccountantPartnerCard />");
    expect(connectionCard).toContain("PRIMOS_BOOT_PARTNER.name");
    expect(connectionCard).toContain('status === "connected"');
    expect(connectionCard).toContain("accountantPartners.connection.status.${status}");
    expect(connectionCard).toContain("accountantPartners.connection.prelaunchAction");
  });
});
