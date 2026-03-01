import { describe, expect, it } from "vitest";
import {
  getDaysUntilDueIso,
  getNextAnnualAdjustedDeadline,
  getNextMonthlyAdjustedDeadline,
  getUrgencyFromDays,
  resolveTaskStatus,
} from "@/lib/tax/compliance";

const identityAdjust = (isoDate: string) => isoDate;

const pad2 = (value: number): string => String(value).padStart(2, "0");

describe("Tax compliance deadline helpers", () => {
  it("keeps monthly deadline in current month when today is due day", () => {
    expect(getNextMonthlyAdjustedDeadline("2026-01-15", 15, identityAdjust)).toBe("2026-01-15");
  });

  it("moves monthly deadline to next month when due day already passed", () => {
    expect(getNextMonthlyAdjustedDeadline("2026-01-16", 15, identityAdjust)).toBe("2026-02-15");
  });

  it("keeps annual deadline in current year when today is before adjusted deadline", () => {
    expect(getNextAnnualAdjustedDeadline("2026-12-01", 12, 20, identityAdjust)).toBe("2026-12-20");
  });

  it("moves annual deadline to next year when current-year deadline is passed", () => {
    expect(getNextAnnualAdjustedDeadline("2026-12-21", 12, 20, identityAdjust)).toBe("2027-12-20");
  });

  it("rolls weekend monthly deadlines to next business day", () => {
    const todayIso = "2026-02-01";
    let weekendDay: number | null = null;

    for (let day = 1; day <= 28; day++) {
      const weekday = new Date(Date.UTC(2026, 1, day)).getUTCDay();
      if (weekday === 0 || weekday === 6) {
        weekendDay = day;
        break;
      }
    }

    expect(weekendDay).not.toBeNull();
    const baseIso = `2026-02-${pad2(weekendDay!)}`;
    const adjustedIso = getNextMonthlyAdjustedDeadline(todayIso, weekendDay!);
    const adjustedWeekday = new Date(`${adjustedIso}T00:00:00Z`).getUTCDay();

    expect(adjustedIso >= baseIso).toBe(true);
    expect(adjustedWeekday).not.toBe(0);
    expect(adjustedWeekday).not.toBe(6);
  });
});

describe("Tax compliance status helpers", () => {
  it("computes urgency from days until due", () => {
    expect(getUrgencyFromDays(12)).toBe("ok");
    expect(getUrgencyFromDays(5)).toBe("warning");
    expect(getUrgencyFromDays(2)).toBe("urgent");
    expect(getUrgencyFromDays(-1)).toBe("urgent");
  });

  it("resolves task status with explicit filed override", () => {
    expect(resolveTaskStatus({ explicitStatus: "filed", daysUntilDue: -10 })).toBe("filed");
  });

  it("resolves task status from legacy filed for backward compatibility", () => {
    expect(resolveTaskStatus({ legacyStatus: "filed", daysUntilDue: -2 })).toBe("filed");
  });

  it("resolves pending/overdue tasks from due date when not filed", () => {
    expect(resolveTaskStatus({ explicitStatus: "pending", daysUntilDue: 4 })).toBe("pending");
    expect(resolveTaskStatus({ explicitStatus: "pending", daysUntilDue: -1 })).toBe("overdue");
  });

  it("computes day difference in TL-safe ISO space", () => {
    expect(getDaysUntilDueIso("2026-03-01", "2026-03-01")).toBe(0);
    expect(getDaysUntilDueIso("2026-03-01", "2026-03-05")).toBe(4);
    expect(getDaysUntilDueIso("2026-03-05", "2026-03-01")).toBe(-4);
  });
});
