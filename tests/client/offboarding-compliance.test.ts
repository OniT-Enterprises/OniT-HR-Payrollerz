import { describe, expect, it } from 'vitest';
import {
  requiredNoticeDays,
  noticeDaysGiven,
  noticeShortfallDays,
  inssCessationDeadline,
  severanceDefaultForReason,
} from '@/lib/payroll/leaver-final-pay';
import {
  DEFAULT_OFFBOARDING_CHECKLIST,
  OFFBOARDING_CHECKLIST_KEYS,
  getChecklistProgress,
  normalizeOffboardingChecklist,
  type OffboardingChecklist,
} from '@/lib/hiring/offboarding-checklist';

/**
 * Offboarding compliance helpers (Lei 4/2012 + DL 20/2017) — pure functions
 * behind the Offboarding page:
 *  - E7 notice periods: Arts. 49(8)-(9) (employer-side, 15/30 days by tenure)
 *    and 53(2)-(3) (resignation, 30 days);
 *  - F12 INSS cessation deadline: DL 20/2017 Art. 5(2)-(3), day 10 of the
 *    month after cessation;
 *  - F24 death as a departure cause: Art. 47(1)(b) caducidade;
 *  - F12 checklist progress math staying correct for legacy cases that
 *    predate newer checklist keys.
 */

describe('requiredNoticeDays (Arts. 49(8), 53(2))', () => {
  it('resignation always requires 30 days written notice, regardless of tenure', () => {
    const short = requiredNoticeDays('resignation', '2026-01-01', '2026-06-30');
    const long = requiredNoticeDays('resignation', '2015-01-01', '2026-06-30');
    expect(short.days).toBe(30);
    expect(long.days).toBe(30);
    expect(short.basis).toBe('Lei 4/2012 Art. 53(2)');
  });

  it('employer-side causes: 15 days at tenure up to 2 years', () => {
    expect(requiredNoticeDays('redundancy', '2025-03-01', '2026-06-30')).toEqual({
      days: 15,
      basis: 'Lei 4/2012 Art. 49(8)',
    });
    expect(requiredNoticeDays('termination', '2025-03-01', '2026-06-30').days).toBe(15);
  });

  it('employer-side causes: 30 days beyond 2 years of tenure', () => {
    expect(requiredNoticeDays('redundancy', '2020-01-15', '2026-06-30')).toEqual({
      days: 30,
      basis: 'Lei 4/2012 Art. 49(8)',
    });
    expect(requiredNoticeDays('termination', '2019-06-01', '2026-09-15').days).toBe(30);
  });

  it('tenure boundary: exactly 2 years is still the 15-day band; one day beyond is 30', () => {
    expect(requiredNoticeDays('redundancy', '2024-06-30', '2026-06-30').days).toBe(15);
    expect(requiredNoticeDays('redundancy', '2024-06-29', '2026-06-30').days).toBe(30);
  });

  it('missing/invalid hire date on an employer-side cause assumes the longer 30 days', () => {
    expect(requiredNoticeDays('redundancy', '', '2026-06-30').days).toBe(30);
    expect(requiredNoticeDays('termination', 'not-a-date', '2026-06-30').days).toBe(30);
  });

  it('no statutory notice for the remaining causes', () => {
    (['retirement', 'contract_end', 'mutual_agreement', 'death', 'other'] as const).forEach(
      (reason) => {
        expect(requiredNoticeDays(reason, '2020-01-01', '2026-06-30')).toEqual({
          days: 0,
          basis: 'none',
        });
      },
    );
  });
});

