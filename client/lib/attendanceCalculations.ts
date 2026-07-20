/**
 * Pure attendance calculations, statuses, and thresholds.
 *
 * Deliberately free of any Firebase import so it can be unit-tested and reused
 * without pulling in the Firestore client (which throws at load when the
 * VITE_FIREBASE_* env vars are absent, e.g. in CI test runs).
 */

import { TL_WORKING_HOURS } from '@/lib/payroll/constants-tl';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'half_day' | 'leave' | 'holiday';
export type AttendanceSource = 'manual' | 'fingerprint' | 'mobile_app' | 'qr_code' | 'facial';

/** Default expected work times when the employee has no scheduled shift that day */
export const DEFAULT_EXPECTED_START = '08:00';
export const DEFAULT_EXPECTED_END = '17:00';

/** Minutes of lateness tolerated before an entry is marked "late" */
export const LATE_GRACE_MINUTES = 15;

/** A single entry computing to more hours than this is almost certainly a typo */
export const MAX_REASONABLE_ENTRY_HOURS = 16;

/** Unpaid break assumed when none is recorded (only for entries of 6h+ raw) */
export const DEFAULT_BREAK_MINUTES = 60;

/**
 * Calculate hours between two time strings (end before start = overnight)
 */
export function calculateHoursBetween(start: string, end: string): number {
  if (!start || !end) return 0;

  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  if ([startHour, startMin, endHour, endMin].some(Number.isNaN)) return 0;

  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

/**
 * Net hours for an entry: raw span minus break. When no break is recorded,
 * a default break is deducted only for entries long enough to include one.
 * Shared by the service and the entry dialogs (for live preview/validation).
 */
export function computeEntryHours(
  clockIn: string,
  clockOut: string,
  breakMinutes?: number,
): { rawHours: number; breakMinutes: number; totalHours: number; isOvernight: boolean } {
  const rawHours = calculateHoursBetween(clockIn, clockOut);
  const effectiveBreak =
    breakMinutes !== undefined
      ? breakMinutes
      : rawHours >= 6
        ? DEFAULT_BREAK_MINUTES
        : 0;
  const totalHours = Math.max(0, rawHours - effectiveBreak / 60);
  const isOvernight = Boolean(clockIn && clockOut && clockOut < clockIn);
  return { rawHours, breakMinutes: effectiveBreak, totalHours, isOvernight };
}

/**
 * Night-work window (Labour Code Art. 27 / constants-tl `nightShiftPremium`):
 * hours worked between 21:00 and 06:00 earn an additional 25% premium. These
 * hours are a SUBSET of the worked span — they are paid as regular/overtime
 * for the base hour and only carry the extra premium — so this figure never
 * reduces regular or overtime hours.
 */
export const NIGHT_WINDOW_START_HOUR = 21;
export const NIGHT_WINDOW_END_HOUR = 6;

/**
 * Hours of a shift that fall inside the 21:00–06:00 night window.
 *
 * Handles overnight shifts (clock-out < clock-in). Returns hours worked at
 * night, capped at the shift's total worked hours so a recorded break can
 * never push night hours above paid hours.
 */
export function calculateNightHours(
  clockIn: string,
  clockOut: string,
  totalHours?: number,
): number {
  if (!clockIn || !clockOut) return 0;

  const [startHour, startMin] = clockIn.split(':').map(Number);
  const [endHour, endMin] = clockOut.split(':').map(Number);
  if ([startHour, startMin, endHour, endMin].some(Number.isNaN)) return 0;

  const start = startHour * 60 + startMin;
  let end = endHour * 60 + endMin;
  if (end <= start) end += 24 * 60; // overnight

  // Night windows over a 48h timeline (minutes): early-morning 00:00–06:00,
  // evening 21:00–06:00 next day, and the following day's evening block. This
  // covers any shift up to the 16h sanity cap.
  const nightWindows: Array<[number, number]> = [
    [0, NIGHT_WINDOW_END_HOUR * 60],
    [NIGHT_WINDOW_START_HOUR * 60, (24 + NIGHT_WINDOW_END_HOUR) * 60],
    [(24 + NIGHT_WINDOW_START_HOUR) * 60, (48 + NIGHT_WINDOW_END_HOUR) * 60],
  ];

  let nightMinutes = 0;
  for (const [ws, we] of nightWindows) {
    nightMinutes += Math.max(0, Math.min(end, we) - Math.max(start, ws));
  }

  let nightHours = Math.round((nightMinutes / 60) * 100) / 100;
  if (totalHours !== undefined) {
    nightHours = Math.min(nightHours, Math.max(0, totalHours));
  }
  return nightHours;
}

/**
 * Calculate late minutes based on expected start time
 */
export function calculateLateMinutes(clockIn: string, expectedStart: string = DEFAULT_EXPECTED_START): number {
  if (!clockIn) return 0;

  const [clockHour, clockMin] = clockIn.split(':').map(Number);
  const [expectedHour, expectedMin] = expectedStart.split(':').map(Number);

  const clockMinutes = clockHour * 60 + clockMin;
  const expectedMinutes = expectedHour * 60 + expectedMin;

  return Math.max(0, clockMinutes - expectedMinutes);
}

/**
 * Calculate early departure minutes based on expected end time
 */
export function calculateEarlyDeparture(clockOut: string, expectedEnd: string = DEFAULT_EXPECTED_END): number {
  if (!clockOut) return 0;

  const [clockHour, clockMin] = clockOut.split(':').map(Number);
  const [expectedHour, expectedMin] = expectedEnd.split(':').map(Number);

  const clockMinutes = clockHour * 60 + clockMin;
  const expectedMinutes = expectedHour * 60 + expectedMin;

  return Math.max(0, expectedMinutes - clockMinutes);
}

/**
 * Determine attendance status.
 * An entry with clock-in but no clock-out is a shift in progress — present
 * (or late), never half_day: hours can only be judged once clocked out.
 */
export function determineStatus(
  clockIn: string | undefined,
  clockOut: string | undefined,
  lateMinutes: number,
  totalHours: number
): AttendanceStatus {
  if (!clockIn && !clockOut) return 'absent';
  if (clockIn && !clockOut) return lateMinutes > LATE_GRACE_MINUTES ? 'late' : 'present';
  if (totalHours < 4) return 'half_day';
  if (lateMinutes > LATE_GRACE_MINUTES) return 'late';
  return 'present';
}

/**
 * Calculate regular and overtime hours
 */
export function calculateHoursBreakdown(totalHours: number): { regular: number; overtime: number } {
  const standardDailyHours = TL_WORKING_HOURS.standardDailyHours;

  if (totalHours <= standardDailyHours) {
    return { regular: totalHours, overtime: 0 };
  }

  return {
    regular: standardDailyHours,
    overtime: totalHours - standardDailyHours,
  };
}

// ============================================
// WEEKLY / HOLIDAY / REST-DAY CLASSIFICATION
// (Lei 4/2012 Arts. 25(1), 27(2), 30)
// ============================================

/** One deduplicated attendance day as stored on the record (post daily split). */
export interface WorkedDayHours {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Hours at 1× after the per-day 8h split (calculateHoursBreakdown). */
  regularHours: number;
  /** Hours beyond 8h/day, already split out by the per-day breakdown. */
  overtimeHours: number;
}

/** Per-employee classified totals for a summary period. */
export interface ClassifiedHoursTotals {
  regularHours: number;
  overtimeHours: number;
  /** Hours worked on a public holiday — Art. 27(2) 2× time. */
  holidayHours: number;
  /** Hours worked on the weekly rest day (Sunday, Art. 30(2)) — 2× time. */
  restDayHours: number;
  /** Largest single-day overtime in the period — Art. 27(4) caps it at 4h. */
  maxDailyOvertimeHours: number;
  /** Largest single-ISO-week overtime (daily split + weekly top-up) — Art. 27(4) caps it at 16h. */
  maxWeeklyOvertimeHours: number;
  /** Largest single-day holiday or rest-day work — Art. 27(3) caps it at 8h. */
  maxHolidayOrRestDayHours: number;
}

/**
 * Monday of the ISO week (Mon–Sun) containing `date`. Pure string/UTC math so
 * the bucket never shifts with the host timezone.
 */
export function isoWeekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if ([y, m, d].some((n) => Number.isNaN(n))) return date;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0=Sun … 6=Sat
  dt.setUTCDate(dt.getUTCDate() - (day === 0 ? 6 : day - 1));
  return dt.toISOString().slice(0, 10);
}

