/**
 * Unit tests for the attendance import helpers on the Attendance page:
 * - parseImportTime: 24h passthrough + 12h AM/PM conversion (guards the
 *   silent 12-hour bug where "5:00 PM" was sliced to "05:00").
 * - describeSkippedImport: surfaces the count + reasons of dropped rows so an
 *   import can never silently lose rows.
 */
import { describe, it, expect } from 'vitest';
import {
  parseImportTime,
  describeSkippedImport,
  type SkippedImportRow,
} from '../../client/pages/time-leave/Attendance';

describe('parseImportTime', () => {
  it('passes a plain 24h time through unchanged', () => {
    expect(parseImportTime('17:00')).toBe('17:00');
    expect(parseImportTime('08:00')).toBe('08:00');
    expect(parseImportTime('00:00')).toBe('00:00');
    expect(parseImportTime('23:59')).toBe('23:59');
  });

  it('zero-pads a single-digit 24h hour', () => {
    expect(parseImportTime('9:05')).toBe('09:05');
  });

  it('converts a PM meridiem to 24h (the bug this guards)', () => {
    // "5:00 PM".slice(0,5) used to yield "5:00" -> treated as 05:00.
    expect(parseImportTime('5:00 PM')).toBe('17:00');
    expect(parseImportTime('5:00pm')).toBe('17:00');
    expect(parseImportTime('11:30 PM')).toBe('23:30');
  });

  it('converts an AM meridiem to 24h', () => {
    expect(parseImportTime('9:00 AM')).toBe('09:00');
    expect(parseImportTime('7:15am')).toBe('07:15');
  });

  it('handles the 12 AM / 12 PM edge cases', () => {
    expect(parseImportTime('12:00 AM')).toBe('00:00'); // midnight
    expect(parseImportTime('12:00 PM')).toBe('12:00'); // noon
    expect(parseImportTime('12:30 AM')).toBe('00:30');
  });

  it('tolerates trailing seconds', () => {
    expect(parseImportTime('17:00:00')).toBe('17:00');
  });

  it('rejects values it cannot trust', () => {
    expect(parseImportTime('')).toBeNull();
    expect(parseImportTime('   ')).toBeNull();
    expect(parseImportTime('abc')).toBeNull();
    expect(parseImportTime('25:00')).toBeNull(); // out of 24h range
    expect(parseImportTime('10:75')).toBeNull(); // minute out of range
    expect(parseImportTime('13:00 PM')).toBeNull(); // 13 with meridiem is bogus
    expect(parseImportTime('5:00 PM extra')).toBeNull(); // anchored: no trailing junk
    expect(parseImportTime('noon')).toBeNull();
  });
});

describe('describeSkippedImport', () => {
  it('returns an empty string when nothing was skipped', () => {
    expect(describeSkippedImport([], 120)).toBe('');
  });

  it('summarises count and per-reason breakdown', () => {
    const skipped: SkippedImportRow[] = [
      ...Array.from({ length: 20 }, (_, i) => ({ rowNumber: i + 2, reason: 'employee' as const, detail: 'x' })),
      ...Array.from({ length: 15 }, (_, i) => ({ rowNumber: i + 40, reason: 'date' as const, detail: 'x' })),
      ...Array.from({ length: 10 }, (_, i) => ({ rowNumber: i + 80, reason: 'time' as const, detail: 'x' })),
    ];
    const summary = describeSkippedImport(skipped, 120);
    expect(summary).toContain('45 of 120 rows were skipped');
    expect(summary).toContain('20 with no matching employee');
    expect(summary).toContain('15 with an invalid date');
    expect(summary).toContain('10 with an invalid time');
  });

  it('omits reason clauses with a zero count', () => {
    const skipped: SkippedImportRow[] = [
      { rowNumber: 2, reason: 'employee', detail: 'Jon' },
    ];
    const summary = describeSkippedImport(skipped, 3);
    expect(summary).toBe('1 of 3 rows were skipped and not imported: 1 with no matching employee.');
    expect(summary).not.toContain('invalid date');
    expect(summary).not.toContain('invalid time');
  });
});
