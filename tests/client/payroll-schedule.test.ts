import { describe, expect, it } from "vitest";
import {
  getConfiguredPayrollSchedule,
  getDaysUntilIso,
  getInitialPayrollDates,
  getNextPayDateIso,
  isPayIntervalExceeded,
} from "../../client/lib/payroll/payroll-schedule";

describe("payroll schedule", () => {
  it("uses the active saved period's day for the supported monthly schedule", () => {
    expect(
      getConfiguredPayrollSchedule({
        payrollFrequencies: ["monthly"],
        payrollPeriods: [
          {
            frequency: "monthly",
            startDay: 1,
            endDay: 31,
            payDay: 25,
            isActive: false,
          },
          {
            frequency: "bi_weekly",
            startDay: 1,
            endDay: 14,
            payDay: 20,
            isActive: true,
          },
        ],
      }),
    ).toEqual({ frequency: "monthly", payDay: 20 });
  });

  it("falls back safely when settings are missing or invalid", () => {
    expect(getConfiguredPayrollSchedule(undefined)).toEqual({
      frequency: "monthly",
      payDay: 25,
    });
    expect(
      getConfiguredPayrollSchedule({
        payrollFrequencies: ["weekly"],
        payrollPeriods: [
          {
            frequency: "weekly",
            startDay: 1,
            endDay: 7,
            payDay: 31,
            isActive: true,
          },
        ],
      }),
    ).toEqual({ frequency: "monthly", payDay: 28 });
  });

  it("uses this month's payday until it passes", () => {
    const schedule = { frequency: "monthly" as const, payDay: 25 };
    // 2026-07-25 is a Saturday — Art. 40(5) moves payday to Friday 24th.
    expect(getNextPayDateIso(schedule, "2026-07-16")).toBe("2026-07-24");
    expect(getNextPayDateIso(schedule, "2026-07-24")).toBe("2026-07-24");
    // On the raw payday itself (Sat) the legal payday already passed — next cycle.
    expect(getNextPayDateIso(schedule, "2026-07-25")).toBe("2026-08-25");
    expect(getNextPayDateIso(schedule, "2026-07-26")).toBe("2026-08-25");
    // 2026-08-25 is a Tuesday — no adjustment.
    expect(getNextPayDateIso(schedule, "2026-08-01")).toBe("2026-08-25");
  });

  it("moves a payday on a public holiday to the preceding working day (Art. 40(5))", () => {
    const schedule = { frequency: "monthly" as const, payDay: 25 };
    // 2026-12-25 is Christmas (a Friday) — pay Thursday the 24th.
    expect(getNextPayDateIso(schedule, "2026-12-20")).toBe("2026-12-24");
  });

  it("defaults monthly runs to the month preceding payday", () => {
    expect(
      getInitialPayrollDates(
        { frequency: "monthly", payDay: 25 },
        "2026-07-16",
      ),
    ).toEqual({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      payDate: "2026-07-24", // Sat 25th shifted back to Friday
    });
  });

  it("keeps the covered month anchored to the configured payday when the pay date shifts across a month boundary", () => {
    // Payday on the 1st: 2026-08-01 is a Saturday, so payment moves back to
    // Friday 2026-07-31 — but the run still covers July, not June.
    expect(
      getInitialPayrollDates({ frequency: "monthly", payDay: 1 }, "2026-07-28"),
    ).toEqual({
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      payDate: "2026-07-31",
    });
  });

  it("defaults shorter cycles to fully elapsed days", () => {
    expect(
      getInitialPayrollDates({ frequency: "weekly", payDay: 25 }, "2026-07-16"),
    ).toEqual({
      periodStart: "2026-07-09",
      periodEnd: "2026-07-15",
      payDate: "2026-07-24", // Sat 25th shifted back to Friday
    });
    expect(getDaysUntilIso("2026-07-25", "2026-07-16")).toBe(9);
  });

  it("flags a pay interval over one month as exceeded (Art. 40(3))", () => {
    expect(isPayIntervalExceeded("2026-06-25", "2026-07-24")).toBe(false);
    expect(isPayIntervalExceeded("2026-06-25", "2026-07-25")).toBe(false);
    expect(isPayIntervalExceeded("2026-06-25", "2026-07-26")).toBe(true);
    expect(isPayIntervalExceeded("2026-06-25", "2026-09-01")).toBe(true);
    // Month-end overflow rolls forward (Jan 31 + 1 month → Mar 3), granting a
    // few days of grace rather than flagging early.
    expect(isPayIntervalExceeded("2026-01-31", "2026-03-02")).toBe(false);
    expect(isPayIntervalExceeded("2026-01-31", "2026-03-04")).toBe(true);
    // Malformed input fails safe (no false alarm).
    expect(isPayIntervalExceeded("", "2026-07-26")).toBe(false);
  });
});
