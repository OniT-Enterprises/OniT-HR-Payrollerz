import { describe, expect, it } from "vitest";
import {
  calculateTLPayroll,
  calculateSubsidioAnual,
  type TLPayrollInput,
} from "@/lib/payroll/calculations-tl";
import { calculateProRataHours } from "@/lib/payroll/run-payroll-helpers";
import { TL_WORKING_HOURS } from "@/lib/payroll/constants-tl";
import { maxMoney, subtractMoney } from "@/lib/currency";
import {
  resolveLeaverFinalPay,
  severanceDefaultForReason,
} from "@/lib/payroll/leaver-final-pay";

/**
 * REAL-LIFE SCENARIO: mid-period termination / final-pay run (KEY = termination-payroll)
 *
 * A Dili security firm terminates a guard, Abílio Ximenes, effective
 * 2026-09-15 (15 of 30 days of the September period). His final payroll run
 * must contain, per TL law:
 *  - prorated wages for the fraction of the period actually worked
 *    (booked as absence against the full-month baseline — same mechanism
 *    as mid-period hires, see rl-prorata-hire),
 *  - Art. 56 service compensation (1 month per completed 5-year block),
 *  - the Art. 44 prorated subsidio anual for the termination year, net of
 *    any 13th month already paid this year.
 *
 * The wizard seeds these via employee.terminationDate: the roster includes
 * in-period leavers, calculateProRataHours prorates BOTH employment edges,
 * and the engine input carries terminationDate so service_compensation fires.
 */

const PERIOD_START = "2026-09-01";
const PERIOD_END = "2026-09-30"; // 30-day month → clean half at Sept 15
const FULL_MONTHLY_HOURS = (TL_WORKING_HOURS.standardWeeklyHours * 52) / 12;

const ABILIO_HIRE = "2019-06-01"; // 7+ years service → one completed 5-yr block
const ABILIO_TERMINATION = "2026-09-15";

function baseInput(overrides: Partial<TLPayrollInput>): TLPayrollInput {
  return {
    employeeId: "abilio",
    monthlySalary: 600,
    payFrequency: "monthly",
    isHourly: false,
    hourlyRate: undefined,
    regularHours: FULL_MONTHLY_HOURS,
    overtimeHours: 0,
    nightShiftHours: 0,
    holidayHours: 0,
    restDayHours: 0,
    absenceHours: 0,
    lateArrivalMinutes: 0,
    sickDaysUsed: 0,
    ytdSickDaysUsed: 0,
    bonus: 0,
    bonusINSSCategory: null,
    commission: 0,
    perDiem: 0,
    foodAllowance: 0,
    transportAllowance: 0,
    otherEarnings: 0,
    nonCashBenefits: 0,
    nonCashBenefitINSSCategory: null,
    taxInfo: { isResident: true, hasTaxExemption: false, inssExempt: false },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: 0,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 9,
    hireDate: ABILIO_HIRE,
    ...overrides,
  };
}