/** Day of week for a 'YYYY-MM-DD' string (0=Sunday), timezone-independent. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  if ([y, m, d].some((n) => Number.isNaN(n))) return NaN;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Classify one employee's deduplicated per-day worked hours for a summary
 * period into regular / overtime / holiday / rest-day buckets, enforcing the
 * Lei 4/2012 limits that the per-day split alone cannot see:
 *
 * 1. HOLIDAY (Art. 27(2)): all hours worked on a public-holiday date are 2×
 *    time — reclassified out of regular AND overtime into `holidayHours`.
 * 2. REST DAY (Arts. 30(2), 27(2)): Sunday is the default weekly rest day;
 *    all hours worked on a non-holiday Sunday are 2× time — reclassified into
 *    `restDayHours`. A Sunday that IS a public holiday counts as holiday only
 *    (holiday wins; the pay rate is the same 2× and hours are never counted
 *    twice). Per-employee NON-Sunday rest days (a tenant whose rest day is,
 *    e.g., Friday for some staff) are deliberately out of scope — deferred;
 *    those hours stay regular and can be entered manually in the payroll row.
 * 3. WEEKLY 44h (Art. 25(1)): normal hours are capped at 8/day AND 44/week.
 *    The per-day split already moved >8h/day into overtime, so after step 1–2
 *    the week's `regularHours` contain only 1×-paid hours. Any of those beyond
 *    44 in one ISO week (Mon–Sun) violate the weekly cap and are overtime:
 *
 *        weeklyTopUp = max(0, weekRegular − 44)
 *
 *    Hours already classified as overtime / holiday / rest-day are EXCLUDED
 *    from `weekRegular` — they already left the regular bucket and are paid at
 *    a premium (≥1.5×), so counting them again would double-book the excess.
 *    E.g. 6×8h Mon–Sat: daily OT 0, weekRegular 48 → 4h reclassified to OT.
 *    Mon–Sat 10h each: daily OT 12, weekRegular 48 → top-up 4 → 16h OT total.
 *
 * Boundary limitation (accepted): a week straddling the summary range only
 * counts the days INSIDE the range — the caller clips to the pay period, and
 * run periods start at month boundaries, so at most the first/last partial
 * week of a month can under-detect weekly overtime that spans two runs.
 *
 * Also computes the per-day / per-week maxima used by the Art. 27(3)/(4)
 * cap warnings. The weekly top-up cannot be attributed to a single day, so
 * `maxDailyOvertimeHours` reflects the per-day split only, while
 * `maxWeeklyOvertimeHours` includes the top-up.
 *
 * Assumes at most one entry per date (the attendance summary dedups upstream).
 */
