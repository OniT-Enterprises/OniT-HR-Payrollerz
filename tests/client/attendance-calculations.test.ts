/**
 * Unit tests for attendance calculation helpers:
 * - computeEntryHours (break deduction, overnight, typo detection threshold)
 * - determineStatus (mid-shift entries must not be half_day)
 * - calculateLateMinutes / calculateEarlyDeparture (shift-aware expected times)
 */
import { describe, it, expect } from 'vitest';
import {
  calculateHoursBetween,
  computeEntryHours,
  calculateLateMinutes,
  calculateEarlyDeparture,
  determineStatus,
  calculateHoursBreakdown,
  MAX_REASONABLE_ENTRY_HOURS,
} from '../../client/services/attendanceService';

describe('calculateHoursBetween', () => {
  it('computes a normal span', () => {
    expect(calculateHoursBetween('08:00', '17:00')).toBe(9);
  });

  it('wraps overnight spans', () => {
    expect(calculateHoursBetween('22:00', '06:00')).toBe(8);
  });

  it('returns 0 for missing or malformed input', () => {
    expect(calculateHoursBetween('', '17:00')).toBe(0);
    expect(calculateHoursBetween('abc', 'def')).toBe(0);
  });
});

describe('computeEntryHours', () => {
  it('deducts the default break from a full day', () => {
    const r = computeEntryHours('08:00', '17:00');
    expect(r.breakMinutes).toBe(60);
    expect(r.totalHours).toBe(8);
  });

  it('does NOT deduct a break from short entries', () => {
    const r = computeEntryHours('08:00', '12:00');
    expect(r.breakMinutes).toBe(0);
    expect(r.totalHours).toBe(4);
  });

  it('uses an explicit break when provided', () => {
    const r = computeEntryHours('08:00', '17:00', 30);
    expect(r.breakMinutes).toBe(30);
    expect(r.totalHours).toBe(8.5);
  });

  it('flags reversed clock-out typos as unreasonable', () => {
    // clock-in 09:00, clock-out 08:30 — a one-keystroke slip
    const r = computeEntryHours('09:00', '08:30');
    expect(r.isOvernight).toBe(true);
    expect(r.totalHours).toBeGreaterThan(MAX_REASONABLE_ENTRY_HOURS);
  });

  it('treats a legitimate night shift as reasonable', () => {
    const r = computeEntryHours('22:00', '06:00');
    expect(r.isOvernight).toBe(true);
    expect(r.totalHours).toBe(7); // 8h minus default break
    expect(r.totalHours).toBeLessThanOrEqual(MAX_REASONABLE_ENTRY_HOURS);
  });

  it('returns zero hours when clock-out is missing', () => {
    const r = computeEntryHours('08:00', '');
    expect(r.totalHours).toBe(0);
    expect(r.isOvernight).toBe(false);
  });
});

describe('determineStatus', () => {
  it('marks a shift in progress as present, not half_day', () => {
    expect(determineStatus('08:00', undefined, 0, 0)).toBe('present');
  });

  it('marks a late shift in progress as late', () => {
    expect(determineStatus('08:30', undefined, 30, 0)).toBe('late');
  });

  it('keeps half_day for completed short days', () => {
    expect(determineStatus('08:00', '11:00', 0, 3)).toBe('half_day');
  });

  it('tolerates lateness within the grace period', () => {
    expect(determineStatus('08:10', '17:00', 10, 8)).toBe('present');
  });

  it('marks completed late days as late', () => {
    expect(determineStatus('09:00', '17:00', 60, 7)).toBe('late');
  });

  it('marks no clocks at all as absent', () => {
    expect(determineStatus(undefined, undefined, 0, 0)).toBe('absent');
  });
});

describe('shift-aware lateness', () => {
  it('is not late against an afternoon shift start', () => {
    // 14:00 shift, clocked in 14:05 — 5 minutes late, within grace
    expect(calculateLateMinutes('14:05', '14:00')).toBe(5);
  });

  it('would be six hours late against the old hardcoded default', () => {
    // The bug this guards against: afternoon workers judged against 08:00
    expect(calculateLateMinutes('14:05')).toBe(365);
  });

  it('computes early departure against the shift end', () => {
    expect(calculateEarlyDeparture('21:30', '22:00')).toBe(30);
    expect(calculateEarlyDeparture('22:00', '22:00')).toBe(0);
  });
});

describe('calculateHoursBreakdown', () => {
  it('splits regular and overtime at the TL daily standard', () => {
    expect(calculateHoursBreakdown(8)).toEqual({ regular: 8, overtime: 0 });
    expect(calculateHoursBreakdown(10)).toEqual({ regular: 8, overtime: 2 });
  });
});
