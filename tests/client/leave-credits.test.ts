import { describe, expect, it } from "vitest";
import { computeLeaveCredits, type LeaveCreditInput } from "@/lib/payroll/run-payroll-helpers";

// Mirror the production wiring: 8h days, weekday counting, annual/sick paid,
// unpaid not, unknown types default to paid. The callback returns the policy's
// paid FRACTION (1 = fully paid, 0 = unpaid, 0.5 = half pay).
const HOURS_PER_DAY = 8;

const payFraction = (leaveType: string) => (leaveType === "unpaid" ? 0 : 1);

// Simple weekday counter (inclusive) matching leaveService.calculateWorkingDays semantics
const workingDays = (start: string, end: string): number => {
  let count = 0;
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (d <= last) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
};

const PERIOD = { start: "2026-06-01", end: "2026-06-30" } as const;

const req = (overrides: Partial<LeaveCreditInput>): LeaveCreditInput => ({
  employeeId: "emp-1",
  leaveType: "annual",
  startDate: "2026-06-08",
  endDate: "2026-06-12",
  ...overrides,
});

const compute = (
  requests: LeaveCreditInput[],
  fraction: (leaveType: string) => number = payFraction,
) =>
  computeLeaveCredits(requests, PERIOD.start, PERIOD.end, HOURS_PER_DAY, fraction, workingDays);

describe("computeLeaveCredits", () => {
  it("credits paid annual leave as hours (Mon-Fri week = 40h)", () => {
    const credits = compute([req({})]); // Jun 8-12 2026 is Mon-Fri
    expect(credits.get("emp-1")).toEqual({ paidLeaveHours: 40, sickDays: 0 });
  });

  it("routes sick leave to sickDays, not paidLeaveHours", () => {
    const credits = compute([req({ leaveType: "sick" })]);
    expect(credits.get("emp-1")).toEqual({ paidLeaveHours: 0, sickDays: 5 });
  });

  it("gives no credit for unpaid leave (stays as absence)", () => {
    const credits = compute([req({ leaveType: "unpaid" })]);
    expect(credits.has("emp-1")).toBe(false);
  });

  it("defaults unknown/custom leave types to paid", () => {
    const credits = compute([req({ leaveType: "study" })]);
    expect(credits.get("emp-1")?.paidLeaveHours).toBe(40);
  });

  it("credits special leave (Art. 33.3 pooled justified absence) as PAID hours", () => {
    // TL_LEAVE_TYPES marks `special` isPaid: true (3 days/year pooled across
    // marriage, family death, and community/religious events), so payroll
    // must credit the hours, not dock them. Jun 10-12 2026 is Wed-Fri.
    const credits = compute([
      req({ leaveType: "special", startDate: "2026-06-10", endDate: "2026-06-12" }),
    ]);
    expect(credits.get("emp-1")).toEqual({
      paidLeaveHours: 3 * HOURS_PER_DAY,
      sickDays: 0,
    });
  });

  it("clamps leave spanning into the period to in-period working days", () => {
    // May 25 – Jun 5: only Jun 1-5 (Mon-Fri) falls inside June
    const credits = compute([req({ startDate: "2026-05-25", endDate: "2026-06-05" })]);
    expect(credits.get("emp-1")?.paidLeaveHours).toBe(5 * HOURS_PER_DAY);
  });

  it("ignores leave entirely outside the period", () => {
    const credits = compute([req({ startDate: "2026-07-01", endDate: "2026-07-03" })]);
    expect(credits.size).toBe(0);
  });

  it("counts a half day as 0.5 days", () => {
    const credits = compute([
      req({ startDate: "2026-06-10", endDate: "2026-06-10", halfDay: true }),
    ]);
    expect(credits.get("emp-1")?.paidLeaveHours).toBe(0.5 * HOURS_PER_DAY);
  });

  it("accumulates multiple requests per employee and keeps employees separate", () => {
    const credits = compute([
      req({ startDate: "2026-06-08", endDate: "2026-06-09" }), // 2 days paid
      req({ leaveType: "sick", startDate: "2026-06-15", endDate: "2026-06-16" }), // 2 sick days
      req({ employeeId: "emp-2", startDate: "2026-06-10", endDate: "2026-06-10" }), // 1 day paid
    ]);
    expect(credits.get("emp-1")).toEqual({ paidLeaveHours: 16, sickDays: 2 });
    expect(credits.get("emp-2")).toEqual({ paidLeaveHours: 8, sickDays: 0 });
  });

  it("skips requests with no employeeId", () => {
    const credits = compute([req({ employeeId: "" })]);
    expect(credits.size).toBe(0);
  });

  it("credits a partially-paid policy by its fraction (50% maternity = half the hours)", () => {
    // Jun 8-12 = 5 working days; at 50% pay only 20 of the 40 hours are
    // credited — the other 20 stay in the absence deduction.
    const credits = compute(
      [req({ leaveType: "maternity" })],
      (leaveType) => (leaveType === "maternity" ? 0.5 : 1),
    );
    expect(credits.get("emp-1")).toEqual({ paidLeaveHours: 20, sickDays: 0 });
  });

  it("treats a zero fraction like unpaid (no credit entry)", () => {
    const credits = compute([req({})], () => 0);
    expect(credits.has("emp-1")).toBe(false);
  });

  it("clamps out-of-range fractions to [0, 1]", () => {
    const credits = compute([req({})], () => 7);
    expect(credits.get("emp-1")?.paidLeaveHours).toBe(40);
  });

  it("sick days are never scaled by the fraction callback (banding owns sick pay)", () => {
    const credits = compute(
      [req({ leaveType: "sick" })],
      () => 0.25,
    );
    expect(credits.get("emp-1")).toEqual({ paidLeaveHours: 0, sickDays: 5 });
  });
});