describe("real-life: mid-period termination final pay (termination-payroll)", () => {
  it("calculateProRataHours prorates the END edge: leaver keeps ~half the hours", () => {
    const hours = calculateProRataHours(
      ABILIO_HIRE,
      PERIOD_START,
      PERIOD_END,
      FULL_MONTHLY_HOURS,
      ABILIO_TERMINATION,
    );
    // Sept 1–15 = 15 of 30 days → half of 190.6667 ≈ 95.33.
    expect(hours).toBeCloseTo(FULL_MONTHLY_HOURS / 2, 1);
  });

  it("calculateProRataHours edge cases: ended before period → 0; ends after period → full; both edges", () => {
    // Terminated before the period even starts — not employed at all.
    expect(
      calculateProRataHours(
        ABILIO_HIRE,
        PERIOD_START,
        PERIOD_END,
        FULL_MONTHLY_HOURS,
        "2026-08-20",
      ),
    ).toBe(0);
    // Termination after period end — normal full period.
    expect(
      calculateProRataHours(
        ABILIO_HIRE,
        PERIOD_START,
        PERIOD_END,
        FULL_MONTHLY_HOURS,
        "2026-10-15",
      ),
    ).toBeCloseTo(FULL_MONTHLY_HOURS, 4);
    // No end date — unchanged hire-only behaviour.
    expect(
      calculateProRataHours(
        ABILIO_HIRE,
        PERIOD_START,
        PERIOD_END,
        FULL_MONTHLY_HOURS,
      ),
    ).toBeCloseTo(FULL_MONTHLY_HOURS, 4);
    // Hired AND terminated inside the same period (Sept 6 – Sept 20 = 15 days).
    expect(
      calculateProRataHours(
        "2026-09-06",
        PERIOD_START,
        PERIOD_END,
        FULL_MONTHLY_HOURS,
        "2026-09-20",
      ),
    ).toBeCloseTo(FULL_MONTHLY_HOURS / 2, 1);
  });

  it("terminationDate fires Art. 56 service compensation: WIT-taxable, NOT INSS-able", () => {
    // 2019-06-01 → 2026-09-15 = 7 completed years = one 5-yr block = 1 month.
    const result = calculateTLPayroll(
      baseInput({ terminationDate: ABILIO_TERMINATION }),
    );
    expect(result.serviceCompensation).toBeCloseTo(600, 2);
    const line = result.earnings.find((e) => e.type === "service_compensation");
    expect(line).toBeDefined();
    expect(line!.isTaxable).toBe(true);
    expect(line!.isINSSBase).toBe(false); // not the DL 30/2021 indemnity

    // It raises gross and the WIT base but never the INSS base.
    const without = calculateTLPayroll(baseInput({}));
    expect(subtractMoney(result.grossPay, without.grossPay)).toBeCloseTo(
      600,
      2,
    );
    expect(result.inssBase).toBeCloseTo(without.inssBase, 2);
  });

  it("leaver subsidio: Art. 44 prorated to the termination month, netted against YTD paid", () => {
    // Entitlement: Jan..Sep = 9/12 of $600 = $450.
    const entitled = calculateSubsidioAnual(
      600,
      ABILIO_HIRE,
      new Date(`${ABILIO_TERMINATION}T00:00:00`),
      { terminationDate: ABILIO_TERMINATION },
    );
    expect(entitled).toBeCloseTo(450, 2);

    // The wizard nets what payroll already paid this year (ytdSubsidioAnual):
    // nothing paid → full $450; $450 paid → $0; overpaid → clamped at 0.
    const net = (paid: number) => maxMoney(0, subtractMoney(entitled, paid));
    expect(net(0)).toBeCloseTo(450, 2);
    expect(net(450)).toBe(0);
    expect(net(600)).toBe(0);

    // And the netted amount flows through payroll as a normal subsidio line.
    const result = calculateTLPayroll(
      baseInput({ terminationDate: ABILIO_TERMINATION, subsidioAnual: net(0) }),
    );
    expect(result.subsidioAnual).toBeCloseTo(450, 2);
  });

  it("full final-pay run reconciles: half wages + severance + subsidio − statutory = net", () => {
    // Mirror the wizard seeding: full baseline hours, unworked half booked as
    // absence (rl-prorata-hire mechanism), plus both termination items.
    const halfAbsence = Number(
      (
        FULL_MONTHLY_HOURS -
        calculateProRataHours(
          ABILIO_HIRE,
          PERIOD_START,
          PERIOD_END,
          FULL_MONTHLY_HOURS,
          ABILIO_TERMINATION,
        )
      ).toFixed(2),
    );
    const result = calculateTLPayroll(
      baseInput({
        terminationDate: ABILIO_TERMINATION,
        subsidioAnual: 450,
        absenceHours: halfAbsence,
      }),
    );

    // Wages ≈ $300 (half month) — absence dock hits wagesPaid.
    expect(result.absenceDeduction).toBeGreaterThan(0);
    expect(result.wagesPaid).toBeCloseTo(300 + 600 + 450, 0); // wages + severance + subsidio
    // Line items sum exactly to net pay (payslip reconciliation) — the
    // absence dock is itself a deduction line item, so no extra subtraction.
    const earningsTotal = result.earnings
      .filter((e) => e.isCash !== false)
      .reduce((sum, e) => sum + e.amount, 0);
    const deductionsTotal = result.deductions.reduce(
      (sum, d) => sum + d.amount,
      0,
    );
    expect(result.netPay).toBeCloseTo(earningsTotal - deductionsTotal, 1);
    expect(result.netPay).toBeGreaterThan(0);
  });
});

