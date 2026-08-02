/**
 * Justa-causa dismissal and termination pay (mined answer A1).
 *
 * Art. 23(4)(d) gives a worker dismissed for just cause "sem qualquer
 * indemnização ou compensação" — both the Art. 55 indemnity and the Art. 56
 * compensation — while Art. 56 reads "independentemente do motivo". A
 * practitioner advisory resolves it: on just-cause termination there is "no
 * severance pay IF THE PROCESS IS VALID" (written accusation, right of defence,
 * formal decision). Evidence: docs/MINED_ANSWERS_TERMINATION_AUG2026.md §A1.
 *
 * The validity condition is the whole reason this is an explicit reviewer flag and
 * not a new departure reason — a procedurally defective dismissal keeps the
 * entitlement, and no amount of label-reading can tell the two apart.
 */
import { describe, it, expect } from 'vitest';
import {
  severanceDefaultForReason,
  requiredNoticeDays,
  type DepartureReason,
} from '@/lib/payroll/leaver-final-pay';

describe('severanceDefaultForReason — justa causa', () => {
  it('suggests OFF for a dismissal on an established valid just-cause process', () => {
    expect(
      severanceDefaultForReason('termination', { justaCausaEstablished: true }),
    ).toBe(false);
  });

  it('keeps suggesting ON for a dismissal that is NOT established as justa causa', () => {
    // Procedurally defective, or simply a no-cause dismissal: entitlement stands.
    expect(severanceDefaultForReason('termination')).toBe(true);
    expect(severanceDefaultForReason('termination', {})).toBe(true);
    expect(
      severanceDefaultForReason('termination', { justaCausaEstablished: false }),
    ).toBe(true);
  });

  it('leaves every other cause exactly as it was', () => {
    const causes: DepartureReason[] = [
      'redundancy',
      'retirement',
      'contract_end',
      'mutual_agreement',
      'death',
      'other',
    ];
    for (const cause of causes) {
      expect(severanceDefaultForReason(cause)).toBe(true);
    }
    expect(severanceDefaultForReason('resignation')).toBe(false);
  });

  it('is only a SUGGESTION — payroll still requires an explicit stamped decision', () => {
    // Guard the contract this helper documents: it never auto-pays. The engine
    // gate is severanceEntitled on resolveLeaverFinalPay, tested separately.
    expect(typeof severanceDefaultForReason('termination')).toBe('boolean');
  });
});

describe('requiredNoticeDays — Art. 50(3) justa causa needs no notice', () => {
  it('requires no notice for an established justa-causa dismissal', () => {
    expect(
      requiredNoticeDays('termination', '2015-01-01', '2026-06-30', {
        justaCausaEstablished: true,
      }),
    ).toEqual({ days: 0, basis: 'Lei 4/2012 Art. 50(3)' });
  });

  it('still applies the Art. 53(2) band when justa causa is not established', () => {
    expect(requiredNoticeDays('termination', '2025-03-01', '2026-06-30').days).toBe(15);
    expect(requiredNoticeDays('termination', '2015-01-01', '2026-06-30').days).toBe(30);
  });

  it('does not silence the WORKER\'s own 30-day duty on a resignation', () => {
    // The flag describes an employer's disciplinary dismissal; it must never be
    // read as excusing the worker's Art. 49(8) notice.
    expect(
      requiredNoticeDays('resignation', '2015-01-01', '2026-06-30', {
        justaCausaEstablished: true,
      }),
    ).toEqual({ days: 30, basis: 'Lei 4/2012 Art. 49(8)' });
  });

  it('does not apply to redundancy, which is an Art. 52/53 market rescission', () => {
    expect(
      requiredNoticeDays('redundancy', '2015-01-01', '2026-06-30', {
        justaCausaEstablished: true,
      }),
    ).toEqual({ days: 30, basis: 'Lei 4/2012 Art. 53(2)' });
  });

  it('leaves no-notice causes at zero', () => {
    expect(requiredNoticeDays('mutual_agreement', '2015-01-01', '2026-06-30').days).toBe(0);
    expect(requiredNoticeDays('death', '2015-01-01', '2026-06-30').days).toBe(0);
  });
});
