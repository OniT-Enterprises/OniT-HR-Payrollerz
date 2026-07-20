export interface TLHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  nameTetun?: string;
  variable?: boolean;
}

/**
 * Variable Islamic holidays are announced by the Government for each year and
 * cannot be derived reliably from the Gregorian calendar. Keep announced dates
 * here; tenant overrides remain available for later government changes and
 * additional days off.
 */
// Idul Fitri (1 Shawwal) and Idul Adha (10 Dhul-Hijjah) are set by moon
// sighting and proclaimed by the Government each year, so future dates are
// ASTRONOMICAL ESTIMATES (±1 day) until the official proclamation. They shift
// ~11 days earlier per Gregorian year. Refresh the current + next year from the
// Jornal da República each release; tenants can correct a specific year via a
// holiday override. Extended through 2030 so payment-date shifting and holiday
// pay don't silently miss these days in the meantime.
const ANNOUNCED_VARIABLE_HOLIDAYS: Record<number, TLHoliday[]> = {
  2026: [
    { date: "2026-03-20", name: "Idul Fitri", nameTetun: "Idul Fitri", variable: true },
    { date: "2026-05-27", name: "Idul Adha", nameTetun: "Idul Adha", variable: true },
  ],
  // 2027–2030: estimated — confirm against the official proclamation each year.
  2027: [
    { date: "2027-03-10", name: "Idul Fitri (estimated)", nameTetun: "Idul Fitri", variable: true },
    { date: "2027-05-17", name: "Idul Adha (estimated)", nameTetun: "Idul Adha", variable: true },
  ],
  2028: [
    { date: "2028-02-27", name: "Idul Fitri (estimated)", nameTetun: "Idul Fitri", variable: true },
    { date: "2028-05-05", name: "Idul Adha (estimated)", nameTetun: "Idul Adha", variable: true },
  ],
  2029: [
    { date: "2029-02-15", name: "Idul Fitri (estimated)", nameTetun: "Idul Fitri", variable: true },
    { date: "2029-04-24", name: "Idul Adha (estimated)", nameTetun: "Idul Adha", variable: true },
  ],
  2030: [
    { date: "2030-02-05", name: "Idul Fitri (estimated)", nameTetun: "Idul Fitri", variable: true },
    { date: "2030-04-13", name: "Idul Adha (estimated)", nameTetun: "Idul Adha", variable: true },
  ],
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function normalizeISODate(date: Date | string): string {
  if (typeof date === "string") {
    return date.trim().slice(0, 10);
  }
  // Use local date parts to avoid timezone shifting issues.
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseISODateUTC(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUTCISODate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm).
 * Returns a Date at UTC midnight for stable ISO formatting.
 */
function getEasterSundayUTC(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Timor-Leste public holidays.
 *
 * Notes:
 * - Includes fixed national holidays, Easter-based Catholic holidays, and
 *   government-announced variable dates bundled for known years.
 * - Tenant overrides handle later proclamations, corrections, and days off.
 */
export function getTLPublicHolidays(year: number): TLHoliday[] {
  const fixed: TLHoliday[] = [
    { date: `${year}-01-01`, name: "New Year's Day", nameTetun: "Loron Tinan Foun" },
    { date: `${year}-03-03`, name: "Veterans Day", nameTetun: "Loron Veteranu" },
    { date: `${year}-05-01`, name: "Labor Day", nameTetun: "Loron Trabalhador" },
    { date: `${year}-05-20`, name: "Independence Restoration Day", nameTetun: "Loron Restaurasaun Independensia" },
    { date: `${year}-08-30`, name: "Popular Consultation Day", nameTetun: "Loron Konsulta Popular" },
    { date: `${year}-11-01`, name: "All Saints Day", nameTetun: "Loron Santu Hotu" },
    { date: `${year}-11-02`, name: "All Souls Day", nameTetun: "Loron Finadu" },
    { date: `${year}-11-03`, name: "National Women's Day", nameTetun: "Loron Feto Nasionál" },
    { date: `${year}-11-12`, name: "National Youth Day", nameTetun: "Loron Juventude Nasional" },
    { date: `${year}-11-28`, name: "Independence Proclamation Day", nameTetun: "Loron Proklamasaun Independensia" },
    { date: `${year}-12-07`, name: "Memorial Day", nameTetun: "Loron Memoria" },
    { date: `${year}-12-08`, name: "Immaculate Conception", nameTetun: "Loron Imakulada Konseisaun" },
    { date: `${year}-12-25`, name: "Christmas Day", nameTetun: "Loron Natal" },
    { date: `${year}-12-31`, name: "National Heroes Day", nameTetun: "Loron Heroi Nasional" },
  ];

  const easterSunday = getEasterSundayUTC(year);
  const goodFriday = addDaysUTC(easterSunday, -2);
  const corpusChristi = addDaysUTC(easterSunday, 60);

  const movable: TLHoliday[] = [
    { date: formatUTCISODate(goodFriday), name: "Good Friday", nameTetun: "Sesta-feira Santa", variable: true },
    { date: formatUTCISODate(corpusChristi), name: "Corpus Christi", nameTetun: "Corpus Christi", variable: true },
    ...(ANNOUNCED_VARIABLE_HOLIDAYS[year] ?? []),
  ];

  return [...fixed, ...movable].sort((a, b) => a.date.localeCompare(b.date));
}

export function adjustToNextBusinessDayTL(
  isoDate: string,
  overrides?: {
    additionalHolidays?: Iterable<string>;
    removedHolidays?: Iterable<string>;
  }
): string {
  let cursor = parseISODateUTC(normalizeISODate(isoDate));

  const additionalHolidays = new Set<string>();
  const removedHolidays = new Set<string>();

  if (overrides?.additionalHolidays) {
    for (const d of overrides.additionalHolidays) additionalHolidays.add(normalizeISODate(d));
  }
  if (overrides?.removedHolidays) {
    for (const d of overrides.removedHolidays) removedHolidays.add(normalizeISODate(d));
  }

  // Loop (safety capped) until weekday and not a TL public holiday.
  for (let i = 0; i < 14; i++) {
    const cursorIso = formatUTCISODate(cursor);
    const weekday = cursor.getUTCDay(); // 0 Sun, 6 Sat
    const year = cursor.getUTCFullYear();
    const isWeekend = weekday === 0 || weekday === 6;
    const baseHoliday = getTLPublicHolidays(year).some((h) => h.date === cursorIso);
    const isHoliday =
      (baseHoliday && !removedHolidays.has(cursorIso)) || additionalHolidays.has(cursorIso);

    if (!isWeekend && !isHoliday) return cursorIso;
    cursor = addDaysUTC(cursor, 1);
  }

  // Fallback (should never happen)
  return normalizeISODate(isoDate);
}
