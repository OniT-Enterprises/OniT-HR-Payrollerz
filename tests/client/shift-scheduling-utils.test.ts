/**
 * Unit tests for shift-scheduling helpers:
 * - calcShiftHours (overnight-aware, replaces the buggy dialog calc that returned -16h)
 * - getWeekStartTL / addDaysISO (timezone-independent week math)
 */
import { describe, it, expect } from 'vitest';
import { calcShiftHours } from '../../client/services/shiftService';
import { getWeekStartTL, addDaysISO } from '../../client/lib/dateUtils';

describe('calcShiftHours', () => {
  it('calculates a normal day shift', () => {
    expect(calcShiftHours('06:00', '14:00')).toBe(8);
    expect(calcShiftHours('09:00', '17:30')).toBe(8.5);
  });

  it('handles overnight shifts instead of going negative', () => {
    expect(calcShiftHours('22:00', '06:00')).toBe(8);
    expect(calcShiftHours('23:30', '07:00')).toBe(7.5);
  });

  it('returns 0 for missing or malformed input', () => {
    expect(calcShiftHours('', '14:00')).toBe(0);
    expect(calcShiftHours('06:00', '')).toBe(0);
    expect(calcShiftHours('abc', 'def')).toBe(0);
  });
});

describe('addDaysISO', () => {
  it('adds and subtracts days across month boundaries', () => {
    expect(addDaysISO('2026-07-06', 7)).toBe('2026-07-13');
    expect(addDaysISO('2026-07-06', -7)).toBe('2026-06-29');
    expect(addDaysISO('2026-12-29', 7)).toBe('2027-01-05');
  });
});

describe('getWeekStartTL', () => {
  it('returns the Monday of the week containing the given date', () => {
    // 2026-07-06 is a Monday
    expect(getWeekStartTL('2026-07-06')).toBe('2026-07-06');
    // Wednesday → same Monday
    expect(getWeekStartTL('2026-07-08')).toBe('2026-07-06');
    // Sunday belongs to the week that started the previous Monday
    expect(getWeekStartTL('2026-07-12')).toBe('2026-07-06');
    // Next Monday starts a new week
    expect(getWeekStartTL('2026-07-13')).toBe('2026-07-13');
  });

  it('is stable across month boundaries', () => {
    // 2026-08-01 is a Saturday; its week starts Monday 2026-07-27
    expect(getWeekStartTL('2026-08-01')).toBe('2026-07-27');
  });

  it('defaults to the current week and returns a Monday', () => {
    const start = getWeekStartTL();
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Same result when passed back through — idempotent
    expect(getWeekStartTL(start)).toBe(start);
    // Adding 7 days lands on the next week's start
    expect(getWeekStartTL(addDaysISO(start, 7))).toBe(addDaysISO(start, 7));
  });
});
