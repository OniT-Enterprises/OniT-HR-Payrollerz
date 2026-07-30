import { describe, expect, it } from "vitest";
import {
  finalPayDedupYears,
  runTouchesFinalPayYear,
} from "@/lib/payroll/run-payroll-helpers";

/**
 * Once-only guard for a leaver's final pay: Lei 4/2012 Art. 56 severance and
 * Art. 44 subsidio anual.
 *
 * The two are scoped differently and these helpers only pick the run SET; the
 * netting scope lives in resolveLeaverFinalPay. Art. 44 is a per-civil-year
 * entitlement and may only be netted against the same year. Art. 56 is
 * suppressed by any committed service compensation in the window (whether it is
 * once-per-employment rather than once-per-year is OPEN — gap matrix F20).
 *
 * These helpers back `payrollService.getCommittedFinalPayByEmployee`, which had
 * NO test coverage while being the only thing preventing a leaver's severance or
 * 13th month being paid twice. It shipped keyed on a single civil year taken from
 * periodEnd, so a wage period straddling 1 January looked up the WRONG year and
 * the already-committed December run became invisible.
 *
 * Kept in a Firebase-free module on purpose: CI unit tests run without
 * VITE_FIREBASE_* env, so this logic cannot live in payrollService.ts and be
 * tested.
 */

describe("finalPayDedupYears", () => {
  it("returns the single year for an ordinary within-year period", () => {
    expect(finalPayDedupYears("2026-07-01", "2026-07-31")).toEqual([2026]);
  });

  it("returns BOTH years when the wage period straddles 1 January", () => {
    // The regression: a weekly final run for a 2025-12-31 leaver.
    expect(finalPayDedupYears("2025-12-29", "2026-01-04")).toEqual([2025, 2026]);
  });

  it("is ordered and de-duplicated", () => {
    expect(finalPayDedupYears("2026-01-04", "2026-01-04")).toEqual([2026]);
    const years = finalPayDedupYears("2025-12-31", "2026-01-01");
    expect(years).toEqual([2025, 2026]);
  });

  it("falls back to payDate only when no period is recorded", () => {
    expect(finalPayDedupYears(undefined, undefined, "2026-02-05")).toEqual([2026]);
    // A recorded period always wins over payDate, even when the pay date slips
    // into the next civil year (a December run paid on 5 January).
    expect(finalPayDedupYears("2025-12-01", "2025-12-31", "2026-01-05")).toEqual([
      2025,
    ]);
  });

  it("returns nothing usable when every date is missing or malformed", () => {
    expect(finalPayDedupYears(undefined, undefined)).toEqual([]);
    expect(finalPayDedupYears("", "", "")).toEqual([]);
    expect(finalPayDedupYears("nope", "also-nope")).toEqual([]);
  });
});

describe("runTouchesFinalPayYear", () => {
  const decemberRun = { periodStart: "2025-12-01", periodEnd: "2025-12-31" };

  it("REGRESSION: a December run is visible from a period ending in January", () => {
    // The double-payment path. The final run's period is 2025-12-29 → 2026-01-04
    // for a leaver whose last day was 2025-12-31, whose subsidio was already
    // paid on the December run. Keyed on periodEnd's year alone (2026) the
    // December run is invisible and the whole 13th month is paid a second time.
    const straddling = finalPayDedupYears("2025-12-29", "2026-01-04");
    expect(runTouchesFinalPayYear(decemberRun, straddling)).toBe(true);

    // Proof the old single-year key was the defect, not the predicate:
    expect(runTouchesFinalPayYear(decemberRun, [2026])).toBe(false);
  });

  it("still finds a New-Year-spanning run from either side of the boundary", () => {
    const spanning = { periodStart: "2025-12-29", periodEnd: "2026-01-04" };
    expect(runTouchesFinalPayYear(spanning, [2025])).toBe(true);
    expect(runTouchesFinalPayYear(spanning, [2026])).toBe(true);
  });

  it("does not match an unrelated year", () => {
    expect(runTouchesFinalPayYear(decemberRun, [2024])).toBe(false);
    expect(runTouchesFinalPayYear(decemberRun, [2027])).toBe(false);
  });

  it("falls back to payDate for a run with no periodStart", () => {
    expect(
      runTouchesFinalPayYear({ payDate: "2026-01-05", periodEnd: null }, [2026]),
    ).toBe(true);
    expect(
      runTouchesFinalPayYear({ payDate: "2026-01-05", periodEnd: null }, [2025]),
    ).toBe(false);
  });

  it("matches nothing when the year set is empty", () => {
    // A run with no evaluable dates must never silently suppress a payment.
    expect(runTouchesFinalPayYear(decemberRun, [])).toBe(false);
  });
});