describe("resolveLeaverFinalPay: exact-once idempotency", () => {
  const common = {
    monthlySalary: 600,
    hireDate: ABILIO_HIRE,
    asOfDate: new Date("2026-09-30T00:00:00"),
    includeSubsidioAnual: false,
    subsidioConfig: { proRataForNewEmployees: true },
  };

  it("first final run: fires severance and pays the full prorated subsidio", () => {
    const r = resolveLeaverFinalPay({
      ...common,
      inPeriodTermination: ABILIO_TERMINATION,
      severanceEntitled: true,
      committed: { serviceCompensation: 0, subsidioAnual: 0 },
    });
    expect(r.terminationDate).toBe(ABILIO_TERMINATION); // severance WILL fire
    expect(r.subsidioAnual).toBeCloseTo(450, 2); // Jan..Sep = 9/12
  });

  it("second run over the same period: severance suppressed, subsidio netted to 0", () => {
    const r = resolveLeaverFinalPay({
      ...common,
      inPeriodTermination: ABILIO_TERMINATION,
      severanceEntitled: true,
      // The first run already recorded these amounts.
      committed: { serviceCompensation: 600, subsidioAnual: 450 },
    });
    expect(r.terminationDate).toBeUndefined(); // NO second severance
    expect(r.subsidioAnual).toBe(0); // NO second subsidio
  });

  it("partial prior subsidio (annual run before termination) is topped up, not doubled", () => {
    const r = resolveLeaverFinalPay({
      ...common,
      inPeriodTermination: ABILIO_TERMINATION,
      severanceEntitled: true,
      committed: { serviceCompensation: 0, subsidioAnual: 200 },
    });
    expect(r.terminationDate).toBe(ABILIO_TERMINATION);
    expect(r.subsidioAnual).toBeCloseTo(250, 2); // 450 entitlement − 200 already paid
  });

  it("non-leaver: no severance; subsidio follows the run toggle only", () => {
    const off = resolveLeaverFinalPay({
      ...common,
      inPeriodTermination: null,
      committed: { serviceCompensation: 0, subsidioAnual: 0 },
    });
    expect(off.terminationDate).toBeUndefined();
    expect(off.subsidioAnual).toBe(0);

    const on = resolveLeaverFinalPay({
      ...common,
      includeSubsidioAnual: true,
      inPeriodTermination: null,
      committed: { serviceCompensation: 0, subsidioAnual: 0 },
    });
    expect(on.terminationDate).toBeUndefined();
    expect(on.subsidioAnual).toBeCloseTo(600, 2); // full-year employee, full month
  });
});

