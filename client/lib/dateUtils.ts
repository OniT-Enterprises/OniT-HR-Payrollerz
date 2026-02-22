/**
 * Date Utilities for Timor-Leste (UTC+9)
 *
 * Principles:
 * - Store dates in UTC in Firestore
 * - Display dates in TL timezone (Asia/Dili)
 * - Use consistent formatting across the app
 */

// Timor-Leste timezone
const TL_TIMEZONE = 'Asia/Dili';

/**
 * Format a date for display in TL timezone
 */
export function formatDateTL(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TL_TIMEZONE,
    ...options,
  };

  return dateObj.toLocaleDateString('en-GB', defaultOptions);
}

/**
 * Format date and time for display in TL timezone
 */
function formatDateTimeTL(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TL_TIMEZONE,
    ...options,
  };

  return dateObj.toLocaleString('en-GB', defaultOptions);
}

/**
 * Format date in ISO format (YYYY-MM-DD) for form inputs
 * Uses TL timezone to determine the correct date
 */
export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return '';

  // Use formatToParts for cross-browser safety (avoids locale-dependent separators)
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TL_TIMEZONE,
  }).formatToParts(dateObj);

  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;

  return `${year}-${month}-${day}`;
}

/**
 * Parse an ISO date string (YYYY-MM-DD) to a Date object.
 *
 * Anchored at noon UTC so the calendar date is identical in every timezone
 * from UTC-12 to UTC+12 (the full inhabited range). This prevents a common
 * bug where midnight UTC shifts to the previous day in western timezones.
 *
 * Timor-Leste (UTC+9, no DST) is well within this safe window.
 *
 * For date comparisons, prefer comparing ISO strings directly
 * ("2026-02-21" > "2026-02-20") instead of Date objects.
 */
export function parseDateISO(dateString: string): Date {
  if (!dateString) return new Date();

  const [year, month, day] = dateString.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/**
 * Add days to a date value and return a new Date instance
 */
export function addDays(date: Date | string, days: number): Date {
  const base = typeof date === 'string' ? parseDateISO(date) : new Date(date.getTime());
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

/**
 * Get start of day in UTC for a given date
 * Use this when storing date-only values
 */
function toUTCStartOfDay(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Date(Date.UTC(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth(),
    dateObj.getUTCDate(),
    0, 0, 0, 0
  ));
}

/**
 * Get end of day in UTC for a given date
 */
function toUTCEndOfDay(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Date(Date.UTC(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth(),
    dateObj.getUTCDate(),
    23, 59, 59, 999
  ));
}

/**
 * Get current date in TL timezone as ISO string
 */
export function getTodayTL(): string {
  return formatDateISO(new Date());
}

/**
 * Convert any date to an ISO date string (YYYY-MM-DD) in TL timezone.
 * Use this instead of `date.toISOString().split("T")[0]` to avoid UTC midnight shift.
 */
export function toDateStringTL(date: Date | string): string {
  return formatDateISO(date);
}

/**
 * Check if two dates are the same day (in TL timezone)
 */
function isSameDayTL(date1: Date | string, date2: Date | string): boolean {
  return formatDateISO(date1) === formatDateISO(date2);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return formatDateTL(dateObj);
}

/**
 * Get month name in English
 */
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month] || '';
}

/**
 * Get short month name (Jan, Feb, etc.)
 */
function getMonthShort(month: number): string {
  return getMonthName(month).substring(0, 3);
}
