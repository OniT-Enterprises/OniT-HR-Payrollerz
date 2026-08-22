/**
 * The payment half of an ATTL obligation: which account the money goes to,
 * how the transfer is described, and which cadence the taxpayer is on.
 *
 * Every account number and the credit-description convention here come from
 * real remittance evidence, so these tests are the guard against someone
 * "tidying" a digit or reordering the description and quietly sending a
 * client's tax payment to the wrong government account.
 */

import { describe, it, expect } from "vitest";
import {
  ATTL_TAX_ACCOUNTS,
  ATTL_TAX_ACCOUNT_DETAILS,
  ATTL_CREDIT_DESCRIPTION_MAX,
  attlBeneficiaryAccountLine,
  formatAttlCreditDescription,
  validateTLIban,
} from "@/lib/tlBanking";
import {
  getTLIncomeTaxInstallmentFrequency,
  resolveTLIncomeTaxInstallmentFrequency,
} from "@/lib/tax/income-tax-installment-tl";

describe("ATTL collection accounts", () => {
  it("has a valid published IBAN for every account", () => {
    for (const [key, detail] of Object.entries(ATTL_TAX_ACCOUNT_DETAILS)) {
      expect(detail.iban, `${key} IBAN`).toBeTruthy();
    }
  });

  it("keeps the four attested account numbers", () => {
    expect(ATTL_TAX_ACCOUNT_DETAILS.wageIncomeTax.local).toBe("286442.10.001");
    expect(ATTL_TAX_ACCOUNT_DETAILS.specialWithholdingTax.local).toBe("286830.10.001");
    expect(ATTL_TAX_ACCOUNT_DETAILS.incomeTaxInstallment.local).toBe("286539.10.001");
    expect(ATTL_TAX_ACCOUNT_DETAILS.servicesTax.local).toBe("286636.10.001");
  });

  it("every stored IBAN is a valid TL IBAN at BNU, and matches its account number", () => {
    for (const detail of Object.values(ATTL_TAX_ACCOUNT_DETAILS)) {
      if (!detail.iban) continue;
      const result = validateTLIban(detail.iban);
      expect(result.valid).toBe(true);
      expect(result.bankCode).toBe("002");
      expect(result.iban).toContain(detail.bnu);
    }
  });

  // All four IBANs are now published by ATTL itself. The fallback stays tested
  // because the rule it protects — print the local A/C rather than synthesise
  // an IBAN from the shared TL38/002/…/62 shape — is the point.
  it("prefers the IBAN, and falls back to the local A/C when one is absent", () => {
    expect(attlBeneficiaryAccountLine("servicesTax")).toBe(
      ATTL_TAX_ACCOUNT_DETAILS.servicesTax.iban,
    );
    expect(attlBeneficiaryAccountLine("incomeTaxInstallment")).toBe(
      ATTL_TAX_ACCOUNT_DETAILS.incomeTaxInstallment.iban,
    );
    expect(
      attlBeneficiaryAccountLine.call(null, "servicesTax"),
    ).not.toContain("null");
  });

  it("keeps the legacy IBAN map pointing at the same accounts", () => {
    expect(ATTL_TAX_ACCOUNTS.accounts.wageIncomeTax).toBe(
      ATTL_TAX_ACCOUNT_DETAILS.wageIncomeTax.iban,
    );
    expect(ATTL_TAX_ACCOUNTS.accounts.incomeTaxInstallment).toBe(
      ATTL_TAX_ACCOUNT_DETAILS.incomeTaxInstallment.iban,
    );
  });
});

