import { describe, expect, it } from "vitest";

import {
  adjustToNextBusinessDayTL,
  adjustToPreviousBusinessDayTL,
  getTLPublicHolidays,
} from "@/lib/payroll/tl-holidays";
import { getHolidays as getMobileHolidays } from "../../mobile/ekipa/lib/holidays";

describe("Timor-Leste public holidays", () => {
  it("matches the official fixed and announced 2026 calendar", () => {
    const dates = getTLPublicHolidays(2026).map((holiday) => holiday.date);

    expect(dates).toContain("2026-03-20"); // Idul Fitri
    expect(dates).toContain("2026-04-03"); // Good Friday
    expect(dates).toContain("2026-05-27"); // Idul Adha
    expect(dates).toContain("2026-06-04"); // Corpus Christi
    expect(dates).toContain("2026-11-03"); // National Women's Day
    expect(dates).toContain("2026-12-31"); // National Heroes Day
    expect(dates).not.toContain("2026-08-20");
    expect(dates).not.toContain("2026-09-20");
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("keeps Ekipa and web holiday dates identical", () => {
    const web = getTLPublicHolidays(2026).map((holiday) => holiday.date);
    const mobile = getMobileHolidays(2026).map((holiday) => holiday.date);
    expect(mobile).toEqual(web);
  });

  it("moves a deadline on Idul Fitri past the weekend", () => {
    expect(adjustToNextBusinessDayTL("2026-03-20")).toBe("2026-03-23");
  });
});

describe("adjustToPreviousBusinessDayTL (Art. 40(5) payday shifting)", () => {
  it("leaves an ordinary working day unchanged", () => {
    expect(adjustToPreviousBusinessDayTL("2026-07-22")).toBe("2026-07-22"); // Wednesday
  });

  it("moves a Saturday back to Friday", () => {
    expect(adjustToPreviousBusinessDayTL("2026-07-25")).toBe("2026-07-24");
  });

  it("moves a holiday back to the preceding working day", () => {
    // 2026-03-20 is Idul Fitri (a Friday) — pay Thursday the 19th.
    expect(adjustToPreviousBusinessDayTL("2026-03-20")).toBe("2026-03-19");
  });

  it("walks back through weekend + holiday chains", () => {
    // 2026-11-01 All Saints (Sunday) → Sat 31 Oct → Friday 30 Oct.
    expect(adjustToPreviousBusinessDayTL("2026-11-01")).toBe("2026-10-30");
  });

  it("honours tenant holiday overrides", () => {
    expect(
      adjustToPreviousBusinessDayTL("2026-07-25", {
        additionalHolidays: ["2026-07-24"],
      }),
    ).toBe("2026-07-23");
    expect(
      adjustToPreviousBusinessDayTL("2026-12-25", {
        removedHolidays: ["2026-12-25"],
      }),
    ).toBe("2026-12-25"); // Christmas removed → Friday itself is payable
  });
});
