/**
 * Unit tests for attendance calculation helpers:
 * - computeEntryHours (break deduction, overnight, typo detection threshold)
 * - determineStatus (mid-shift entries must not be half_day)
 * - calculateLateMinutes / calculateEarlyDeparture (shift-aware expected times)
 */
import { describe, it, expect } from 'vitest';
import {
  calculateHoursBetween,
  calculateNightHours,
  computeEntryHours,
  calculateLateMinutes,
  calculateEarlyDeparture,
  determineStatus,
  calculateHoursBreakdown,
  buildAttendanceWorkQueue,
  countMissingAttendanceDue,
  countOvernightAttendanceNeedingAttention,
  getAttendanceDocumentId,
  isAttendanceStartDue,
  selectAttendanceExpectation,
  MAX_REASONABLE_ENTRY_HOURS,
} from '../../client/lib/attendanceCalculations';

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

describe('calculateNightHours', () => {
  it('counts the 21:00–06:00 window of an overnight guard shift', () => {
    // 18:00 → 06:00: night portion is 21:00→06:00 = 9h
    expect(calculateNightHours('18:00', '06:00')).toBe(9);
  });

  it('is zero for a fully-daytime shift', () => {
    expect(calculateNightHours('06:00', '18:00')).toBe(0);
  });

  it('counts early-morning hours before 06:00', () => {
    // 04:00 → 08:00: 04:00–06:00 = 2h at night
    expect(calculateNightHours('04:00', '08:00')).toBe(2);
  });

  it('counts late-evening hours after 21:00', () => {
    // 20:00 → 23:00: 21:00–23:00 = 2h at night
    expect(calculateNightHours('20:00', '23:00')).toBe(2);
  });

  it('never exceeds the shift total when a break is present', () => {
    // 22:00 → 06:00 raw is 8h all at night, but only 6 paid hours worked
    expect(calculateNightHours('22:00', '06:00', 6)).toBe(6);
  });

  it('returns 0 for missing or malformed input', () => {
    expect(calculateNightHours('', '06:00')).toBe(0);
    expect(calculateNightHours('abc', 'def')).toBe(0);
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

  it('normalizes late arrivals and early departures across midnight', () => {
    expect(calculateLateMinutes('00:30', '22:00', '06:00')).toBe(150);
    expect(calculateLateMinutes('21:50', '22:00', '06:00')).toBe(0);
    expect(calculateEarlyDeparture('23:00', '06:00', '22:00')).toBe(420);
    expect(calculateEarlyDeparture('05:30', '06:00', '22:00')).toBe(30);
    expect(calculateEarlyDeparture('07:00', '06:00', '22:00')).toBe(0);
  });
});

describe('attendance shift selection', () => {
  it('ignores cancelled and private draft shifts', () => {
    expect(selectAttendanceExpectation([
      { startTime: '08:00', endTime: '17:00', status: 'cancelled' },
      { startTime: '20:00', endTime: '04:00', status: 'draft' },
      { startTime: '22:00', endTime: '06:00', status: 'published' },
    ])).toEqual({ start: '22:00', end: '06:00' });
    expect(selectAttendanceExpectation([
      { startTime: '20:00', endTime: '04:00', status: 'draft' },
    ])).toBeNull();
  });

  it('chooses deterministically when legacy data has multiple active shifts', () => {
    expect(selectAttendanceExpectation([
      { startTime: '14:00', endTime: '18:00', status: 'published' },
      { startTime: '08:00', endTime: '12:00', status: 'confirmed' },
    ])).toEqual({ start: '08:00', end: '12:00' });
  });

  it('builds stable employee/day document IDs', () => {
    expect(getAttendanceDocumentId('tenant a', 'emp/1', '2026-08-12'))
      .toBe('tenant%20a|emp%2F1|2026-08-12');
  });
});

describe('attendance work queue', () => {
  it('uses published schedules and omits unscheduled staff when schedules exist', () => {
    expect(buildAttendanceWorkQueue({
      employeeIds: ['night-1', 'day-1', 'off-1'],
      recordedEmployeeIds: [],
      shifts: [
        { employeeId: 'night-1', startTime: '22:00', endTime: '06:00', status: 'published' },
        { employeeId: 'day-1', startTime: '08:00', endTime: '17:00', status: 'draft' },
      ],
      leave: [],
      date: '2026-08-12',
    })).toEqual([
      { employeeId: 'night-1', startTime: '22:00', endTime: '06:00' },
    ]);
  });

  it('does not turn draft or cancelled schedules into default worked days', () => {
    expect(buildAttendanceWorkQueue({
      employeeIds: ['draft-1', 'cancelled-1'],
      recordedEmployeeIds: [],
      shifts: [
        { employeeId: 'draft-1', startTime: '22:00', endTime: '06:00', status: 'draft' },
        { employeeId: 'cancelled-1', startTime: '08:00', endTime: '17:00', status: 'cancelled' },
      ],
      leave: [],
      date: '2026-08-12',
    })).toEqual([]);
  });

  it('excludes recorded and full-day leave staff but keeps half-day leave actionable', () => {
    expect(buildAttendanceWorkQueue({
      employeeIds: ['recorded-1', 'leave-1', 'half-1', 'available-1'],
      recordedEmployeeIds: ['recorded-1'],
      shifts: [],
      leave: [
        {
          employeeId: 'leave-1', startDate: '2026-08-11', endDate: '2026-08-13',
          status: 'approved',
        },
        {
          employeeId: 'half-1', startDate: '2026-08-12', endDate: '2026-08-12',
          status: 'approved', halfDay: true,
        },
      ],
      date: '2026-08-12',
    })).toEqual([
      { employeeId: 'half-1', startTime: '08:00', endTime: '17:00' },
      { employeeId: 'available-1', startTime: '08:00', endTime: '17:00' },
    ]);
  });
});

describe('schedule-aware missing attendance', () => {
  it('does not flag a night worker before their shift starts', () => {
    expect(countMissingAttendanceDue({
      activeEmployeeCount: 1,
      recordedEmployeeIds: [],
      shifts: [{ employeeId: 'night-1', startTime: '22:00', status: 'published' }],
      currentMinutes: 20 * 60,
    })).toBe(0);
  });

  it('flags a published shift once its start and grace period have passed', () => {
    expect(isAttendanceStartDue('22:00', 22 * 60 + 14)).toBe(false);
    expect(isAttendanceStartDue('22:00', 22 * 60 + 15)).toBe(true);
    expect(countMissingAttendanceDue({
      recordedEmployeeIds: [],
      shifts: [{ employeeId: 'night-1', startTime: '22:00', status: 'published' }],
      currentMinutes: 22 * 60 + 15,
    })).toBe(1);
  });

  it('keeps draft workers out of both missing-attendance buckets', () => {
    expect(countMissingAttendanceDue({
      activeEmployeeCount: 1,
      recordedEmployeeIds: [],
      shifts: [{ employeeId: 'night-1', startTime: '22:00', status: 'draft' }],
      currentMinutes: 23 * 60,
    })).toBe(0);
  });

  it('uses the normal start for unscheduled staff without double-counting records', () => {
    expect(countMissingAttendanceDue({
      activeEmployeeCount: 4,
      recordedEmployeeIds: ['day-recorded'],
      shifts: [
        { employeeId: 'night-future', startTime: '22:00', status: 'published' },
        { employeeId: 'day-due', startTime: '08:00', status: 'confirmed' },
      ],
      currentMinutes: 9 * 60,
    })).toBe(2); // day-due + one other unscheduled employee
  });
});

describe('overnight attendance carryover', () => {
  const nightShift = {
    employeeId: 'night-1',
    startTime: '22:00',
    endTime: '06:00',
    status: 'published',
  };

  it('keeps a missing previous-night record visible without flagging an active shift', () => {
    expect(countOvernightAttendanceNeedingAttention([nightShift], [], 30)).toBe(1);
    expect(countOvernightAttendanceNeedingAttention(
      [nightShift],
      [{ employeeId: 'night-1', clockIn: '22:00' }],
      5 * 60,
    )).toBe(0);
    expect(countOvernightAttendanceNeedingAttention(
      [nightShift],
      [{ employeeId: 'night-1', clockIn: '22:00' }],
      6 * 60 + 16,
    )).toBe(1);
  });

  it('clears completed/absent records and ignores drafts and daytime shifts', () => {
    expect(countOvernightAttendanceNeedingAttention(
      [nightShift],
      [{ employeeId: 'night-1', clockIn: '22:00', clockOut: '06:00' }],
      8 * 60,
    )).toBe(0);
    expect(countOvernightAttendanceNeedingAttention(
      [nightShift],
      [{ employeeId: 'night-1' }],
      8 * 60,
    )).toBe(0);
    expect(countOvernightAttendanceNeedingAttention([
      { ...nightShift, status: 'draft' },
      { ...nightShift, employeeId: 'day-1', startTime: '08:00', endTime: '17:00' },
    ], [], 8 * 60)).toBe(0);
  });
});

describe('calculateHoursBreakdown', () => {
  it('splits regular and overtime at the TL daily standard', () => {
    expect(calculateHoursBreakdown(8)).toEqual({ regular: 8, overtime: 0 });
    expect(calculateHoursBreakdown(10)).toEqual({ regular: 8, overtime: 2 });
  });
});
