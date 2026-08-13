import { describe, expect, it } from "vitest";
import {
  calculateAttendancePremium,
  type AttendancePremium,
} from "../../client/lib/payroll/attendance-premium";
import { resolveAttendancePremium } from "../../client/lib/payroll/run-payroll-helpers";
import type { Employee } from "../../client/services/employeeService";

const allOrNothing: AttendancePremium = {
  amount: 145,
  mode: "all_or_nothing",
  active: true,
};

const proRata: AttendancePremium = {
  amount: 145,
  mode: "pro_rata",
  active: true,
};

describe("calculateAttendancePremium", () => {
  it("pays nothing when no premium is configured — never inferred", () => {
    expect(calculateAttendancePremium(undefined, 0, 190)).toEqual({
      amount: 0,
      reduced: false,
      chargeableAbsenceHours: 0,
    });
  });

  it("pays nothing for an inactive premium", () => {
    expect(
      calculateAttendancePremium({ ...allOrNothing, active: false }, 0, 190).amount,
    ).toBe(0);
  });

  it("pays in full on a clean sheet", () => {
    const result = calculateAttendancePremium(allOrNothing, 0, 190);
    expect(result.amount).toBe(145);
    expect(result.reduced).toBe(false);
  });

  it("forfeits the whole premium on any absence in all-or-nothing mode", () => {
    // The corpus case: "com desconto de 3 dias de falta ao serviço".
    const result = calculateAttendancePremium(allOrNothing, 24, 190);
    expect(result.amount).toBe(0);
    expect(result.reduced).toBe(true);
    expect(result.chargeableAbsenceHours).toBe(24);
  });

  it("tolerates absence inside the grace allowance", () => {
    const result = calculateAttendancePremium(
      { ...allOrNothing, graceHours: 8 },
      8,
      190,
    );
    expect(result.amount).toBe(145);
    expect(result.reduced).toBe(false);
  });

  it("charges only the hours beyond grace", () => {
    const result = calculateAttendancePremium(
      { ...allOrNothing, graceHours: 8 },
      12,
      190,
    );
    expect(result.chargeableAbsenceHours).toBe(4);
    expect(result.amount).toBe(0);
  });

  it("reduces in proportion to hours missed in pro-rata mode", () => {
    const result = calculateAttendancePremium(proRata, 19, 190);
    expect(result.amount).toBe(130.5); // 145 x (171/190)
    expect(result.reduced).toBe(true);
  });

  it("pays nothing in pro-rata mode when the whole period was missed", () => {
    expect(calculateAttendancePremium(proRata, 190, 190).amount).toBe(0);
  });

  it("cannot go negative when absence exceeds rostered hours", () => {
    expect(calculateAttendancePremium(proRata, 400, 190).amount).toBe(0);
  });

  it("falls back to all-or-nothing when there are no rostered hours to divide by", () => {
    // Silently paying in full here would hand out a premium with no attendance
    // behind it at all.
    const result = calculateAttendancePremium(proRata, 8, 0);
    expect(result.amount).toBe(0);
    expect(result.reduced).toBe(true);
  });

  it("ignores a non-finite absence figure rather than throwing", () => {
    expect(calculateAttendancePremium(allOrNothing, Number.NaN, 190).amount).toBe(145);
  });

  it("pays nothing for a zero or negative configured amount", () => {
    expect(calculateAttendancePremium({ ...allOrNothing, amount: 0 }, 0, 190).amount).toBe(0);
    expect(calculateAttendancePremium({ ...allOrNothing, amount: -50 }, 0, 190).amount).toBe(0);
  });
});

function employeeWith(premium: AttendancePremium | undefined): Employee {
  return {
    compensation: { attendancePremium: premium },
  } as unknown as Employee;
}

describe("resolveAttendancePremium", () => {
  it("keeps the full premium for a mid-period hire with a clean sheet", () => {
    // RunPayroll books pre-hire days as absence so salaried pay prorates. Those
    // hours are NOT absence, and counting them would strip the premium from
    // every new hire and every leaver.
    const result = resolveAttendancePremium({
      employee: employeeWith(allOrNothing),
      absenceHours: 95,
      nonEmploymentAbsenceHours: 95,
      regularHours: 190,
    });
    expect(result.amount).toBe(145);
    expect(result.reduced).toBe(false);
  });

  it("still forfeits when a part-period employee has real absence on top", () => {
    const result = resolveAttendancePremium({
      employee: employeeWith(allOrNothing),
      absenceHours: 103,
      nonEmploymentAbsenceHours: 95,
      regularHours: 190,
    });
    expect(result.chargeableAbsenceHours).toBe(8);
    expect(result.amount).toBe(0);
  });

  it("pro-rates a part-period employee against the hours they were rostered for", () => {
    // 190 - 95 = 95 rostered hours; 9.5 missed leaves 90%.
    const result = resolveAttendancePremium({
      employee: employeeWith(proRata),
      absenceHours: 104.5,
      nonEmploymentAbsenceHours: 95,
      regularHours: 190,
    });
    expect(result.amount).toBe(130.5);
  });

  it("pays nothing when the employee has no premium configured", () => {
    expect(
      resolveAttendancePremium({
        employee: employeeWith(undefined),
        absenceHours: 0,
        nonEmploymentAbsenceHours: 0,
        regularHours: 190,
      }).amount,
    ).toBe(0);
  });
});
