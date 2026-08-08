/**
 * Leave duration over a configurable working week.
 *
 * Xefe counted Mon–Fri for everyone. Timor-Leste does not work that way: Art. 25
 * fixes the week at 44 hours — which is not five 8-hour days — and Art. 30(2)
 * makes Sunday only the DEFAULT rest day, departable where the service cannot be
 * interrupted. Most businesses here open six days.
 *
 * The old behaviour is the DEFAULT so nobody's durations move without a choice,
 * and these tests pin both halves of that promise.
 */
import { describe, expect, it } from 'vitest';
import {
  calculateWorkingDays,
  DEFAULT_WORKING_WEEKDAYS,
} from '../../client/services/leaveService';

// 2026-01-05 is a Monday, so 05–10 Jan is Mon…Sat and 11 Jan is the Sunday.
const MON = '2026-01-05';
const SAT = '2026-01-10';
const SUN = '2026-01-11';

const MON_TO_SAT = [1, 2, 3, 4, 5, 6];
const MON_TO_FRI = [1, 2, 3, 4, 5];
/** A hotel: closed Wednesday, open every other day including Sunday. */
const HOTEL = [0, 1, 2, 4, 5, 6];

describe('calculateWorkingDays — default is unchanged', () => {
  it('still skips Saturday and Sunday when no week is configured', () => {
    expect(calculateWorkingDays(MON, SAT)).toBe(5);
    expect(calculateWorkingDays(MON, SUN)).toBe(5);
  });

  it('exports the same default the server holds', () => {
    // functions/src/timeleave.ts owns DEFAULT_WORKING_WEEKDAYS too, and it
    // recomputes duration authoritatively — if these drift, the figure shown
    // and the figure stored disagree.
    expect([...DEFAULT_WORKING_WEEKDAYS].sort()).toEqual(MON_TO_FRI);
  });
});

describe('calculateWorkingDays — six-day week', () => {
  it('counts the Saturday a six-day business actually opens', () => {
    // The bug this fixes: sick Mon–Sat was 5 days, so the worker lost a day of
    // pay AND kept a day of entitlement they had already spent.
    expect(calculateWorkingDays(MON, SAT, [], MON_TO_SAT)).toBe(6);
  });

  it('still excludes the Sunday rest day', () => {
    expect(calculateWorkingDays(MON, SUN, [], MON_TO_SAT)).toBe(6);
  });
});

describe('calculateWorkingDays — a week that includes Sunday', () => {
  it('counts Sunday for a business that lawfully opens then', () => {
    // Art. 30(2): the rest day leaves Sunday where the service cannot be
    // interrupted. For this hotel the Sunday is worked and the Wednesday is not.
    expect(calculateWorkingDays(MON, SUN, [], HOTEL)).toBe(6);
  });

  it('excludes the rest day wherever the company puts it', () => {
    const wednesday = '2026-01-07';
    expect(calculateWorkingDays(wednesday, wednesday, [], HOTEL)).toBe(0);
  });
});

describe('calculateWorkingDays — holidays and bad input', () => {
  it('subtracts a public holiday from a configured week', () => {
    expect(calculateWorkingDays(MON, SAT, ['2026-01-07'], MON_TO_SAT)).toBe(5);
  });

  it('falls back to the default rather than counting zero', () => {
    // A tenant whose config is empty or corrupt must not have every leave
    // request silently become zero-length.
    expect(calculateWorkingDays(MON, SAT, [], [])).toBe(5);
    expect(calculateWorkingDays(MON, SAT, [], [9, -1])).toBe(5);
  });

  it('is unaffected by the order days are listed in', () => {
    expect(calculateWorkingDays(MON, SAT, [], [6, 3, 1, 5, 2, 4])).toBe(6);
  });
});
