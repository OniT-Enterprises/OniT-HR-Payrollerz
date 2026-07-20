/**
 * Unit tests for the Lei 4/2012 weekly-hours classification helpers
 * (client/lib/attendanceCalculations.ts):
 *
 * - classifyWorkedHours: Art. 25(1) weekly 44h overtime top-up, Art. 27(2)
 *   holiday reclassification, Arts. 30(2)/27(2) Sunday rest-day
 *   reclassification (holiday wins on overlap), and the Art. 27(3)/(4)
 *   per-day / per-week cap maxima.
 * - needsBreakWarning: Art. 25(2) break-entitlement predicate.
 * - isoWeekStart / weekdayOf: pure date bucketing.
 *
 * Week fixture (2026): Mon Jun 1 … Sun Jun 7; Mon Jun 8 … Sun Jun 14.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyWorkedHours,
  needsBreakWarning,
  isoWeekStart,
  weekdayOf,
  type WorkedDayHours,
} from '../../client/lib/attendanceCalculations';

const NO_HOLIDAYS = new Set<string>();

/** n standard 8h days starting Mon 2026-06-01 (Mon–Sat = 6 workdays max). */
function standardDays(dates: string[], hours = 8): WorkedDayHours[] {
  return dates.map((date) => ({
    date,
    regularHours: Math.min(hours, 8),
    overtimeHours: Math.max(0, hours - 8),
  }));
}

const WEEK1_MON_TO_SAT = [
  '2026-06-01',
  '2026-06-02',
  '2026-06-03',
  '2026-06-04',
  '2026-06-05',
  '2026-06-06',
];

describe('isoWeekStart / weekdayOf', () => {
  it('buckets Mon–Sun into the same ISO week', () => {
    expect(isoWeekStart('2026-06-01')).toBe('2026-06-01'); // Monday
    expect(isoWeekStart('2026-06-06')).toBe('2026-06-01'); // Saturday
    expect(isoWeekStart('2026-06-07')).toBe('2026-06-01'); // Sunday
    expect(isoWeekStart('2026-06-08')).toBe('2026-06-08'); // next Monday
  });

  it('spans month boundaries (Jun 30 + Jul 1 share a week)', () => {
    expect(isoWeekStart('2026-06-30')).toBe(isoWeekStart('2026-07-01'));
  });

  it('identifies Sunday timezone-independently', () => {
    expect(weekdayOf('2026-06-07')).toBe(0);
    expect(weekdayOf('2026-06-01')).toBe(1);
  });
});

