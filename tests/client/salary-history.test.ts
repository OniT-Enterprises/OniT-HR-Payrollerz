import { describe, expect, it } from "vitest";
import {
  addMonths,
  appendSalaryChange,
  monthsBetween,
  recordSalaryChange,
  salaryIncreaseSchedule,
  salaryOnDate,
  salarySegmentsInPeriod,
  stampRetroSettled,
  suggestRetroactivePay,
  timeWeightedMonthlySalary,
  type SalaryChange,
} from "../../client/lib/payroll/salary-history";

/** Raise to $600 from 1 March, recorded late on 28 April. */
const marchRaise: SalaryChange = {
  effectiveFrom: "2026-03-01",
  monthlySalary: 600,
  previousMonthlySalary: 500,
  recordedAt: "2026-04-28T09:00:00.000Z",
};

describe("salaryOnDate", () => {
  it("reports 'current' when no history exists, so callers know it is not a recorded fact", () => {
    expect(salaryOnDate(undefined, 500, "2026-01-15")).toEqual({
      monthlySalary: 500,
      source: "current",
    });
  });

  it("returns the salary in effect, inclusive of the effective date itself", () => {
    expect(salaryOnDate([marchRaise], 600, "2026-03-01")).toEqual({
      monthlySalary: 600,
      source: "recorded",
      effectiveFrom: "2026-03-01",
    });
  });

  it("does not apply a change on the day before it takes effect", () => {
    const basis = salaryOnDate([marchRaise], 600, "2026-02-28");
    expect(basis.monthlySalary).toBe(500);
    expect(basis.source).toBe("before_history");
  });

  it("flags a date preceding all history rather than presenting it as recorded", () => {
    expect(salaryOnDate([marchRaise], 600, "2025-11-01").source).toBe("before_history");
  });

  it("takes the latest applicable change when several have passed", () => {
    const later: SalaryChange = {
      effectiveFrom: "2026-07-01",
      monthlySalary: 700,
      previousMonthlySalary: 600,
      recordedAt: "2026-07-01T00:00:00.000Z",
    };
    expect(salaryOnDate([marchRaise, later], 700, "2026-09-09").monthlySalary).toBe(700);
  });

  it("resolves two changes on the same day to the one recorded later", () => {
    const correction: SalaryChange = {
      effectiveFrom: "2026-03-01",
      monthlySalary: 650,
      previousMonthlySalary: 500,
      recordedAt: "2026-05-02T00:00:00.000Z",
    };
    expect(salaryOnDate([marchRaise, correction], 650, "2026-03-10").monthlySalary).toBe(650);
  });
});

describe("salarySegmentsInPeriod", () => {
  it("returns one segment when nothing changed mid-period", () => {
    const segments = salarySegmentsInPeriod([marchRaise], 600, "2026-04-01", "2026-04-30");
    expect(segments).toHaveLength(1);
    expect(segments[0].monthlySalary).toBe(600);
  });

  it("splits at the effective date, with the earlier segment ending the day before", () => {
    const segments = salarySegmentsInPeriod([marchRaise], 600, "2026-02-15", "2026-03-31");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ from: "2026-02-15", to: "2026-02-28", monthlySalary: 500 });
    expect(segments[1]).toMatchObject({ from: "2026-03-01", to: "2026-03-31", monthlySalary: 600 });
  });

  it("returns nothing for an inverted period", () => {
    expect(salarySegmentsInPeriod([marchRaise], 600, "2026-04-30", "2026-04-01")).toEqual([]);
  });
});

