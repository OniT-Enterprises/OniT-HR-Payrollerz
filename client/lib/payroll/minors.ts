/**
 * Timor-Leste Labour Code (Lei n.º 4/2012) — minors at work.
 *
 * - Art. 5(h): a "minor" worker is one who is under 17 years of age.
 * - Art. 68: the minimum working age is 15 — hiring anyone younger is
 *   prohibited outright (hard rule, blocks save).
 * - Art. 69: workers aged 15–16 may only perform light work — a maximum of
 *   5 hours/day and 25 hours/week, and never night work or overtime.
 * - Art. 70: medical examination requirements for minors (out of scope here).
 *
 * Pure, Firebase-free helpers so they can be unit-tested and reused from
 * Cloud Functions or validation schemas without pulling in the Firestore SDK.
 *
 * TODO(payroll-run): the payroll calculator should warn when a minor
 * (isMinor === true at the pay-period date) has overtime or night hours —
 * hook `isMinor()` into usePayrollCalculator when that module is next touched
 * (owned separately; deliberately not wired here).
 */

/** Art. 68 — minimum working age. */
export const MINIMUM_WORKING_AGE = 15;

/** Art. 5(h) — a worker under this age is a "minor" (no OT, no night work). */
export const MINOR_AGE_LIMIT = 17;

/** Art. 69 — light-work daily hours cap for 15–16 year olds. */
export const LIGHT_WORK_MAX_HOURS_PER_DAY = 5;

/** Art. 69 — light-work weekly hours cap for 15–16 year olds. */
export const LIGHT_WORK_MAX_HOURS_PER_WEEK = 25;

/**
 * Parse a date input into a timezone-stable Date.
 * "YYYY-MM-DD" strings are anchored at noon UTC (same convention as
 * dateUtils.parseDateISO) so the calendar date never shifts across timezones.
 * Returns null for missing/unparseable values.
 */
function toSafeDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Whole-year age at a given date (birthday math — not day-count / 365).
 * Returns null when either date is missing or unparseable, so callers can
 * distinguish "no data" from a real age of 0.
 */
export function ageAt(
  dateOfBirth: Date | string | undefined | null,
  onDate: Date | string = new Date(),
): number | null {
  const dob = toSafeDate(dateOfBirth);
  const at = toSafeDate(onDate);
  if (!dob || !at) return null;

  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  // A DOB after the reference date is invalid data — treat as unknown.
  return age < 0 ? null : age;
}

/**
 * Art. 5(h): true when the person is a minor (< 17) at `onDate`.
 * Unknown/missing DOB returns false — never flag without data.
 */
export function isMinor(
  dateOfBirth: Date | string | undefined | null,
  onDate: Date | string = new Date(),
): boolean {
  const age = ageAt(dateOfBirth, onDate);
  return age !== null && age < MINOR_AGE_LIMIT;
}

/**
 * Art. 68: true when the person is below the minimum working age (< 15)
 * at `onDate` (normally the hire date). Unknown DOB returns false.
 */
export function isUnderMinimumWorkingAge(
  dateOfBirth: Date | string | undefined | null,
  onDate: Date | string = new Date(),
): boolean {
  const age = ageAt(dateOfBirth, onDate);
  return age !== null && age < MINIMUM_WORKING_AGE;
}

/**
 * Art. 69: true when the person is 15 or 16 at `onDate` — employable, but
 * light work only (max 5h/day, 25h/week, no night work or overtime).
 */
export function isLightWorkOnlyAge(
  dateOfBirth: Date | string | undefined | null,
  onDate: Date | string = new Date(),
): boolean {
  const age = ageAt(dateOfBirth, onDate);
  return age !== null && age >= MINIMUM_WORKING_AGE && age < MINOR_AGE_LIMIT;
}
