import { parseDateISO } from "@/lib/dateUtils";
import { adjustToNextBusinessDayTL } from "@/lib/payroll/tl-holidays";
import type { TaxFilingStatus } from "@/types/tax-filing";

type AdjustDateFn = (isoDate: string) => string;

const defaultAdjustDate: AdjustDateFn = (isoDate) => adjustToNextBusinessDayTL(isoDate);

const pad2 = (value: number): string => String(value).padStart(2, "0");

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
