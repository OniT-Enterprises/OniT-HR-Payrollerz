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
