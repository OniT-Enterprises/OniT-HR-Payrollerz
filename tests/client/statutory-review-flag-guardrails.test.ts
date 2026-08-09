/**
 * Every screen that generates a statutory filing must handle an incomplete
 * source record the same way.
 *
 * A real production alert on 2026-08-09 is why this exists: a tenant with a
 * blank `companyDetails.registeredAddress` clicked Generate on Monthly WIT.
 * The engine did the right thing — `MissingStatutorySourceDataError`, because
 * Xefe refuses to invent an employer address on a government filing — but the
 * WIT page showed a generic "could not generate" toast that never said which
 * fact was missing, and `console.error`d it, so an incomplete tenant record
 * arrived as a high-priority Sentry error.
 *
 * The INSS page had already solved this with `getStatutoryReviewFlag`. That is
 * the drift this pins shut: same primitive, two screens, one of them wrong.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(repoRoot, p), "utf8");

/** Screens that call a statutory return generator and can therefore throw. */
const STATUTORY_FILING_PAGES = [
  "client/pages/reports/ATTLMonthlyWIT.tsx",
  "client/pages/reports/INSSMonthly.tsx",
];

describe("statutory filing screens", () => {
  it("names the missing record fact instead of a generic failure", () => {
    for (const path of STATUTORY_FILING_PAGES) {
      const source = read(path);
      expect(source, `${path} must import the classifier`).toContain(
        "getStatutoryReviewFlag",
      );
      expect(source, `${path} must offer the review copy`).toContain(
        "common.needsReviewTitle",
      );
      expect(source, `${path} must name the field`).toContain(
        "{ field: reviewFlag.field }",
      );
      // An employer fact is fixed in Settings, a payroll fact by re-running
      // payroll. Sending someone to "re-run that payroll" over a blank
      // registered address is the bug this whole file exists for.
      expect(
        source,
        `${path} must route the copy by reviewFlag.source`,
      ).toContain('reviewFlag.source === "employer"');
      expect(source, `${path} must offer the employer copy`).toContain(
        "common.needsReviewEmployerDesc",
      );
    }
  });

  it("keeps incomplete tenant data out of the error tracker", () => {
    // client/main.tsx wires console.error to Sentry, so a data-completeness
    // guard must not go through it. Every catch that classifies a review flag
    // has to branch before logging.
    for (const path of STATUTORY_FILING_PAGES) {
      const source = read(path);
      const flagChecks = source.match(/getStatutoryReviewFlag\(error\)/g) ?? [];
      expect(flagChecks.length, `${path} should classify every catch`).toBeGreaterThan(0);

      // Each classified catch must log the review case as a warning, not an error.
      const warnings = source.match(/console\.warn\("Statutory/g) ?? [];
      expect(
        warnings.length,
        `${path}: every review-flag branch needs a console.warn, not console.error`,
      ).toBe(flagChecks.length);
    }
  });

  it("still reports genuinely unexpected failures as errors", () => {
    // The branch must be a branch — an unclassified error keeps reaching Sentry.
    for (const path of STATUTORY_FILING_PAGES) {
      expect(read(path), `${path} must keep an else-branch console.error`).toMatch(
        /} else \{\s*console\.error\(/,
      );
    }
  });
});