describe("timeWeightedMonthlySalary", () => {
  it("equals the salary itself when it never changed", () => {
    expect(timeWeightedMonthlySalary(undefined, 500, "2026-01-01", "2026-12-31")).toBe(500);
  });

  it("weights by calendar days across a mid-year raise", () => {
    // 2026 is not a leap year: 59 days at $500 (Jan+Feb), 306 at $600.
    const weighted = timeWeightedMonthlySalary([marchRaise], 600, "2026-01-01", "2026-12-31");
    // Each segment is rounded to cents before summing, as money components are
    // everywhere else in the engine: 500 x 59/365 = 80.82 plus
    // 600 x 306/365 = 503.01. Summing first and rounding once would give 583.84.
    expect(weighted).toBe(583.83);
    // Sits strictly between the two rates — the whole point of asking.
    expect(weighted).toBeGreaterThan(500);
    expect(weighted).toBeLessThan(600);
  });
});

describe("salaryIncreaseSchedule", () => {
  it("gives the month each change took effect — the audit deliverable", () => {
    const rows = salaryIncreaseSchedule([marchRaise]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      month: "2026-03",
      from: 500,
      to: 600,
      delta: 100,
      backdated: true,
    });
  });

  it("reports an unknown prior salary as null rather than guessing", () => {
    const rows = salaryIncreaseSchedule([
      { effectiveFrom: "2026-03-01", monthlySalary: 600, recordedAt: "2026-03-01T00:00:00.000Z" },
    ]);
    expect(rows[0].from).toBeNull();
    expect(rows[0].delta).toBeNull();
  });

  it("does not mark a change recorded on its effective date as back-dated", () => {
    const rows = salaryIncreaseSchedule([
      {
        effectiveFrom: "2026-03-01",
        monthlySalary: 600,
        previousMonthlySalary: 500,
        recordedAt: "2026-03-01T08:00:00.000Z",
      },
    ]);
    expect(rows[0].backdated).toBe(false);
  });
});

describe("suggestRetroactivePay", () => {
  it("owes the whole months between the effective date and this period", () => {
    // Raise effective 1 March, first run is April → March alone is in arrears.
    const suggestion = suggestRetroactivePay([marchRaise], 600, "2026-04-01");
    expect(suggestion.amount).toBe(100);
    expect(suggestion.lines).toHaveLength(1);
    expect(suggestion.lines[0]).toMatchObject({ month: "2026-03", amount: 100 });
    expect(suggestion.settles).toHaveLength(1);
  });

  it("accumulates one month's delta per whole month missed", () => {
    const suggestion = suggestRetroactivePay([marchRaise], 600, "2026-06-01");
    expect(suggestion.lines.map((line) => line.month)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
    ]);
    expect(suggestion.amount).toBe(300);
  });

  it("owes nothing for a change effective inside the period being run", () => {
    const suggestion = suggestRetroactivePay([marchRaise], 600, "2026-03-01");
    expect(suggestion.amount).toBe(0);
    expect(suggestion.lines).toEqual([]);
  });

  it("never suggests the same arrears twice once settled", () => {
    const settled: SalaryChange = { ...marchRaise, retroSettledPeriod: "2026-04" };
    expect(suggestRetroactivePay([settled], 600, "2026-05-01").amount).toBe(0);
  });

  it("claws nothing back for a pay cut, but stops re-examining it", () => {
    const cut: SalaryChange = {
      effectiveFrom: "2026-03-01",
      monthlySalary: 400,
      previousMonthlySalary: 500,
      recordedAt: "2026-04-01T00:00:00.000Z",
    };
    const suggestion = suggestRetroactivePay([cut], 400, "2026-05-01");
    expect(suggestion.amount).toBe(0);
    expect(suggestion.settles).toHaveLength(1);
  });

  it("prices only whole months for a mid-month rise and never settles it", () => {
    // Effective 15 March: April is owed in full, March 15-31 is left to the
    // operator. Settling here would bury that part-month for good.
    const midMonth: SalaryChange = {
      effectiveFrom: "2026-03-15",
      monthlySalary: 600,
      previousMonthlySalary: 500,
      recordedAt: "2026-05-02T00:00:00.000Z",
    };
    const suggestion = suggestRetroactivePay([midMonth], 600, "2026-05-01");
    expect(suggestion.lines.map((line) => line.month)).toEqual(["2026-04"]);
    expect(suggestion.partialMonths).toEqual(["2026-03-15"]);
    expect(suggestion.settles).toEqual([]);
  });

  it("owes nothing when no prior salary was ever recorded", () => {
    const suggestion = suggestRetroactivePay(
      [{ effectiveFrom: "2026-03-01", monthlySalary: 600, recordedAt: "2026-04-01T00:00:00.000Z" }],
      600,
      "2026-05-01",
    );
    expect(suggestion.amount).toBe(0);
  });
});

