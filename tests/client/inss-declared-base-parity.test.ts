/**
 * INSS declared-remuneration parity — uncapped contribution base.
 *
 * Provenance: a real INSS "Declaração de Remunerações" from the mail corpus,
 * de-identified. The firm declared monthly remuneration bases for expatriate
 * staff of $7,843.08 to $11,891.32 with no ceiling applied — well above the
 * amounts in the payroll parity corpus. This pins that Xefe's INSS (4%
 * employee / 6% employer, DL 20/2017) applies to the full declared base with
 * no cap, matching the firm's actual government declaration.
 */
import { describe, expect, it } from "vitest";
import { calculateINSS } from "@/lib/payroll/calculations-tl";
import { roundMoney } from "@/lib/currency";

// Declared remuneration bases (form column "Remuneração declarada").
const DECLARED_BASES = [7843.08, 11786.4, 8321.7, 11891.32];

describe("INSS declared-remuneration bases (uncapped, from a real DR filing)", () => {
  for (const base of DECLARED_BASES) {
    it(`applies 4%/6% to the full declared base $${base} with no cap`, () => {
      const inss = calculateINSS(base);
      expect(inss.employee).toBe(roundMoney(base * 0.04));
      expect(inss.employer).toBe(roundMoney(base * 0.06));
      // Sanity: a capped regime would clip a five-figure base; Xefe does not.
      expect(inss.employee).toBeGreaterThan(base * 0.04 - 0.01);
    });
  }

  it("aggregates the filing's employer contribution across all four workers", () => {
    const perWorker = DECLARED_BASES.map((b) => roundMoney(b * 0.06));
    const engineTotal = roundMoney(
      DECLARED_BASES.reduce((s, b) => s + calculateINSS(b).employer, 0),
    );
    const expectedTotal = roundMoney(perWorker.reduce((s, v) => s + v, 0));
    // ~$2,390 employer INSS on the ~$39.8k declared payroll — no ceiling.
    expect(engineTotal).toBe(expectedTotal);
    expect(engineTotal).toBeGreaterThan(2000);
  });
});
