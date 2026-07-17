import { describe, expect, it } from "vitest";
import {
  getConfiguredPayrollSchedule,
  getDaysUntilIso,
  getInitialPayrollDates,
  getNextPayDateIso,
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
    expect(getNextPayDateIso(schedule, "2026-07-16")).toBe("2026-07-25");
    expect(getNextPayDateIso(schedule, "2026-07-25")).toBe("2026-07-25");
    expect(getNextPayDateIso(schedule, "2026-07-26")).toBe("2026-08-25");
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
      payDate: "2026-07-25",
    });
  });

  it("defaults shorter cycles to fully elapsed days", () => {
    expect(
      getInitialPayrollDates({ frequency: "weekly", payDay: 25 }, "2026-07-16"),
    ).toEqual({
      periodStart: "2026-07-09",
      periodEnd: "2026-07-15",
      payDate: "2026-07-25",
    });
    expect(getDaysUntilIso("2026-07-25", "2026-07-16")).toBe(9);
  });
});
