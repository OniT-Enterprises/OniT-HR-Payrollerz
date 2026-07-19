/**
 * Date input helpers for ISO yyyy-mm-dd strings.
 * Keeps user typing predictable and validates strictly.
 */

export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isValidISODate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

// Asia/Dili is a fixed UTC+9 offset (no DST). Attendance stamps must reflect
// Dili wall-clock time, not the device's timezone — a phone left on another
// timezone would otherwise record the wrong day/time for payroll.
const DILI_OFFSET_MS = 9 * 60 * 60 * 1_000;

/** Today's date as YYYY-MM-DD in Asia/Dili (UTC+9), regardless of device tz. */
export function todayDiliYYYYMMDD(): string {
  const d = new Date(Date.now() + DILI_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Current time as HH:MM in Asia/Dili (UTC+9), regardless of device tz. */
export function nowDiliHHMM(): string {
  const d = new Date(Date.now() + DILI_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
