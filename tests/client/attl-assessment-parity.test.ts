/**
 * ATTL assessment parity — government-verified withholding values.
 *
 * Provenance: official ATTL "Aviso de Avaliação" assessment notices for one
 * de-identified taxpayer across four fiscal periods (Dec 2024 – Apr 2025),
 * from the locally held accounting-mail corpus. Each notice states the rent
 * withholding base (form line 65) and the authority's own computed tax
 * (line 70 = LN65 × 10%). These are the tax authority's calculations —
 * the strongest evidence class in the matrix (stronger than practitioner
 * workpapers). Amounts only; no identities.
 */
import { describe, expect, it } from "vitest";
import { calculateTLWithholding } from "@/lib/tax/withholding-tl";
import { calculateIncomeTax } from "@/lib/payroll/calculations-tl";

const ASSESSED: Array<{ period: string; base: number; assessedTax: number }> = [
  { period: "2024-12", base: 33575.23, assessedTax: 3357.52 },
  { period: "2025-01", base: 4619.5, assessedTax: 461.95 },
  { period: "2025-02", base: 12111.11, assessedTax: 1211.11 },
  { period: "2025-04", base: 0, assessedTax: 0 }, // nil month, filed as zero
];

describe("ATTL rent withholding assessments (LN65 × 10% = LN70)", () => {
  for (const { period, base, assessedTax } of ASSESSED) {
    it(`matches the authority's assessment for ${period}`, () => {
      const result = calculateTLWithholding({
        grossAmount: base,
        category: "rent",
        recipientResidence: "resident",
        recipientHasTimorLestePermanentEstablishment: false,
        payerIsIndividual: false,
        taxRegime: "domestic",
      });
      expect(result.rate).toBe(0.1);
      expect(result.taxDue).toBe(assessedTax);
      expect(result.collectionMethod).toBe("payer_withholding");
    });
  }
});

describe("ATTL wage income tax assessments (form line 10 = tax on line 5 wages)", () => {
  it("non-resident: authority ASSESSED flat 10% on $10,450 of wages (Apr 2025)", () => {
    // The submission carried $0; the assessment notice records the authority
    // correcting it to $1,045.00 — the state enforcing the flat rate with no
    // threshold, exactly Xefe's non-resident model.
    expect(calculateIncomeTax(10450, false, "monthly")).toBe(1045);
  });

  it("resident: accepted filing evidences the per-employee threshold (Apr 2025)", () => {
    // Line 5 = $1,200.00 wages, line 10 = $55.00 withheld, accepted as filed.
    // A single-employee calculation would be (1200-500) x 10% = $70 — so the
    // $500/month threshold is applied per employee, not on the aggregate.
    // Xefe computes per employee; a plausible split reproduces the filing:
    expect(calculateIncomeTax(1200, true, "monthly")).toBe(70); // aggregate-as-one ≠ filing
    const split = calculateIncomeTax(1050, true, "monthly") + calculateIncomeTax(150, true, "monthly");
    expect(split).toBe(55); // per-employee math matches the accepted filing
  });
});
