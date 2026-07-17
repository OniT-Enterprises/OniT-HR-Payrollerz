import { addDaysISO, getTodayTL, parseDateISO } from "@/lib/dateUtils";
import type { TLPayFrequency } from "@/lib/payroll/constants-tl";
import type { PaymentStructure } from "@/types/settings";

export interface PayrollSchedule {
  frequency: TLPayFrequency;
  payDay: number;
}

export interface PayrollDates {
  periodStart: string;
  periodEnd: string;
  payDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function clampPayDay(value: number | undefined): number {
  return Number.isInteger(value)
    ? Math.min(28, Math.max(1, value as number))
    : 25;
}

function isoDate(year: number, month: number, day: number): string {
  const normalized = new Date(Date.UTC(year, month - 1, day, 12));
  return [
    normalized.getUTCFullYear(),
    String(normalized.getUTCMonth() + 1).padStart(2, "0"),
    String(normalized.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Resolve the one schedule used by dashboards and a new payroll run. */
export function getConfiguredPayrollSchedule(
  paymentStructure:
    | Pick<PaymentStructure, "payrollPeriods" | "payrollFrequencies">
    | null
    | undefined,
): PayrollSchedule {
  const period =
    paymentStructure?.payrollPeriods.find((candidate) => candidate.isActive) ??
    paymentStructure?.payrollPeriods[0];

  // PaymentStructure stores only a day of month, so it can safely anchor an
  // automatic monthly schedule only. Weekly/biweekly runs remain available in
  // the run wizard, where users choose explicit period and payment dates.
  return {
    frequency: "monthly",
    payDay: clampPayDay(period?.payDay),
  };
}

/** Next configured payday in Timor-Leste calendar time, including today. */
export function getNextPayDateIso(
  schedule: PayrollSchedule,
  todayIso = getTodayTL(),
): string {
  const [year, month, day] = todayIso.split("-").map(Number);
  const monthOffset = day > schedule.payDay ? 1 : 0;
  return isoDate(year, month + monthOffset, schedule.payDay);
}

/**
 * Sensible first dates for the run-payroll form. Monthly payroll covers the
 * calendar month preceding its payday; shorter cycles cover the latest fully
 * elapsed 7/14 days. Users can still adjust all three dates in the wizard.
 */
export function getInitialPayrollDates(
  schedule: PayrollSchedule,
  todayIso = getTodayTL(),
): PayrollDates {
  const payDate = getNextPayDateIso(schedule, todayIso);

  if (schedule.frequency === "monthly") {
    const [payYear, payMonth] = payDate.split("-").map(Number);
    const previousMonthEnd = isoDate(payYear, payMonth, 0);
    const [periodYear, periodMonth] = previousMonthEnd.split("-").map(Number);
    return {
      periodStart: isoDate(periodYear, periodMonth, 1),
      periodEnd: previousMonthEnd,
      payDate,
    };
  }

  const periodLength = schedule.frequency === "biweekly" ? 14 : 7;
  const periodEnd = addDaysISO(todayIso, -1);
  return {
    periodStart: addDaysISO(periodEnd, -(periodLength - 1)),
    periodEnd,
    payDate,
  };
}

export function getDaysUntilIso(
  targetIso: string,
  todayIso = getTodayTL(),
): number {
  return Math.round(
    (parseDateISO(targetIso).getTime() - parseDateISO(todayIso).getTime()) /
      DAY_MS,
  );
}
