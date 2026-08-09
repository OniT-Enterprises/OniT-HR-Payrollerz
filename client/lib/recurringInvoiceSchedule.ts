import type { RecurringFrequency } from "@/types/money";

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Advance a recurring invoice calendar date without letting JavaScript's
 * month overflow skip the intended billing period. End-of-month schedules
 * remain pinned to the end of each target month.
 */
export function advanceRecurringInvoiceDate(
  currentDate: string,
  frequency: RecurringFrequency,
  anchorDate = currentDate,
): string {
  if (!(["weekly", "monthly", "quarterly", "yearly"] as const).includes(frequency)) {
    throw new Error(`Unknown recurring frequency: ${String(frequency)}`);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(currentDate);
  if (!match) throw new Error(`Invalid recurring date: ${currentDate}`);

  const currentYear = Number(match[1]);
  const currentMonth = Number(match[2]) - 1;
  const currentDay = Number(match[3]);
  const currentLastDay = daysInMonth(currentYear, currentMonth);
  if (currentMonth < 0 || currentMonth > 11 || currentDay < 1 || currentDay > currentLastDay) {
    throw new Error(`Invalid recurring date: ${currentDate}`);
  }

  if (frequency === "weekly") {
    const target = new Date(Date.UTC(currentYear, currentMonth, currentDay + 7, 12));
    return target.toISOString().slice(0, 10);
  }

  const anchorMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchorDate);
  if (!anchorMatch) throw new Error(`Invalid recurring date: ${anchorDate}`);
  const anchorYear = Number(anchorMatch[1]);
  const anchorMonth = Number(anchorMatch[2]) - 1;
  const anchorDay = Number(anchorMatch[3]);
  const anchorLastDay = daysInMonth(anchorYear, anchorMonth);
  if (anchorMonth < 0 || anchorMonth > 11 || anchorDay < 1 || anchorDay > anchorLastDay) {
    throw new Error(`Invalid recurring date: ${anchorDate}`);
  }

  const monthsToAdd = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  const absoluteTargetMonth = currentYear * 12 + currentMonth + monthsToAdd;
  const targetYear = Math.floor(absoluteTargetMonth / 12);
  const targetMonth = absoluteTargetMonth % 12;
  const targetLastDay = daysInMonth(targetYear, targetMonth);
  const targetDay = anchorDay === anchorLastDay
    ? targetLastDay
    : Math.min(anchorDay, targetLastDay);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay, 12))
    .toISOString()
    .slice(0, 10);
}
