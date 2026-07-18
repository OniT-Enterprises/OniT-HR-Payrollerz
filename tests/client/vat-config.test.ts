import { describe, expect, it } from "vitest";
import {
  DEFAULT_VAT_CONFIG,
  isVATConfigOperational,
  type VATConfig,
} from "../../packages/shared/src/lib/vat/vat-config";

function enactedConfig(overrides: Partial<VATConfig> = {}): VATConfig {
  return {
    ...DEFAULT_VAT_CONFIG,
    enabled: true,
    legalStatus: "enacted",
    effectiveDate: "2027-07-01",
    standardRate: 10,
    registrationThreshold: 50_000,
    filingFrequency: "monthly",
    ...overrides,
  };
}

describe("Timor-Leste VAT activation guard", () => {
  it("keeps the current draft configuration inactive", () => {
    expect(isVATConfigOperational(DEFAULT_VAT_CONFIG, "2027-07-01")).toBe(
      false,
    );
  });

  it("does not accept the legacy isActive boolean as legal authority", () => {
    const legacy = { ...enactedConfig(), enabled: false, isActive: true };
    expect(isVATConfigOperational(legacy, "2027-07-01")).toBe(false);
  });

  it("does not activate an enacted configuration before its effective date", () => {
    expect(isVATConfigOperational(enactedConfig(), "2027-06-30")).toBe(false);
  });

  it("refuses an incomplete or zero-rate configuration", () => {
    expect(
      isVATConfigOperational(enactedConfig({ standardRate: 0 }), "2027-07-01"),
    ).toBe(false);
    expect(
      isVATConfigOperational(
        { ...enactedConfig(), requiredInvoiceFields: undefined },
        "2027-07-01",
      ),
    ).toBe(false);
  });

  it("activates only a complete enacted configuration on or after its date", () => {
    expect(isVATConfigOperational(enactedConfig(), "2027-07-01")).toBe(true);
    expect(isVATConfigOperational(enactedConfig(), "2027-07-02")).toBe(true);
  });
});
