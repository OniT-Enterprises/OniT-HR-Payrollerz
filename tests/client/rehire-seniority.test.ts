/**
 * Re-engagement seniority (mined answer A4) — Lei 4/2012 Arts. 12, 7.
 *
 * Xefe's rehire action moved hireDate to the new start date UNCONDITIONALLY,
 * which erased service a short-break worker was still entitled to. A practitioner
 * advisory states the rule: a new fixed-term contract with the same worker for the
 * same reason within 90 days automatically becomes permanent and seniority counts
 * from the ORIGINAL start date; beyond 90 days service may restart "unless
 * continuity is proven". Evidence: docs/MINED_ANSWERS_TERMINATION_AUG2026.md §A4.
 *
 * The second half of this file guards the hazard the fix introduces: carrying
 * seniority back means a later termination computes Art. 56 over the whole
 * carried-back service, and the committed-final-pay lookup only spans the
 * termination year ±~2 months, so it cannot see a severance settled before that.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveRehireSeniority,
  resolveLeaverFinalPay,
  REENGAGEMENT_CONTINUITY_DAYS,
} from '@/lib/payroll/leaver-final-pay';

describe('resolveRehireSeniority', () => {
  const originalHireDate = '2015-03-01';

  it('keeps the ORIGINAL hire date when re-engaged inside the 90-day window', () => {
    const r = resolveRehireSeniority({
      originalHireDate,
      previousTerminationDate: '2026-02-28',
      newStartDate: '2026-04-01', // 32 days later
    });
    expect(r.hireDate).toBe(originalHireDate);
    expect(r.seniorityContinuous).toBe(true);
    expect(r.gapDays).toBe(32);
    expect(r.becomesPermanent).toBe(true);
    expect(r.basis).toContain('Art. 12');
  });

  it('treats the 90th day as still continuous (boundary inclusive)', () => {
    const r = resolveRehireSeniority({
      originalHireDate,
      previousTerminationDate: '2026-01-01',
      newStartDate: '2026-04-01', // exactly 90 days
    });
    expect(r.gapDays).toBe(REENGAGEMENT_CONTINUITY_DAYS);
    expect(r.seniorityContinuous).toBe(true);
    expect(r.becomesPermanent).toBe(true);
  });

  it('restarts service one day past the window', () => {
    const r = resolveRehireSeniority({
      originalHireDate,
      previousTerminationDate: '2026-01-01',
      newStartDate: '2026-04-02', // 91 days
    });
    expect(r.gapDays).toBe(91);
    expect(r.hireDate).toBe('2026-04-02');
    expect(r.seniorityContinuous).toBe(false);
    expect(r.becomesPermanent).toBe(false);
  });

  it('same-day re-engagement is continuous', () => {
    const r = resolveRehireSeniority({
      originalHireDate,
      previousTerminationDate: '2026-02-28',
      newStartDate: '2026-02-28',
    });
    expect(r.gapDays).toBe(0);
    expect(r.seniorityContinuous).toBe(true);
  });

  it('lets a reviewer assert continuity beyond the window', () => {
    const r = resolveRehireSeniority({
      originalHireDate,
      previousTerminationDate: '2025-01-01',
      newStartDate: '2026-04-01',
      continuityProven: true,
    });
    expect(r.seniorityContinuous).toBe(true);
    expect(r.hireDate).toBe(originalHireDate);
    // Continuity was asserted, not automatic — the Art. 12 conversion does NOT follow.
    expect(r.becomesPermanent).toBe(false);
    expect(r.basis).toContain('reviewer');
  });

  it('cannot establish continuity from a missing or unreadable termination date', () => {
    for (const bad of [undefined, null, '', 'not-a-date', '2026-13-01', '2026-02-30']) {
      const r = resolveRehireSeniority({
        originalHireDate,
        previousTerminationDate: bad as string | null | undefined,
        newStartDate: '2026-04-01',
      });
      expect(r.gapDays).toBeNull();
      expect(r.seniorityContinuous).toBe(false);
      expect(r.hireDate).toBe('2026-04-01');
      // Reported rather than silently reset, so the UI can ask.
      expect(r.basis).toContain('no usable previous termination date');
    }
  });

  it('falls back to the new start when the original hire date is unusable', () => {
    const r = resolveRehireSeniority({
      originalHireDate: '',
      previousTerminationDate: '2026-02-28',
      newStartDate: '2026-04-01',
    });
    expect(r.hireDate).toBe('2026-04-01');
    expect(r.seniorityContinuous).toBe(false);
  });
});

describe('resolveLeaverFinalPay — carried-back seniority must not re-pay Art. 56', () => {
  const base = {
    inPeriodTermination: '2027-08-31',
    monthlySalary: 220,
    hireDate: '2015-03-01', // carried back
    asOfDate: new Date('2027-08-31T00:00:00'),
    includeSubsidioAnual: true,
    committed: { serviceCompensation: 0, subsidioAnual: 0, subsidioAnualByRun: [] },
    severanceEntitled: true,
  };

  it('pays severance when nothing was settled earlier', () => {
    const r = resolveLeaverFinalPay(base);
    expect(r.terminationDate).toBe('2027-08-31');
  });

  it('suppresses severance when it was settled before the re-engagement', () => {
    // The scenario the committed lookup CANNOT catch: severance settled Nov 2026,
    // rehired Jan 2027, terminated Aug 2027. yearPayDateWindow(2027) starts
    // 2026-12-01, so the Nov 2026 run is invisible to it.
    const r = resolveLeaverFinalPay({ ...base, priorServiceCompensationSettled: true });
    expect(r.terminationDate).toBeUndefined();
  });

  it('still suppresses on an in-window committed payment', () => {
    const r = resolveLeaverFinalPay({
      ...base,
      committed: { ...base.committed, serviceCompensation: 440 },
    });
    expect(r.terminationDate).toBeUndefined();
  });

  it('never turns a suppression into a payment', () => {
    // severanceEntitled false always wins, whatever the prior-settlement flag says.
    expect(
      resolveLeaverFinalPay({
        ...base,
        severanceEntitled: false,
        priorServiceCompensationSettled: false,
      }).terminationDate,
    ).toBeUndefined();
  });

  it('defaults to paying when the flag is absent (no behaviour change for non-rehires)', () => {
    const { priorServiceCompensationSettled, ...withoutFlag } = {
      ...base,
      priorServiceCompensationSettled: undefined,
    };
    expect(resolveLeaverFinalPay(withoutFlag).terminationDate).toBe('2027-08-31');
  });
});
