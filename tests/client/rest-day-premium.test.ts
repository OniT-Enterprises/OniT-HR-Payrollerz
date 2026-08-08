/**
 * Which weekday carries the Art. 27(2) double-pay premium.
 *
 * The premium was hardcoded to Sunday. Lei 4/2012 does not say that. Verified
 * verbatim from the Ministry of Justice text:
 *
 *   Art. 27(2) — "O trabalho prestado em dia de DESCANSO SEMANAL ou em dia de
 *   feriado obrigatório é remunerado com a remuneração horária normal
 *   acrescida de 100 por cento."
 *
 * The word "domingo" does not appear in Art. 27 at all. Sunday is only the
 * DEFAULT under Art. 30(2), departable "quando o trabalhador preste trabalhos
 * indispensáveis à continuidade de serviços que não podem ser interrompidos".
 * So a hotel worker resting on Wednesday was paid 1× for their actual rest day
 * and 2× for an ordinary working Sunday — wrong in both directions at once.
 *
 * The subtlety that makes this more than a one-line change: Art. 30(1) grants
 * ONE rest period ("no mínimo, 24 horas consecutivas"). A Monday–Friday
 * company has two days off but only one is the *dia de descanso semanal*, so
 * treating every non-working day as a rest day would have silently doubled
 * Saturday pay for essentially every tenant in the product.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyWorkedHours,
  resolveRestWeekday,
  type WorkedDayHours,
} from '../../client/lib/attendanceCalculations';

const NO_HOLIDAYS = new Set<string>();

// 2026-06-01 is a Monday, so 06-06 is the Saturday and 06-07 the Sunday.
const MON = '2026-06-01';
const WED = '2026-06-03';
const SAT = '2026-06-06';
const SUN = '2026-06-07';

const MON_TO_FRI = [1, 2, 3, 4, 5];
const MON_TO_SAT = [1, 2, 3, 4, 5, 6];
/** A hotel: closed Wednesday, open every other day including Sunday. */
const HOTEL = [0, 1, 2, 4, 5, 6];
/** Open every single day — no rest day is identifiable from the week alone. */
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const day = (date: string, hours = 8): WorkedDayHours => ({
  date,
  regularHours: Math.min(hours, 8),
  overtimeHours: Math.max(0, hours - 8),
});

describe('resolveRestWeekday', () => {
  it('defaults to Sunday when no working week is configured', () => {
    // The overwhelmingly common case, and identical to the old hardcode.
    expect(resolveRestWeekday(undefined)).toBe(0);
    expect(resolveRestWeekday([])).toBe(0);
  });

  it('keeps Sunday for any company that does not work Sundays', () => {
    // Art. 30(2)'s default. A six-day Mon–Sat business rests on Sunday.
    expect(resolveRestWeekday(MON_TO_FRI)).toBe(0);
    expect(resolveRestWeekday(MON_TO_SAT)).toBe(0);
  });

  it('follows the actual rest day when the company works Sundays', () => {
    // The Art. 30(2) case: exactly one day off, and it is not Sunday.
    expect(resolveRestWeekday(HOTEL)).toBe(3); // Wednesday
  });

  it('declines to guess when Sunday is worked and several days are off', () => {
    // Art. 30(1) gives ONE rest period and nothing here says which day it is.
    // Returning null leaves the hours at 1× and visible for manual entry —
    // inventing a doubled day on no authority would be worse.
    expect(resolveRestWeekday([1, 2, 3, 0])).toBeNull();
  });

  it('treats a seven-day week as having no identifiable rest day', () => {
    // Working all seven days breaches Art. 30(1), but that is a compliance
    // problem to surface elsewhere, not a licence to pick a day at random.
    expect(resolveRestWeekday(EVERY_DAY)).toBeNull();
  });

  it('ignores out-of-range weekday numbers rather than trusting them', () => {
    expect(resolveRestWeekday([9, -1])).toBe(0);
  });
});

describe('classifyWorkedHours — nobody existing gets a pay change', () => {
  it('still pays Sunday at 2x and Saturday at 1x with no config', () => {
    // The regression that matters most: this is what every tenant has today.
    const result = classifyWorkedHours([day(SAT), day(SUN)], NO_HOLIDAYS);
    expect(result.restDayHours).toBe(8);
    expect(result.regularHours).toBe(8);
  });

  it('still pays Saturday at 1x for an explicit Mon–Fri week', () => {
    // Saturday is a day OFF, not the dia de descanso semanal. Paying it at 2x
    // would have been a silent raise across the whole customer base.
    const result = classifyWorkedHours([day(SAT), day(SUN)], NO_HOLIDAYS, MON_TO_FRI);
    expect(result.restDayHours).toBe(8);
    expect(result.regularHours).toBe(8);
  });
});

describe('classifyWorkedHours — the hotel case Art. 30(2) exists for', () => {
  it('pays the actual rest day at 2x', () => {
    const result = classifyWorkedHours([day(WED)], NO_HOLIDAYS, HOTEL);
    expect(result.restDayHours).toBe(8);
    expect(result.regularHours).toBe(0);
  });

  it('pays a worked Sunday at ordinary rate for that business', () => {
    // The other half of the old bug: Sunday was a 2x day for everyone, so a
    // hotel was overpaying every Sunday shift.
    const result = classifyWorkedHours([day(SUN)], NO_HOLIDAYS, HOTEL);
    expect(result.restDayHours).toBe(0);
    expect(result.regularHours).toBe(8);
  });

  it('leaves hours at 1x when the rest day cannot be identified', () => {
    const result = classifyWorkedHours([day(WED), day(SUN)], NO_HOLIDAYS, EVERY_DAY);
    expect(result.restDayHours).toBe(0);
    expect(result.regularHours).toBe(16);
  });
});

describe('classifyWorkedHours — a holiday still wins over the rest day', () => {
  it('counts a rest day that is also a holiday once, as holiday', () => {
    // Same 2x rate either way; the point is never to book the hours twice.
    const result = classifyWorkedHours([day(WED)], new Set([WED]), HOTEL);
    expect(result.holidayHours).toBe(8);
    expect(result.restDayHours).toBe(0);
  });
});

describe('classifyWorkedHours — the weekly cap still applies', () => {
  it('does not let rest-day hours inflate the Art. 25(1) 44h top-up', () => {
    // Rest-day hours already left the regular bucket at a premium, so counting
    // them again toward the weekly cap would double-book the excess.
    const week = [MON, '2026-06-02', WED, '2026-06-04', '2026-06-05'].map((d) =>
      day(d),
    );
    const result = classifyWorkedHours([...week, day(SUN)], NO_HOLIDAYS, MON_TO_FRI);
    expect(result.restDayHours).toBe(8);
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(0);
  });
});