describe("resolveLeaverFinalPay: which committed subsidio discharges this leaver", () => {
  // Art. 44 is a per-civil-year entitlement, but a wage period straddling
  // 1 January touches TWO years and a payroll record does not say which year its
  // subsidio was computed for. Both naive keys are wrong in one direction:
  //   - year-agnostic netting paid a JANUARY leaver $0 of a subsidio they were owed;
  //   - keying each run on its periodEnd year then re-paid a DECEMBER leaver's
  //     subsidio in full, because the run was filed under the later year while the
  //     lookup asked for the earlier one.
  // The rule is a predicate over (run period, termination date) — see
  // committedSubsidioDischarging. These use the shape the SERVICE actually
  // returns (subsidioAnualByRun), not a hand-made per-year map.
  const base = {
    monthlySalary: 600,
    hireDate: "2019-03-01",
    includeSubsidioAnual: false,
    subsidioConfig: { proRataForNewEmployees: true },
    severanceEntitled: true,
  };
  const decemberAnnualRun = {
    periodStart: "2025-12-01",
    periodEnd: "2025-12-31",
    payDate: "2025-12-19",
    amount: 600,
  };
  // The final run itself, straddling 1 January.
  const straddlingFinalRun = {
    periodStart: "2025-12-20",
    periodEnd: "2026-01-01",
    payDate: "2026-01-02",
    amount: 600,
  };

  it("REGRESSION: a December leaver's straddling final run is netted, not re-paid", () => {
    // Run A (straddling) already paid this leaver's full 2025 subsidio. A second
    // run covering the same last working day must pay $0 more. Keyed on run
    // periodEnd (2026) against a 2025 termination this returned the full $600 again.
    const r = resolveLeaverFinalPay({
      ...base,
      asOfDate: new Date("2026-01-05T00:00:00"),
      inPeriodTermination: "2025-12-31",
      committed: {
        serviceCompensation: 600,
        subsidioAnual: 600,
        subsidioAnualByRun: [straddlingFinalRun],
      },
    });
    expect(r.terminationDate).toBeUndefined(); // Art. 56 suppressed
    expect(r.subsidioAnual).toBe(0); // and NO second 13th month
  });

  it("pays a January leaver their new-year subsidio despite last year's being committed", () => {
    // The December 2025 annual run sits entirely in 2025, so it discharges 2025 —
    // never this leaver's 2026 entitlement.
    const r = resolveLeaverFinalPay({
      ...base,
      asOfDate: new Date("2026-01-04T00:00:00"),
      inPeriodTermination: "2026-01-02",
      committed: {
        serviceCompensation: 0,
        subsidioAnual: 600,
        subsidioAnualByRun: [decemberAnnualRun],
      },
    });
    expect(r.subsidioAnual).toBeCloseTo(50, 2); // 1/12 of $600 for January
  });

  it("nets an ordinary same-year payout made earlier in the termination year", () => {
    // An early/annual payout whose period lies wholly inside the termination year
    // discharges that year even though it does not cover the last working day.
    const r = resolveLeaverFinalPay({
      ...base,
      asOfDate: new Date("2026-11-30T00:00:00"),
      inPeriodTermination: "2026-11-30",
      committed: {
        serviceCompensation: 0,
        subsidioAnual: 600,
        subsidioAnualByRun: [
          { periodStart: "2026-06-01", periodEnd: "2026-06-30", payDate: "2026-06-19", amount: 600 },
        ],
      },
    });
    expect(r.subsidioAnual).toBe(0);
  });

  it("does NOT net a straddling run against an unrelated later leaver", () => {
    // The straddling run touches 2026, but it neither covers this leaver's last day
    // nor lies wholly inside 2026, so it cannot discharge their 2026 entitlement.
    const r = resolveLeaverFinalPay({
      ...base,
      asOfDate: new Date("2026-06-30T00:00:00"),
      inPeriodTermination: "2026-06-30",
      committed: {
        serviceCompensation: 0,
        subsidioAnual: 600,
        subsidioAnualByRun: [straddlingFinalRun],
      },
    });
    expect(r.subsidioAnual).toBeCloseTo(300, 2); // 6/12 of $600
  });

  it("tops up a partial same-period payout instead of doubling it", () => {
    const r = resolveLeaverFinalPay({
      ...base,
      asOfDate: new Date("2026-09-30T00:00:00"),
      inPeriodTermination: "2026-09-30",
      committed: {
        serviceCompensation: 0,
        subsidioAnual: 200,
        subsidioAnualByRun: [
          { periodStart: "2026-09-01", periodEnd: "2026-09-30", payDate: "2026-09-19", amount: 200 },
        ],
      },
    });
    expect(r.subsidioAnual).toBeCloseTo(250, 2); // 450 entitlement - 200 committed
  });

  it("suppresses Art. 56 on committed service compensation from ANY run", () => {
    // Severance stays year-agnostic on purpose: a second run over the same
    // straddling period must never re-pay it.
    const r = resolveLeaverFinalPay({
      ...base,
      asOfDate: new Date("2026-01-04T00:00:00"),
      inPeriodTermination: "2026-01-02",
      committed: {
        serviceCompensation: 600,
        subsidioAnual: 0,
        subsidioAnualByRun: [],
      },
    });
    expect(r.terminationDate).toBeUndefined();
    expect(r.subsidioAnual).toBeCloseTo(50, 2); // subsidio still owed
  });

  it("REHIRE: does not net the previous engagement's subsidio against the new one", () => {
    // Every other case here uses one continuous hireDate, which is exactly why
    // this went unnoticed. Xefe's rehire action moves hireDate to the new start
    // date, so calculateSubsidioAnual prorates the entitlement from THERE — and
    // the netting has to be scoped the same way. Otherwise the worker loses the
    // earlier months from the entitlement AND has the earlier payment subtracted.
    //
    // $600/month, originally hired 2019-03-01. Worked Jan-Mar 2026 and was paid
    // 3/12 = $150 on the March run. Rehired 2026-07-01, leaves again 2026-10-31.
    const r = resolveLeaverFinalPay({
      monthlySalary: 600,
      hireDate: "2026-07-01", // moved by the rehire
      engagementStart: "2026-07-01",
      asOfDate: new Date("2026-10-31T00:00:00"),
      includeSubsidioAnual: false,
      subsidioConfig: { proRataForNewEmployees: true },
      inPeriodTermination: "2026-10-31",
      severanceEntitled: true,
      committed: {
        serviceCompensation: 0,
        subsidioAnual: 150,
        subsidioAnualByRun: [
          // First engagement's final pay — wholly before the new hire date.
          { periodStart: "2026-03-01", periodEnd: "2026-03-31", payDate: "2026-03-19", amount: 150 },
        ],
      },
    });
    // Jul-Oct = 4/12 of $600, with nothing from the old engagement netted off.
    expect(r.subsidioAnual).toBeCloseTo(200, 2);
    // $150 (first engagement) + $200 = $350 = 7/12 for the 7 months actually
    // worked in 2026. Netting the $150 again paid $50 here, i.e. $200 total.
  });

  it("REHIRE: still nets a payment made inside the CURRENT engagement", () => {
    const r = resolveLeaverFinalPay({
      monthlySalary: 600,
      hireDate: "2026-07-01",
      engagementStart: "2026-07-01",
      asOfDate: new Date("2026-10-31T00:00:00"),
      includeSubsidioAnual: false,
      subsidioConfig: { proRataForNewEmployees: true },
      inPeriodTermination: "2026-10-31",
      severanceEntitled: true,
      committed: {
        serviceCompensation: 0,
        subsidioAnual: 250,
        subsidioAnualByRun: [
          { periodStart: "2026-03-01", periodEnd: "2026-03-31", amount: 150 }, // old engagement
          { periodStart: "2026-09-01", periodEnd: "2026-09-30", amount: 100 }, // this engagement
        ],
      },
    });
    expect(r.subsidioAnual).toBeCloseTo(100, 2); // 200 entitlement - 100, not - 250
  });

  it("a MISSING recorded hire date must not narrow the netting", () => {
    // Callers default hireDate to today when the field is empty. That default is
    // fine for prorating, but if it bounded the netting it would exclude every
    // earlier run of a CONTINUOUS engagement and re-pay a subsidio already paid.
    // engagementStart is therefore passed separately, from recorded data only.
    const r = resolveLeaverFinalPay({
      monthlySalary: 600,
      hireDate: "2026-07-31", // stand-in for the getTodayTL() default
      engagementStart: undefined, // nothing on file
      asOfDate: new Date("2026-10-31T00:00:00"),
      includeSubsidioAnual: false,
      subsidioConfig: { proRataForNewEmployees: true },
      inPeriodTermination: "2026-10-31",
      severanceEntitled: true,
      committed: {
        serviceCompensation: 0,
        subsidioAnual: 150,
        subsidioAnualByRun: [
          { periodStart: "2026-03-01", periodEnd: "2026-03-31", amount: 150 },
        ],
      },
    });
    // The March payment IS netted: 3/12 entitlement (Jul-Oct = 4/12 = 200) - 150.
    expect(r.subsidioAnual).toBeCloseTo(50, 2);
  });

  it("ignores an engagement start that postdates the termination", () => {
    // Incoherent recorded data (or a today-default that has run past the exit) must
    // not narrow the netting either.
    const r = resolveLeaverFinalPay({
      monthlySalary: 600,
      hireDate: "2026-07-01",
      engagementStart: "2026-12-01", // after the last working day
      asOfDate: new Date("2026-10-31T00:00:00"),
      includeSubsidioAnual: false,
      subsidioConfig: { proRataForNewEmployees: true },
      inPeriodTermination: "2026-10-31",
      severanceEntitled: true,
      committed: {
        serviceCompensation: 0,
        subsidioAnual: 150,
        subsidioAnualByRun: [
          { periodStart: "2026-03-01", periodEnd: "2026-03-31", amount: 150 },
        ],
      },
    });
    expect(r.subsidioAnual).toBeCloseTo(50, 2);
  });

  it("falls back to the year-agnostic total when no per-run breakdown is supplied", () => {
    // Over-netting underpays a subsidio the worker can see and get topped up;
    // under-netting sends a second 13th month out the door. Prefer the former.
    const r = resolveLeaverFinalPay({
      ...base,
      asOfDate: new Date("2026-01-04T00:00:00"),
      inPeriodTermination: "2026-01-02",
      committed: { serviceCompensation: 0, subsidioAnual: 600 },
    });
    expect(r.subsidioAnual).toBe(0);
  });
});

