import { describe, expect, it } from "vitest";
import { getAgingBucketKey } from "@/lib/reports/aging";

describe("aging report bucket boundaries", () => {
  it.each([
    [-10, "current"],
    [0, "current"],
    [1, "days30"],
    [30, "days30"],
    [31, "days60"],
    [60, "days60"],
    [61, "days90"],
    [90, "days90"],
    [91, "days90Plus"],
  ] as const)("places %s days in %s", (days, expected) => {
    expect(getAgingBucketKey(days)).toBe(expected);
  });
});
