/**
 * Pure shift-scheduling calculations and slot config.
 *
 * Deliberately free of any Firebase import so it can be unit-tested and reused
 * without pulling in the Firestore client (which throws at load when the
 * VITE_FIREBASE_* env vars are absent, e.g. in CI test runs).
 */

export interface ShiftSlot {
  id: string;
  label: string;
  enabled: boolean;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  color: string; // dot color class
}

export const DEFAULT_SHIFT_SLOTS: ShiftSlot[] = [
  { id: 'morning', label: 'Morning', enabled: true, startTime: '06:00', endTime: '14:00', color: 'bg-orange-500' },
  { id: 'afternoon', label: 'Afternoon', enabled: true, startTime: '14:00', endTime: '22:00', color: 'bg-red-500' },
  { id: 'night', label: 'Night', enabled: false, startTime: '22:00', endTime: '06:00', color: 'bg-purple-500' },
];

/**
 * Hours between two HH:MM strings. Spans past midnight (e.g. 22:00–06:00)
 * are treated as overnight shifts, never negative.
 */
export function calcShiftHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

/** Whether a valid-looking shift ends on the following calendar day. */
export function shiftCrossesMidnight(
  startTime: string,
  endTime: string,
): boolean {
  return Boolean(startTime && endTime && endTime < startTime);
}

/** Compact, localized time range for both daytime and overnight shift displays. */
export function formatShiftTimeRange(
  startTime: string,
  endTime: string,
  endsNextDayLabel: string,
): string {
  const range = `${startTime}–${endTime}`;
  return shiftCrossesMidnight(startTime, endTime) && endsNextDayLabel
    ? `${range} · ${endsNextDayLabel}`
    : range;
}