describe("resolveLeaverFinalPay: cause-aware Art. 56 decision (severanceEntitled)", () => {
  const common = {
    monthlySalary: 600,
    hireDate: ABILIO_HIRE,
    asOfDate: new Date("2026-09-30T00:00:00"),
    includeSubsidioAnual: false,
    subsidioConfig: { proRataForNewEmployees: true },
    committed: { serviceCompensation: 0, subsidioAnual: 0 },
  };

  it("severanceEntitled:false (e.g. resignation) suppresses the Art. 56 line but NOT the subsidio", () => {
    const r = resolveLeaverFinalPay({
      ...common,
      inPeriodTermination: ABILIO_TERMINATION,
      severanceEntitled: false,
    });
    expect(r.terminationDate).toBeUndefined(); // no severance earning
    expect(r.subsidioAnual).toBeCloseTo(450, 2); // Art. 44 still owed (9/12)
  });

  it("severanceEntitled omitted stays safe-off until a review explicitly includes it", () => {
    const r = resolveLeaverFinalPay({
      ...common,
      inPeriodTermination: ABILIO_TERMINATION,
    });
    expect(r.terminationDate).toBeUndefined();
  });

  it("severanceDefaultForReason: OFF only for resignation, ON for every other cause", () => {
    expect(severanceDefaultForReason("resignation")).toBe(false);
    // 'death' (Art. 47(1)(b) caducidade) defaults ON — statute-literal reading,
    // payable to the estate/heirs (the offboarding UI carries that note).
    (
      [
        "redundancy",
        "termination",
        "retirement",
        "contract_end",
        "mutual_agreement",
        "death",
        "other",
      ] as const
    ).forEach((reason) => expect(severanceDefaultForReason(reason)).toBe(true));
  });
});