describe("stampRetroSettled", () => {
  it("stamps only the named changes", () => {
    const other: SalaryChange = {
      effectiveFrom: "2026-06-01",
      monthlySalary: 700,
      previousMonthlySalary: 600,
      recordedAt: "2026-06-01T00:00:00.000Z",
    };
    const stamped = stampRetroSettled([marchRaise, other], ["2026-03-01"], "2026-04");
    expect(stamped[0].retroSettledPeriod).toBe("2026-04");
    expect(stamped[1].retroSettledPeriod).toBeUndefined();
  });

  it("keeps the original month when a change is already settled", () => {
    const settled: SalaryChange = { ...marchRaise, retroSettledPeriod: "2026-04" };
    const stamped = stampRetroSettled([settled], ["2026-03-01"], "2026-09");
    expect(stamped[0].retroSettledPeriod).toBe("2026-04");
  });
});

describe("recordSalaryChange", () => {
  const now = "2026-04-28T09:00:00.000Z";

  it("returns null for a first-time salary set", () => {
    expect(recordSalaryChange(undefined, undefined, 500, "2026-01-01", now)).toBeNull();
  });

  it("returns null when the salary did not move", () => {
    expect(recordSalaryChange(undefined, 500, 500, "2026-04-01", now)).toBeNull();
  });

  it("returns null without an effective date, so no meaningless entry is written", () => {
    expect(recordSalaryChange(undefined, 500, 600, "", now)).toBeNull();
  });

  it("rejects a malformed effective date", () => {
    expect(recordSalaryChange(undefined, 500, 600, "01/03/2026", now)).toBeNull();
  });

  it("captures the replaced salary so a later edit cannot re-price paid arrears", () => {
    const history = recordSalaryChange(undefined, 500, 600, "2026-03-01", now);
    expect(history).toHaveLength(1);
    expect(history![0]).toMatchObject({
      effectiveFrom: "2026-03-01",
      monthlySalary: 600,
      previousMonthlySalary: 500,
    });
  });

  it("records a pay cut too", () => {
    const history = recordSalaryChange(undefined, 500, 450, "2026-03-01", now);
    expect(history![0].monthlySalary).toBe(450);
  });

  it("appends to existing history in effective-date order", () => {
    const history = recordSalaryChange([marchRaise], 600, 700, "2026-07-01", now);
    expect(history!.map((change) => change.effectiveFrom)).toEqual([
      "2026-03-01",
      "2026-07-01",
    ]);
  });
});

describe("appendSalaryChange", () => {
  it("keeps history sorted when a change is inserted out of order", () => {
    const history = appendSalaryChange(
      [marchRaise],
      {
        effectiveFrom: "2026-01-01",
        monthlySalary: 500,
        recordedAt: "2026-06-01T00:00:00.000Z",
      },
      600,
    );
    expect(history.map((change) => change.effectiveFrom)).toEqual([
      "2026-01-01",
      "2026-03-01",
    ]);
  });
});

describe("month arithmetic", () => {
  it("counts whole months exclusive of the end month", () => {
    expect(monthsBetween("2026-03", "2026-06")).toBe(3);
    expect(monthsBetween("2026-03", "2026-03")).toBe(0);
    // Never negative: a settled change must not produce negative arrears.
    expect(monthsBetween("2026-06", "2026-03")).toBe(0);
  });

  it("rolls over the year boundary", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-02", -3)).toBe("2025-11");
    expect(monthsBetween("2025-11", "2026-02")).toBe(3);
  });
});