describe('classifyWorkedHours — Art. 25(1) weekly 44h overtime top-up', () => {
  it('reclassifies 4h of a 6x8h (48h) week into overtime (the L1 live bug)', () => {
    const result = classifyWorkedHours(
      standardDays(WEEK1_MON_TO_SAT),
      NO_HOLIDAYS,
    );
    expect(result.regularHours).toBe(44);
    expect(result.overtimeHours).toBe(4);
    expect(result.maxWeeklyOvertimeHours).toBe(4);
    // The top-up cannot be attributed to one day, so the daily max stays 0.
    expect(result.maxDailyOvertimeHours).toBe(0);
  });

  it('does not double-count daily overtime already split out', () => {
    // Mon 12h (4h daily OT) + Tue–Fri 8h = 44h worked, weekRegular = 40 ≤ 44.
    const days: WorkedDayHours[] = [
      { date: '2026-06-01', regularHours: 8, overtimeHours: 4 },
      ...standardDays(['2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05']),
    ];
    const result = classifyWorkedHours(days, NO_HOLIDAYS);
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(4); // daily split only, no top-up
    expect(result.maxDailyOvertimeHours).toBe(4);
    expect(result.maxWeeklyOvertimeHours).toBe(4);
  });

  it('combines daily overtime with the weekly top-up (Mon–Sat 10h each)', () => {
    // 60h worked: daily OT 6x2=12; weekRegular 48 → top-up 4 → 16h OT total.
    const days = WEEK1_MON_TO_SAT.map((date) => ({
      date,
      regularHours: 8,
      overtimeHours: 2,
    }));
    const result = classifyWorkedHours(days, NO_HOLIDAYS);
    expect(result.regularHours).toBe(44);
    expect(result.overtimeHours).toBe(16);
    expect(result.maxWeeklyOvertimeHours).toBe(16);
    expect(result.maxDailyOvertimeHours).toBe(2);
  });

  it('applies the top-up per ISO week, not across the whole period', () => {
    // Two 48h weeks → 4h OT each, 8h total; regular 88.
    const week2 = [
      '2026-06-08',
      '2026-06-09',
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
      '2026-06-13',
    ];
    const result = classifyWorkedHours(
      standardDays([...WEEK1_MON_TO_SAT, ...week2]),
      NO_HOLIDAYS,
    );
    expect(result.regularHours).toBe(88);
    expect(result.overtimeHours).toBe(8);
    expect(result.maxWeeklyOvertimeHours).toBe(4);
  });

  it('only counts days inside the summary range (boundary limitation)', () => {
    // The week of Mon Jun 29 straddles a month boundary; a June run only sees
    // Jun 29–30 (16h), well under 44 — no top-up. Accepted limitation: run
    // periods start at month boundaries, so the straddling week's July days
    // belong to the next run.
    const result = classifyWorkedHours(
      standardDays(['2026-06-29', '2026-06-30']),
      NO_HOLIDAYS,
    );
    expect(result.overtimeHours).toBe(0);
    expect(result.regularHours).toBe(16);
  });
});

describe('classifyWorkedHours — holiday and Sunday rest-day (L2 live bug)', () => {
  it('reclassifies Sunday work into restDayHours (Art. 30(2) default rest day)', () => {
    const days: WorkedDayHours[] = [
      ...standardDays(['2026-06-01', '2026-06-02']),
      { date: '2026-06-07', regularHours: 6, overtimeHours: 0 }, // Sunday
    ];
    const result = classifyWorkedHours(days, NO_HOLIDAYS);
    expect(result.restDayHours).toBe(6);
    expect(result.regularHours).toBe(16); // Sunday hours left the 1x bucket
    expect(result.overtimeHours).toBe(0);
    expect(result.holidayHours).toBe(0);
  });

  it('moves Sunday overtime-split hours into restDayHours too', () => {
    // A 10h Sunday arrives as 8 regular + 2 overtime from the daily split;
    // ALL of it is 2x rest-day time.
    const result = classifyWorkedHours(
      [{ date: '2026-06-07', regularHours: 8, overtimeHours: 2 }],
      NO_HOLIDAYS,
    );
    expect(result.restDayHours).toBe(10);
    expect(result.overtimeHours).toBe(0);
    expect(result.maxHolidayOrRestDayHours).toBe(10);
  });

  it('counts a Sunday public holiday as holiday ONLY — never double', () => {
    const holidays = new Set(['2026-06-07']);
    const result = classifyWorkedHours(
      [{ date: '2026-06-07', regularHours: 8, overtimeHours: 0 }],
      holidays,
    );
    expect(result.holidayHours).toBe(8);
    expect(result.restDayHours).toBe(0);
    expect(result.regularHours).toBe(0);
  });

  it('reclassifies weekday holiday work into holidayHours (regular + OT)', () => {
    const holidays = new Set(['2026-06-01']);
    const result = classifyWorkedHours(
      [{ date: '2026-06-01', regularHours: 8, overtimeHours: 1 }],
      holidays,
    );
    expect(result.holidayHours).toBe(9);
    expect(result.regularHours).toBe(0);
    expect(result.overtimeHours).toBe(0);
  });

  it('excludes holiday/rest-day hours from the weekly 44h pass', () => {
    // Mon holiday 8h + Tue–Sat 8h (40h regular) + Sun 8h: weekRegular = 40,
    // no top-up — the 2x-paid days must not manufacture weekly overtime.
    const holidays = new Set(['2026-06-01']);
    const days: WorkedDayHours[] = [
      ...standardDays([...WEEK1_MON_TO_SAT]),
      { date: '2026-06-07', regularHours: 8, overtimeHours: 0 },
    ];
    const result = classifyWorkedHours(days, holidays);
    expect(result.holidayHours).toBe(8);
    expect(result.restDayHours).toBe(8);
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(0);
  });
});