describe('noticeDaysGiven / noticeShortfallDays (Arts. 49(9), 53(3))', () => {
  it('counts calendar days between notice date and last working day', () => {
    expect(noticeDaysGiven('2026-06-01', '2026-07-01')).toBe(30);
    expect(noticeDaysGiven('2026-06-16', '2026-06-30')).toBe(14);
  });

  it('notice given on/after the last working day counts as zero days', () => {
    expect(noticeDaysGiven('2026-06-30', '2026-06-30')).toBe(0);
    expect(noticeDaysGiven('2026-07-05', '2026-06-30')).toBe(0);
  });

  it('returns null when either date is missing or invalid', () => {
    expect(noticeDaysGiven('', '2026-06-30')).toBeNull();
    expect(noticeDaysGiven('2026-06-01', '')).toBeNull();
    expect(noticeDaysGiven('2026-13-01', '2026-06-30')).toBeNull();
    expect(noticeDaysGiven('2026-02-30', '2026-06-30')).toBeNull();
  });

  it('shortfall is required minus given, clamped at zero', () => {
    // 30 required, 30 given → satisfied.
    expect(noticeShortfallDays('2026-06-01', '2026-07-01', 30)).toBe(0);
    // 30 required, 12 given → 18 days' pay owed.
    expect(noticeShortfallDays('2026-06-19', '2026-07-01', 30)).toBe(18);
    // More notice than required is never a negative shortfall.
    expect(noticeShortfallDays('2026-05-01', '2026-07-01', 30)).toBe(0);
    // Unevaluable dates propagate null.
    expect(noticeShortfallDays('', '2026-07-01', 30)).toBeNull();
  });
});

describe('inssCessationDeadline (DL 20/2017 Art. 5(2)-(3))', () => {
  it('is day 10 of the month following the last working day', () => {
    expect(inssCessationDeadline('2026-06-15')).toBe('2026-07-10');
    expect(inssCessationDeadline('2026-06-01')).toBe('2026-07-10');
    expect(inssCessationDeadline('2026-06-30')).toBe('2026-07-10');
  });

  it('rolls over the year for December cessations', () => {
    expect(inssCessationDeadline('2026-12-03')).toBe('2027-01-10');
    expect(inssCessationDeadline('2026-12-31')).toBe('2027-01-10');
  });

  it('returns null for missing/invalid dates', () => {
    expect(inssCessationDeadline('')).toBeNull();
    expect(inssCessationDeadline('30/06/2026')).toBeNull();
  });
});

describe("severanceDefaultForReason('death') — Art. 47(1)(b) caducidade", () => {
  it('defaults ON (statute-literal: Art. 56 is payable to the heirs)', () => {
    expect(severanceDefaultForReason('death')).toBe(true);
  });
});

describe('offboarding checklist progress (legacy-doc safety)', () => {
  const allTrue = (): OffboardingChecklist =>
    OFFBOARDING_CHECKLIST_KEYS.reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as OffboardingChecklist,
    );

  it('has inssCessationDeclared in the canonical key set, default false', () => {
    expect(OFFBOARDING_CHECKLIST_KEYS).toContain('inssCessationDeclared');
    expect(DEFAULT_OFFBOARDING_CHECKLIST.inssCessationDeclared).toBe(false);
  });

  it('0% when nothing done, 100% when every canonical item is done', () => {
    expect(getChecklistProgress(DEFAULT_OFFBOARDING_CHECKLIST)).toBe(0);
    expect(getChecklistProgress(allTrue())).toBe(100);
  });

  it('a legacy case missing the new key never shows a premature 100%', () => {
    // Stored before inssCessationDeclared existed: 8 keys, all ticked.
    const legacy: Partial<OffboardingChecklist> = {
      accessRevoked: true,
      equipmentReturned: true,
      documentsSigned: true,
      knowledgeTransfer: true,
      finalPayCalculated: true,
      benefitsCancelled: true,
      exitInterviewCompleted: true,
      referenceLetter: true,
    };
    // 8 of 9 → 89%, the absent key counts as not done.
    expect(getChecklistProgress(legacy)).toBe(89);
  });

  it('normalizeOffboardingChecklist fills absent keys with false and keeps stored values', () => {
    const normalized = normalizeOffboardingChecklist({ accessRevoked: true });
    expect(normalized.accessRevoked).toBe(true);
    expect(normalized.inssCessationDeclared).toBe(false);
    expect(Object.keys(normalized).sort()).toEqual([...OFFBOARDING_CHECKLIST_KEYS].sort());
    expect(normalizeOffboardingChecklist(undefined)).toEqual(DEFAULT_OFFBOARDING_CHECKLIST);
  });
});
