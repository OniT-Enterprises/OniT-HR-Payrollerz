import { addDaysISO, getTodayTL, parseDateISO } from "@/lib/dateUtils";
import { adjustToPreviousBusinessDayTL } from "@/lib/payroll/tl-holidays";
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

/**
 * Next payday pair: the raw configured day-of-month date and its
 * Art. 40(5)-adjusted payment date (a payday on a weekend/holiday moves BACK
 * to the preceding working day). When the adjusted date has already passed —
 * e.g. today is Saturday the 25th, so this cycle was legally payable Friday
 * the 24th — the next cycle's payday is suggested instead.
 */
function getNextPaydayPair(
  schedule: PayrollSchedule,
  todayIso: string,
): { raw: string; adjusted: string } {
  const [year, month, day] = todayIso.split("-").map(Number);
  const monthOffset = day > schedule.payDay ? 1 : 0;
  let raw = isoDate(year, month + monthOffset, schedule.payDay);
  let adjusted = adjustToPreviousBusinessDayTL(raw);
  if (adjusted < todayIso) {
    const [rawYear, rawMonth] = raw.split("-").map(Number);
    raw = isoDate(rawYear, rawMonth + 1, schedule.payDay);
    adjusted = adjustToPreviousBusinessDayTL(raw);
  }
  return { raw, adjusted };
}

/**
 * Next configured payday in Timor-Leste calendar time, including today.
 * Weekend/holiday paydays are shifted to the PRECEDING working day per
 * Lei 4/2012 Art. 40(5).
 */
export function getNextPayDateIso(
  schedule: PayrollSchedule,
  todayIso = getTodayTL(),
): string {
  return getNextPaydayPair(schedule, todayIso).adjusted;
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
  const { raw, adjusted: payDate } = getNextPaydayPair(schedule, todayIso);

  if (schedule.frequency === "monthly") {
    // Derive the covered month from the RAW configured payday: a payday on
    // the 1st that shifts back over a weekend into the previous month must
    // not also shift the covered period back a month.
    const [payYear, payMonth] = raw.split("-").map(Number);
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

/**
 * Lei 4/2012 Art. 40(3): the interval between wage payments must not exceed
 * one month. True when more than one calendar month has passed since the last
 * pay date — i.e. the next payment is legally overdue. Month-end overflow
 * (e.g. Jan 31 + 1 month) rolls forward via UTC normalization, which only
 * ever grants a few days of grace, never flags early.
 */
export function isPayIntervalExceeded(
  lastPayDateIso: string,
  todayIso = getTodayTL(),
): boolean {
  const [year, month, day] = lastPayDateIso.split("-").map(Number);
  if (!year || !month || !day) return false;
  return isoDate(year, month + 1, day) < todayIso;
}
