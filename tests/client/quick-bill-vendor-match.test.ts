/**
 * Unit tests for QuickBillDialog's vendor auto-match.
 *
 * Guards the bug where an AI-extracted vendor name was auto-attached to a
 * vendor on a weak substring hit (e.g. "timortelecom".includes("ti") matched an
 * unrelated 2-letter vendor "TI"). Auto-select now requires exact normalized
 * equality; anything weaker returns null so the user confirms.
 */
import { describe, it, expect } from "vitest";
import {
  findSimilarVendors,
  matchVendorByName,
  matchVendorByTaxId,
} from "../../client/lib/money/vendor-match";

const vendors = [
  { id: "v-ti", name: "TI" },
  { id: "v-tt", name: "Timor Telecom" },
  { id: "v-elec", name: "EDTL, E.P." },
];

describe("matchVendorByName", () => {
  it("does NOT match an unrelated short vendor on a substring hit", () => {
    // "timortelecom".includes("ti") — the old behaviour returned the "TI" vendor.
    const match = matchVendorByName(vendors, "timortelecom");
    expect(match?.id).not.toBe("v-ti");
  });

  it("matches on exact normalized equality (ignores case/spacing/punctuation)", () => {
    expect(matchVendorByName(vendors, "timortelecom")?.id).toBe("v-tt");
    expect(matchVendorByName(vendors, "Timor Telecom")?.id).toBe("v-tt");
    expect(matchVendorByName(vendors, "TIMOR  TELECOM")?.id).toBe("v-tt");
    expect(matchVendorByName(vendors, "edtl ep")?.id).toBe("v-elec");
  });

  it("returns null when there is no confident match", () => {
    expect(matchVendorByName(vendors, "Some New Vendor Lda")).toBeNull();
    // A vendor name that only partially overlaps must not auto-select.
    expect(matchVendorByName(vendors, "Timor Telecom Lda")).toBeNull();
  });

  it("returns null for an empty / punctuation-only extracted name", () => {
    expect(matchVendorByName(vendors, "")).toBeNull();
    expect(matchVendorByName(vendors, "   ---   ")).toBeNull();
  });

  it("still matches an exact 2-letter vendor when the name really is that", () => {
    expect(matchVendorByName(vendors, "ti")?.id).toBe("v-ti");
  });
});

/**
 * The same supplier under three spellings produced three vendor records — the
 * corpus has "Primo's Boot", "Primos Boot" and "Primos Boot Unipessoal Lda" —
 * splitting AP history and the withholding facts attached to them.
 */
describe("matchVendorByTaxId", () => {
  const withTins = [
    { id: "v-primos", name: "Primos Boot Unipessoal Lda", tin: "1005236481" },
    { id: "v-tt", name: "Timor Telecom", tin: "1000123456" },
    { id: "v-none", name: "No Tin Vendor" },
  ];

  it("matches the legal entity however the name is spelled on the invoice", () => {
    expect(matchVendorByTaxId(withTins, "1005236481")?.id).toBe("v-primos");
    // Punctuation and spacing vary between documents.
    expect(matchVendorByTaxId(withTins, "1005-236-481")?.id).toBe("v-primos");
    expect(matchVendorByTaxId(withTins, " 1005 236 481 ")?.id).toBe("v-primos");
  });

  it("ignores a tax number too short to identify anyone", () => {
    // A stray digit read off a document must not collapse two vendors into one.
    expect(matchVendorByTaxId([{ id: "v", name: "V", tin: "1" }], "1")).toBeNull();
    expect(matchVendorByTaxId(withTins, "")).toBeNull();
    expect(matchVendorByTaxId(withTins, null)).toBeNull();
  });

  it("returns null when nothing carries that number", () => {
    expect(matchVendorByTaxId(withTins, "9999999999")).toBeNull();
  });
});

describe("findSimilarVendors", () => {
  const existing = [
    { id: "v-primos", name: "Primos Boot Unipessoal Lda" },
    { id: "v-ti", name: "TI" },
    { id: "v-tt", name: "Timor Telecom" },
  ];

  it("offers the same supplier written a different way", () => {
    for (const spelling of ["Primo's Boot", "Primos Boot", "PRIMOS BOOT, UNIP, LDA"]) {
      expect(findSimilarVendors(existing, spelling).map((v) => v.id), spelling)
        .toContain("v-primos");
    }
  });

  it("does not offer an exact match — that is auto-selected already", () => {
    expect(findSimilarVendors(existing, "Primos Boot Unipessoal Lda")).toHaveLength(0);
  });

  it("keeps the old substring bug fixed", () => {
    // "TI" must never be offered for "Timor Telecom".
    expect(findSimilarVendors(existing, "Timor Telecom Lda").map((v) => v.id))
      .not.toContain("v-ti");
    expect(findSimilarVendors(existing, "TI").map((v) => v.id)).not.toContain("v-tt");
  });

  it("does not offer an unrelated supplier", () => {
    expect(findSimilarVendors(existing, "Starlink Timor")).toHaveLength(0);
    expect(findSimilarVendors(existing, "")).toHaveLength(0);
  });

  it("needs a substantial shared word, not just a short one", () => {
    const vendors = [{ id: "a", name: "Casa de Timor" }];
    // "de" alone is not evidence of the same supplier.
    expect(findSimilarVendors(vendors, "de Souza")).toHaveLength(0);
  });
});
