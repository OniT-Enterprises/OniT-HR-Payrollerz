import { describe, expect, it } from "vitest";
import {
  inclusiveLicenseDays,
  parentalDaysWithRemuneration,
} from "@/lib/pdf/inssParentalDeclaration";

/**
 * DL 18/2017 Art. 25(1)(c): the employer declaration attached to the INSS
 * parental-subsidy claim states the days with remuneration during the
 * license. Default TL posture is zero (the subsidy replaces salary and
 * Art. 21(3) voids it for days the worker receives salary); only a tenant
 * that explicitly configured employer-paid maternity/paternity declares the
 * request's working days.
 */
describe("parentalDaysWithRemuneration", () => {
  const paid = { isPaid: true, paidPercentage: 100 };
  const defaultUnpaid = { isPaid: false, paidPercentage: 0 };

  it("declares zero for the TL default (employer-unpaid) policy", () => {
    expect(parentalDaysWithRemuneration(defaultUnpaid, 60)).toBe(0);
  });

  it("declares zero when no policy is configured at all", () => {
    expect(parentalDaysWithRemuneration(undefined, 60)).toBe(0);
  });

  it("declares the request's working days for an explicit employer-paid policy", () => {
    expect(parentalDaysWithRemuneration(paid, 60)).toBe(60);
  });

  it("declares working days for a partially-paid policy too (any salary voids the subsidy for those days)", () => {
    expect(parentalDaysWithRemuneration({ isPaid: true, paidPercentage: 50 }, 60)).toBe(60);
  });

  it("requires isPaid to be explicitly true, mirroring leavePayFraction", () => {
    // Legacy/odd state: percentage set but isPaid false — payroll pays 0, so
    // the declaration must not claim remunerated days.
    expect(parentalDaysWithRemuneration({ isPaid: false, paidPercentage: 100 }, 60)).toBe(0);
  });

  it("treats isPaid true with 0% as unremunerated", () => {
    expect(parentalDaysWithRemuneration({ isPaid: true, paidPercentage: 0 }, 60)).toBe(0);
  });

  it("never returns negative or non-finite days", () => {
    expect(parentalDaysWithRemuneration(paid, -3)).toBe(0);
    expect(parentalDaysWithRemuneration(paid, Number.NaN)).toBe(0);
  });
});

describe("inclusiveLicenseDays", () => {
  it("counts calendar days inclusive of both endpoints", () => {
    // 12 weeks of maternity license.
    expect(inclusiveLicenseDays("2026-06-01", "2026-08-23")).toBe(84);
  });

  it("counts a single-day license as 1", () => {
    expect(inclusiveLicenseDays("2026-06-10", "2026-06-10")).toBe(1);
  });

  it("includes weekends (a license runs continuously)", () => {
    // Mon 8 June – Sun 14 June = 7 calendar days.
    expect(inclusiveLicenseDays("2026-06-08", "2026-06-14")).toBe(7);
  });

  it("returns 0 for reversed or malformed ranges", () => {
    expect(inclusiveLicenseDays("2026-06-10", "2026-06-09")).toBe(0);
    expect(inclusiveLicenseDays("bad", "2026-06-09")).toBe(0);
    expect(inclusiveLicenseDays("2026-06-10", "")).toBe(0);
  });
});