export function classifyWorkedHours(
  days: WorkedDayHours[],
  holidayDates: ReadonlySet<string>,
): ClassifiedHoursTotals {
  let regularHours = 0;
  let overtimeHours = 0;
  let holidayHours = 0;
  let restDayHours = 0;
  let maxDailyOvertimeHours = 0;
  let maxHolidayOrRestDayHours = 0;

  // Per ISO week: [regular at 1×, overtime from the daily split]
  const weeks = new Map<string, { regular: number; overtime: number }>();

  for (const day of days) {
    const worked = (day.regularHours || 0) + (day.overtimeHours || 0);
    if (holidayDates.has(day.date)) {
      // Holiday wins over Sunday: same 2× rate, no double-count.
      holidayHours += worked;
      maxHolidayOrRestDayHours = Math.max(maxHolidayOrRestDayHours, worked);
      continue;
    }
    if (weekdayOf(day.date) === 0) {
      restDayHours += worked;
      maxHolidayOrRestDayHours = Math.max(maxHolidayOrRestDayHours, worked);
      continue;
    }

    regularHours += day.regularHours || 0;
    overtimeHours += day.overtimeHours || 0;
    maxDailyOvertimeHours = Math.max(maxDailyOvertimeHours, day.overtimeHours || 0);

    const weekKey = isoWeekStart(day.date);
    const week = weeks.get(weekKey) ?? { regular: 0, overtime: 0 };
    week.regular += day.regularHours || 0;
    week.overtime += day.overtimeHours || 0;
    weeks.set(weekKey, week);
  }

  // Weekly Art. 25(1) pass: reclassify regular hours beyond 44/week into OT.
  let maxWeeklyOvertimeHours = 0;
  for (const week of weeks.values()) {
    const weeklyTopUp = Math.max(
      0,
      week.regular - TL_WORKING_HOURS.standardWeeklyHours,
    );
    regularHours -= weeklyTopUp;
    overtimeHours += weeklyTopUp;
    maxWeeklyOvertimeHours = Math.max(
      maxWeeklyOvertimeHours,
      week.overtime + weeklyTopUp,
    );
  }

  return {
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    holidayHours: round2(holidayHours),
    restDayHours: round2(restDayHours),
    maxDailyOvertimeHours: round2(maxDailyOvertimeHours),
    maxWeeklyOvertimeHours: round2(maxWeeklyOvertimeHours),
    maxHolidayOrRestDayHours: round2(maxHolidayOrRestDayHours),
  };
}

// ============================================
// BREAK ENTITLEMENT (Lei 4/2012 Art. 25(2))
// ============================================

/** Art. 25(2): a worker is entitled to a ≥1h break after 5h continuous work. */
export const MAX_CONTINUOUS_HOURS_BEFORE_BREAK = 5;

/**
 * Whether a saved attendance entry deserves the (non-blocking) Art. 25(2)
 * warning. Precise, not noisy:
 * - explicit recorded break under 60min on a >5h raw span → warn;
 * - NO recorded break on a 5–6h raw span → warn (the 60-min default-break
 *   assumption in computeEntryHours only applies from 6h raw, so these spans
 *   really are >5h continuous);
 * - NO recorded break on a ≥6h span → NOT warned: the default 60-min unpaid
 *   break is already assumed, so we'd be second-guessing our own assumption.
 */
export function needsBreakWarning(
  clockIn: string,
  clockOut: string,
  breakMinutes?: number,
): boolean {
  if (!clockIn || !clockOut) return false;
  const rawHours = calculateHoursBetween(clockIn, clockOut);
  if (rawHours <= MAX_CONTINUOUS_HOURS_BEFORE_BREAK) return false;
  if (breakMinutes !== undefined) return breakMinutes < DEFAULT_BREAK_MINUTES;
  return rawHours < 6;
}