describe('classifyWorkedHours — Art. 27(3)/(4) cap maxima', () => {
  it('detects a single day over the 4h/day overtime cap', () => {
    // 13h Wednesday → 5h daily OT (> 4h cap).
    const result = classifyWorkedHours(
      [{ date: '2026-06-03', regularHours: 8, overtimeHours: 5 }],
      NO_HOLIDAYS,
    );
    expect(result.maxDailyOvertimeHours).toBe(5);
    expect(result.maxWeeklyOvertimeHours).toBe(5);
  });

  it('detects a week over the 16h/week overtime cap', () => {
    // Mon–Sat 11h each: daily OT 18 (3h/day), weekRegular 48 → top-up 4 → 22.
    const days = WEEK1_MON_TO_SAT.map((date) => ({
      date,
      regularHours: 8,
      overtimeHours: 3,
    }));
    const result = classifyWorkedHours(days, NO_HOLIDAYS);
    expect(result.maxWeeklyOvertimeHours).toBe(22);
    expect(result.maxDailyOvertimeHours).toBe(3); // per-day cap NOT breached
  });

  it('tracks the largest single holiday/rest-day stretch for Art. 27(3)', () => {
    const holidays = new Set(['2026-06-01']);
    const days: WorkedDayHours[] = [
      { date: '2026-06-01', regularHours: 8, overtimeHours: 2 }, // 10h holiday
      { date: '2026-06-07', regularHours: 6, overtimeHours: 0 }, // 6h Sunday
    ];
    const result = classifyWorkedHours(days, holidays);
    expect(result.maxHolidayOrRestDayHours).toBe(10); // > 8 → warning fires
  });

  it('returns zeros for an empty period', () => {
    const result = classifyWorkedHours([], NO_HOLIDAYS);
    expect(result).toEqual({
      regularHours: 0,
      overtimeHours: 0,
      holidayHours: 0,
      restDayHours: 0,
      maxDailyOvertimeHours: 0,
      maxWeeklyOvertimeHours: 0,
      maxHolidayOrRestDayHours: 0,
    });
  });
});

describe('needsBreakWarning — Art. 25(2) break entitlement', () => {
  it('warns on a 5–6h span with no recorded break', () => {
    // 5.5h raw, under the 6h default-break assumption threshold.
    expect(needsBreakWarning('08:00', '13:30')).toBe(true);
  });

  it('does NOT warn at exactly 5h (the entitlement starts AFTER 5h)', () => {
    expect(needsBreakWarning('08:00', '13:00')).toBe(false);
  });

  it('does NOT warn on a >=6h span with no recorded break (60-min default applies)', () => {
    expect(needsBreakWarning('08:00', '17:00')).toBe(false);
  });

  it('warns when an explicit break under 60min is recorded on a long span', () => {
    expect(needsBreakWarning('08:00', '17:00', 30)).toBe(true);
    expect(needsBreakWarning('08:00', '17:00', 0)).toBe(true);
  });

  it('does NOT warn when an explicit break of 60min+ is recorded', () => {
    expect(needsBreakWarning('08:00', '17:00', 60)).toBe(false);
    expect(needsBreakWarning('08:00', '17:00', 90)).toBe(false);
  });

  it('does NOT warn on short spans regardless of break', () => {
    expect(needsBreakWarning('08:00', '12:00', 0)).toBe(false);
    expect(needsBreakWarning('08:00', '12:00')).toBe(false);
  });

  it('does NOT warn on open entries (no clock-out)', () => {
    expect(needsBreakWarning('08:00', '')).toBe(false);
  });
});
