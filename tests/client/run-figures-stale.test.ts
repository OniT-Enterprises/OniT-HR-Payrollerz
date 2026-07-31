import { describe, expect, it } from "vitest";
import { isRunFiguresStale } from "@/lib/payroll/run-payroll-helpers";

/**
 * Approval-time staleness guard (`assertRunFiguresFresh`).
 *
 * This decision guards a DOUBLE PAYMENT — a run approved with figures that predate
 * another committed run grants the monthly $500 WIT exemption twice, or pays a
 * leaver's Art. 56 severance / Art. 44 subsidio twice. It had no test coverage,
 * because it lived inline in a Firestore-reading service method and CI unit tests
 * run without VITE_FIREBASE_* env. Extracting the decision is what makes these
 * assertions possible at all.
 *
 * The load-bearing property: comparing against the run's OWN build time is what
 * makes it correct for a `processing` run as well as a `draft`. A draft is
 * invisible to the dedup lookups (they start at 'processing') so it needs the
 * check; a processing run is visible, so the SEQUENTIAL case self-corrects and the
 * check must not fire — but CONCURRENCY is uncovered, because the dedup maps are
 * per-client React Query caches with a 5-minute staleTime.
 */

const T = (iso: string) => new Date(`${iso}Z`).getTime();

const base = {
  runId: "run-B",
  periodMonth: "2026-07",
  hasFinalPay: false,
  builtAtMs: T("2026-07-31T10:00:00"),
};

describe("isRunFiguresStale — concurrency vs sequential", () => {
  it("CONCURRENT: flags a run built before the other run committed", () => {
    // Two clients build at almost the same moment; A commits after B was built,
    // so B's figures never saw A. This is the case the draft-only scoping missed.
    expect(
      isRunFiguresStale({
        ...base,
        builtAtMs: T("2026-07-31T10:00:01"),
        committedRuns: [
          {
            id: "run-A",
            periodStart: "2026-07-01",
            committedAtMs: T("2026-07-31T10:00:05"),
          },
        ],
      }),
    ).toBe(true);
  });

  it("SEQUENTIAL: does not flag when the other run committed first", () => {
    // The ordinary case — B was built after A committed, so B's dedup already
    // saw A. Firing here would be pure friction on the normal approval path.
    expect(
      isRunFiguresStale({
        ...base,
        builtAtMs: T("2026-07-31T10:05:00"),
        committedRuns: [
          {
            id: "run-A",
            periodStart: "2026-07-01",
            committedAtMs: T("2026-07-31T10:00:05"),
          },
        ],
      }),
    ).toBe(false);
  });

  it("never flags itself", () => {
    expect(
      isRunFiguresStale({
        ...base,
        committedRuns: [
          {
            id: "run-B", // same id
            periodStart: "2026-07-01",
            committedAtMs: T("2026-07-31T23:59:00"),
          },
        ],
      }),
    ).toBe(false);
  });
});

describe("isRunFiguresStale — scope", () => {
  const later = T("2026-07-31T23:00:00");

  it("without final pay, only the same period MONTH counts (shared $500 threshold)", () => {
    const sameMonth = { id: "x", periodStart: "2026-07-15", committedAtMs: later };
    const otherMonth = { id: "y", periodStart: "2026-06-15", committedAtMs: later };
    expect(isRunFiguresStale({ ...base, committedRuns: [sameMonth] })).toBe(true);
    expect(isRunFiguresStale({ ...base, committedRuns: [otherMonth] })).toBe(false);
  });

  it("WITH final pay, the whole period YEAR counts (Art. 56/44 dedupe per year)", () => {
    const otherMonthSameYear = { id: "y", periodStart: "2026-03-15", committedAtMs: later };
    expect(
      isRunFiguresStale({ ...base, hasFinalPay: true, committedRuns: [otherMonthSameYear] }),
    ).toBe(true);
    // ...but not a different year.
    expect(
      isRunFiguresStale({
        ...base,
        hasFinalPay: true,
        committedRuns: [{ id: "z", periodStart: "2025-03-15", committedAtMs: later }],
      }),
    ).toBe(false);
  });

  it("falls back to payDate when a run has no periodStart", () => {
    expect(
      isRunFiguresStale({
        ...base,
        committedRuns: [{ id: "y", payDate: "2026-07-20", committedAtMs: later }],
      }),
    ).toBe(true);
  });
});

describe("isRunFiguresStale — refuses to guess", () => {
  const later = T("2026-07-31T23:00:00");

  it("a run with no evaluable commit time never blocks an approval", () => {
    // Unknown is not the same as newer. Blocking on absent data would strand a
    // legitimate run with no way for the approver to clear it.
    expect(
      isRunFiguresStale({
        ...base,
        committedRuns: [{ id: "y", periodStart: "2026-07-01", committedAtMs: null }],
      }),
    ).toBe(false);
  });

  it("is inert without a usable build time or period month", () => {
    const other = [{ id: "y", periodStart: "2026-07-01", committedAtMs: later }];
    expect(isRunFiguresStale({ ...base, builtAtMs: 0, committedRuns: other })).toBe(false);
    expect(isRunFiguresStale({ ...base, periodMonth: "", committedRuns: other })).toBe(false);
    expect(isRunFiguresStale({ ...base, periodMonth: "2026-7", committedRuns: other })).toBe(false);
  });

  it("is false when nothing else is committed", () => {
    expect(isRunFiguresStale({ ...base, committedRuns: [] })).toBe(false);
  });

  it("flags if ANY overlapping run committed late, not just the first", () => {
    expect(
      isRunFiguresStale({
        ...base,
        committedRuns: [
          { id: "early", periodStart: "2026-07-01", committedAtMs: T("2026-07-31T09:00:00") },
          { id: "late", periodStart: "2026-07-01", committedAtMs: later },
        ],
      }),
    ).toBe(true);
  });
});
