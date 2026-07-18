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
  it("uses the real Primos Bo'ot identity and bundled partner assets", () => {
    expect(PRIMOS_BOOT_PARTNER).toMatchObject({
      id: "primos-boot",
      tenantId: "primos-boot",
      name: "Primos Bo'ot",
      connectionsOpen: false,
      website: "https://primosboot.com",
      email: "info@primosboot.com",
      phone: "+670 7831 8131",
      established: 2013,
    });

    for (const asset of [
      PRIMOS_BOOT_PARTNER.logoDarkText,
      PRIMOS_BOOT_PARTNER.logoLightText,
      PRIMOS_BOOT_PARTNER.mark,
    ]) {
      expect(existsSync(join(repoRoot, "public", asset))).toBe(true);
    }
  });

  it("publishes one discoverable, shell-free accountant page", () => {
    const routes = read("client/routes.tsx");
    const layout = read("client/components/layout/AppLayout.tsx");
    const landing = read("client/pages/Landing.tsx");
    const seo = read("client/lib/seo-config.ts");

    expect(routes).toContain('<Route path="/accountants" element={<AccountantPartners />} />');
    expect(layout).toContain('"/accountants"');
    expect(landing).toContain('<Link to="/accountants">');
    expect(landing).toContain("PRIMOS_BOOT_PARTNER.logoDarkText");
    expect(seo).toContain("url: '/accountants'");
    expect(read("public/sitemap.xml")).toContain("https://xefe.tl/accountants");
    expect(read("public/llms.txt")).toContain("https://xefe.tl/accountants");
  });

  it("explains consent and access boundaries in all product languages", () => {
    for (const locale of [en, tet, pt]) {
      expect(locale.accountantPartners.partner.title).toContain("Primos Bo'ot");
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

  it("keeps the Primos connection and its status visible at the bottom of the dashboard", () => {
    const dashboard = read("client/pages/Dashboard.tsx");
    const connectionCard = read("client/components/settings/AccountantPartnerCard.tsx");

    expect(dashboard).toContain("<AccountantPartnerCard />");
    expect(dashboard.indexOf("<AccountantPartnerCard />")).toBeGreaterThan(
      dashboard.indexOf('t("dashboard.thingsToDo")'),
    );
    expect(connectionCard).toContain("PRIMOS_BOOT_PARTNER.logoDarkText");
    expect(connectionCard).toContain('status === "connected"');
    expect(connectionCard).toContain("accountantPartners.connection.status.${status}");
    expect(connectionCard).toContain("accountantPartners.connection.prelaunchAction");
  });
});
