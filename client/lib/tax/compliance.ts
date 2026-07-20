import { parseDateISO } from "@/lib/dateUtils";
import { adjustToNextBusinessDayTL } from "@/lib/payroll/tl-holidays";
import type { TaxFilingStatus } from "@/types/tax-filing";

type AdjustDateFn = (isoDate: string) => string;

const defaultAdjustDate: AdjustDateFn = (isoDate) => adjustToNextBusinessDayTL(isoDate);

const pad2 = (value: number): string => String(value).padStart(2, "0");

function parseMonthlyTaxPeriod(period: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) {
    throw new RangeError("Tax period must use YYYY-MM format.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new RangeError("Tax period month must be between 01 and 12.");
  }
  return { year, month };
}

/** Law 8/2008 Art. 23: monthly WIT is due on day 15 of the following month. */
export function getMonthlyWITDueDateBase(period: string): string {
  const { year, month } = parseMonthlyTaxPeriod(period);
  const dueYear = month === 12 ? year + 1 : year;
  const dueMonth = month === 12 ? 1 : month + 1;
  return `${dueYear}-${pad2(dueMonth)}-15`;
}

/**
 * Law 8/2008 Secs. 8-9: the monthly services-tax form and payment are due by
 * day 15 of the following month (same consolidated monthly form as WIT).
 */
export function getMonthlyServicesTaxDueDateBase(period: string): string {
  return getMonthlyWITDueDateBase(period);
}

/**
 * Law 8/2008 Art. 64: income-tax installments are paid by day 15 after the
 * period (month or quarter) ends. For quarterly payers pass the quarter-end
 * month as the period (03, 06, 09, 12).
 */
export function getInstallmentTaxDueDateBase(period: string): string {
  return getMonthlyWITDueDateBase(period);
}

/** True for the last month of a calendar quarter (03, 06, 09, 12). */
export function isQuarterEndMonth(period: string): boolean {
  const { month } = parseMonthlyTaxPeriod(period);
  return month % 3 === 0;
}

/** Annual employer withholding return: 31 March following the tax year. */
export function getAnnualWITDueDateBase(taxYear: number): string {
  if (!Number.isInteger(taxYear) || taxYear < 1900 || taxYear > 9998) {
    throw new RangeError("Tax year must be a four-digit year.");
  }
  return `${taxYear + 1}-03-31`;
}

export function getMonthlyWITDueDate(
  period: string,
  adjustDate: AdjustDateFn = defaultAdjustDate,
): string {
  return adjustDate(getMonthlyWITDueDateBase(period));
}

export function getAnnualWITDueDate(
  taxYear: number,
  adjustDate: AdjustDateFn = defaultAdjustDate,
): string {
  return adjustDate(getAnnualWITDueDateBase(taxYear));
}

export function getDaysUntilDueIso(todayIso: string, dueIso: string): number {
  const today = parseDateISO(todayIso);
  const due = parseDateISO(dueIso);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getNextMonthlyAdjustedDeadline(
  todayIso: string,
  dayOfMonth: number,
  adjustDate: AdjustDateFn = defaultAdjustDate
): string {
  const today = parseDateISO(todayIso);
  const currentMonthBaseIso = `${today.getUTCFullYear()}-${pad2(today.getUTCMonth() + 1)}-${pad2(dayOfMonth)}`;
  const nextMonthBaseDate = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, dayOfMonth);
  const nextMonthBaseIso = `${nextMonthBaseDate.getFullYear()}-${pad2(nextMonthBaseDate.getMonth() + 1)}-${pad2(nextMonthBaseDate.getDate())}`;
  const baseIso = todayIso <= currentMonthBaseIso ? currentMonthBaseIso : nextMonthBaseIso;
  return adjustDate(baseIso);
}

export function getNextAnnualAdjustedDeadline(
  todayIso: string,
  month: number,
  day: number,
  adjustDate: AdjustDateFn = defaultAdjustDate
): string {
  const today = parseDateISO(todayIso);
  const currentBaseIso = `${today.getUTCFullYear()}-${pad2(month)}-${pad2(day)}`;
  const currentAdjustedIso = adjustDate(currentBaseIso);
  if (todayIso <= currentAdjustedIso) {
    return currentAdjustedIso;
  }
  return adjustDate(`${today.getUTCFullYear() + 1}-${pad2(month)}-${pad2(day)}`);
}

export function getUrgencyFromDays(daysUntilDue: number, isOverdue: boolean = false): "ok" | "warning" | "urgent" {
  if (isOverdue || daysUntilDue < 0) return "urgent";
  if (daysUntilDue <= 3) return "urgent";
  if (daysUntilDue <= 7) return "warning";
  return "ok";
}

export function getFilingStatusFromDays(daysUntilDue: number): TaxFilingStatus {
  return daysUntilDue < 0 ? "overdue" : "pending";
}

export function resolveTaskStatus(params: {
  explicitStatus?: TaxFilingStatus;
  legacyStatus?: TaxFilingStatus;
  daysUntilDue: number;
}): TaxFilingStatus {
  if (params.explicitStatus === "filed" || params.explicitStatus === "draft") {
    return params.explicitStatus;
  }
  if (params.legacyStatus === "filed") return "filed";
  return getFilingStatusFromDays(params.daysUntilDue);
}
