/**
 * Timor-Leste public holidays for Ekipa mobile app.
 * Mirrors client/lib/payroll/tl-holidays.ts — simplified for mobile display.
 *
 * Includes all 13+ TL public holidays: fixed national days + Easter-based movable feasts.
 * Easter computed algorithmically (Meeus/Jones/Butcher) so any year works.
 */

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  nameTetun: string;
}

export interface TLHoliday {
  date: string; // YYYY-MM-DD
  name: {
    en: string;
    tet: string;
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function formatUTCISODate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm).
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
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Fixed holidays — same date every year */
const FIXED_HOLIDAYS: Array<{
  month: number;
  day: number;
  name: string;
  nameTetun: string;
}> = [
  { month: 1, day: 1, name: "New Year's Day", nameTetun: 'Loron Tinan Foun' },
  { month: 3, day: 3, name: 'Veterans Day (Heroes Day)', nameTetun: 'Loron Veteranu / Kombatentes' },
  { month: 5, day: 1, name: 'Labour Day', nameTetun: 'Loron Traballadór' },
  { month: 5, day: 20, name: 'Independence Restoration Day', nameTetun: 'Loron Restaurasaun Independensia' },
  { month: 8, day: 20, name: 'FALINTIL Day', nameTetun: 'Loron FALINTIL' },
  { month: 8, day: 30, name: 'Popular Consultation Day', nameTetun: 'Loron Konsulta Populár' },
  { month: 9, day: 20, name: 'Liberation Day', nameTetun: 'Loron Libertasaun' },
  { month: 11, day: 1, name: "All Saints' Day", nameTetun: 'Loron Santu Hotu' },
  { month: 11, day: 2, name: "All Souls' Day", nameTetun: 'Loron Finadu' },
  { month: 11, day: 12, name: 'National Youth Day (Santa Cruz)', nameTetun: 'Loron Juventude Nasionál / Santa Cruz' },
  { month: 11, day: 28, name: 'Independence Proclamation Day', nameTetun: 'Loron Proklamasaun Independensia' },
  { month: 12, day: 7, name: 'National Heroes Day', nameTetun: 'Loron Heroi Nasionál' },
  { month: 12, day: 8, name: 'Immaculate Conception', nameTetun: 'Loron Imakulada Konseisaun' },
  { month: 12, day: 25, name: 'Christmas Day', nameTetun: 'Loron Natál' },
];

/**
 * Returns all Timor-Leste public holidays for the given year, sorted chronologically.
 * Legacy API — returns flat name/nameTetun fields.
 */
export function getHolidays(year: number): Holiday[] {
  const fixed: Holiday[] = FIXED_HOLIDAYS.map((h) => ({
    date: `${year}-${pad2(h.month)}-${pad2(h.day)}`,
    name: h.name,
    nameTetun: h.nameTetun,
  }));

  const easterSunday = getEasterSundayUTC(year);
  const goodFriday = addDaysUTC(easterSunday, -2);
  const corpusChristi = addDaysUTC(easterSunday, 60);

  const movable: Holiday[] = [
    { date: formatUTCISODate(goodFriday), name: 'Good Friday', nameTetun: 'Sesta-Feira Santa' },
    { date: formatUTCISODate(corpusChristi), name: 'Corpus Christi', nameTetun: 'Loron Corpus Christi' },
  ];

  return [...fixed, ...movable].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns all Timor-Leste public holidays for a given year.
 * Bilingual API — returns { en, tet } name object.
 */
export function getTLHolidays(year: number): TLHoliday[] {
  const holidays = getHolidays(year);
  return holidays.map((h) => ({
    date: h.date,
    name: {
      en: h.name,
      tet: h.nameTetun,
    },
  }));
}

/**
 * Check if a given date string (YYYY-MM-DD) is a TL public holiday.
 */
export function isTLHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const holidays = getHolidays(year);
  return holidays.some((h) => h.date === dateStr);
}

/**
 * Get the holiday name for a given date, or null if not a holiday.
 */
export function getTLHolidayName(dateStr: string): { en: string; tet: string } | null {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const holidays = getTLHolidays(year);
  const match = holidays.find((h) => h.date === dateStr);
  return match?.name ?? null;
}
