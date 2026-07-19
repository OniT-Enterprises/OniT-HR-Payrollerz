/**
 * Unit tests for QuickBillDialog's vendor auto-match.
 *
 * Guards the bug where an AI-extracted vendor name was auto-attached to a
 * vendor on a weak substring hit (e.g. "timortelecom".includes("ti") matched an
 * unrelated 2-letter vendor "TI"). Auto-select now requires exact normalized
 * equality; anything weaker returns null so the user confirms.
 */
import { describe, it, expect } from 'vitest';
import { matchVendorByName } from '../../client/components/money/QuickBillDialog';

const vendors = [
  { id: 'v-ti', name: 'TI' },
  { id: 'v-tt', name: 'Timor Telecom' },
  { id: 'v-elec', name: 'EDTL, E.P.' },
];

describe('matchVendorByName', () => {
  it('does NOT match an unrelated short vendor on a substring hit', () => {
    // "timortelecom".includes("ti") — the old behaviour returned the "TI" vendor.
    const match = matchVendorByName(vendors, 'timortelecom');
    expect(match?.id).not.toBe('v-ti');
  });

  it('matches on exact normalized equality (ignores case/spacing/punctuation)', () => {
    expect(matchVendorByName(vendors, 'timortelecom')?.id).toBe('v-tt');
    expect(matchVendorByName(vendors, 'Timor Telecom')?.id).toBe('v-tt');
    expect(matchVendorByName(vendors, 'TIMOR  TELECOM')?.id).toBe('v-tt');
    expect(matchVendorByName(vendors, 'edtl ep')?.id).toBe('v-elec');
  });

  it('returns null when there is no confident match', () => {
    expect(matchVendorByName(vendors, 'Some New Vendor Lda')).toBeNull();
    // A vendor name that only partially overlaps must not auto-select.
    expect(matchVendorByName(vendors, 'Timor Telecom Lda')).toBeNull();
  });

  it('returns null for an empty / punctuation-only extracted name', () => {
    expect(matchVendorByName(vendors, '')).toBeNull();
    expect(matchVendorByName(vendors, '   ---   ')).toBeNull();
  });

  it('still matches an exact 2-letter vendor when the name really is that', () => {
    expect(matchVendorByName(vendors, 'ti')?.id).toBe('v-ti');
  });
});
