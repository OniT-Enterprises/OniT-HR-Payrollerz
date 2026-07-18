import { describe, expect, it } from "vitest";

import {
  adjustToNextBusinessDayTL,
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
