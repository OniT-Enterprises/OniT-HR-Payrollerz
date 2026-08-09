import { describe, expect, it } from "vitest";
import { getISODateParts } from "@/lib/dateUtils";

describe("ISO calendar date parts", () => {
  it("keeps fiscal year and month independent of the host timezone", () => {
    expect(getISODateParts("2026-01-01")).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
    expect(getISODateParts("2026-12-31")).toEqual({
      year: 2026,
      month: 12,
      day: 31,
    });
  });

  it("rejects impossible calendar dates", () => {
    expect(() => getISODateParts("2026-02-29")).toThrow("Invalid ISO calendar date");
    expect(() => getISODateParts("01/02/2026")).toThrow("Invalid ISO calendar date");
  });
});