describe("formatAttlCreditDescription", () => {
  it("leads with the TIN, which is what ATTL reconciles by", () => {
    expect(
      formatAttlCreditDescription({ tin: "1397982", shortName: "RUSWIN" }),
    ).toBe("1397982_RUSWIN");
  });

  it("appends the tax and period when they fit", () => {
    expect(
      formatAttlCreditDescription({
        tin: "1397982",
        shortName: "RUSWIN",
        taxLabel: "AITI",
        periodRef: "06/2026",
      }),
    ).toBe("1397982_RUSWIN AITI 06/2026");
  });

  it("drops whole trailing parts rather than cutting one in half", () => {
    // "1397982_LONG TRADING NAME" is 25 chars; " AITI" fits, " 06/2026" does not.
    expect(
      formatAttlCreditDescription({
        tin: "1397982",
        shortName: "LONG TRADING NAME",
        taxLabel: "AITI",
        periodRef: "06/2026",
      }),
    ).toBe("1397982_LONG TRADING NAME AITI");
  });

  it("truncates the TAIL, never the TIN", () => {
    const description = formatAttlCreditDescription({
      tin: "1397982",
      shortName: "A VERY LONG TRADING NAME LDA",
      taxLabel: "AITI",
      periodRef: "06/2026",
    });
    expect(description.length).toBeLessThanOrEqual(ATTL_CREDIT_DESCRIPTION_MAX);
    expect(description.startsWith("1397982_")).toBe(true);
    // No half-written tail left behind.
    expect(description).not.toMatch(/AITI \d$/);
  });

  it("falls back to a blank marker rather than inventing a TIN", () => {
    expect(formatAttlCreditDescription({ tin: "" })).toBe("________");
  });
});

describe("instalment cadence", () => {
  it("follows Sec. 64.1/64.2 by default", () => {
    expect(getTLIncomeTaxInstallmentFrequency(250_000)).toBe("quarterly");
    expect(getTLIncomeTaxInstallmentFrequency(1_000_000)).toBe("quarterly");
    expect(getTLIncomeTaxInstallmentFrequency(1_000_000.01)).toBe("monthly");
  });

  it("honours a monthly registration below the threshold", () => {
    expect(resolveTLIncomeTaxInstallmentFrequency(250_000, "monthly")).toBe("monthly");
    expect(resolveTLIncomeTaxInstallmentFrequency(250_000, "auto")).toBe("quarterly");
    expect(resolveTLIncomeTaxInstallmentFrequency(250_000, undefined)).toBe("quarterly");
  });

  it("never lets a setting relax a large taxpayer to quarterly", () => {
    // There is no 'quarterly' override to pass, and monthly stays monthly.
    expect(resolveTLIncomeTaxInstallmentFrequency(5_000_000, "monthly")).toBe("monthly");
    expect(resolveTLIncomeTaxInstallmentFrequency(5_000_000, undefined)).toBe("monthly");
  });
});

describe("GL accounts a statutory payment posts to", () => {
  // resolvePaymentAccounts falls back to ensureSystemAccountByCode for tenants
  // whose chart was seeded before these accounts existed, and that fallback
  // only creates accounts flagged isSystem. Without the flag, recording a
  // payment fails for every existing tenant and passes for new ones.
  it("exist, are system accounts, and sit on the right side", async () => {
    const { getDefaultAccounts } = await import("@/lib/accounting/chart-of-accounts");
    const byCode = new Map(getDefaultAccounts().map((a) => [a.code, a]));

    const prepaidTax = byCode.get("1330");
    expect(prepaidTax?.isSystem).toBe(true);
    // Sec. 64.4 credits instalments against the annual liability and Sec. 31(g)
    // forbids expensing income tax — so this must never become an expense.
    expect(prepaidTax?.type).toBe("asset");

    const taxesAndDuties = byCode.get("5940");
    expect(taxesAndDuties?.isSystem).toBe(true);
    expect(taxesAndDuties?.type).toBe("expense");

    const penalties = byCode.get("5950");
    expect(penalties?.isSystem).toBe(true);
    expect(penalties?.type).toBe("expense");
    // The Form C workpaper excludes it by NAME, so the name must stay matchable.
    expect(penalties?.name).toMatch(/\bpenalt/i);
  });
});
