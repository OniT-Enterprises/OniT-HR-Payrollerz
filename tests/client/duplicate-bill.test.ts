/**
 * Warning when a supplier invoice has already been entered.
 *
 * Nothing guarded this, and it matters most on the path that now fills the form
 * from a photo: the same invoice gets added once from a phone and again from the
 * emailed PDF, and the supplier is queued to be paid twice. The rule has to be
 * tight enough to be trusted — a false warning on every second bill would train
 * people to dismiss it, which is worse than no warning.
 */
import { describe, it, expect } from 'vitest';
import {
  findDuplicateBills,
  hasDuplicateBill,
  type ComparableBill,
} from '@/lib/money/duplicate-bill';

const bill = (over: Partial<ComparableBill> = {}): ComparableBill => ({
  id: 'b1',
  vendorId: 'v-primos',
  vendorName: "Primo's Boot, Unip, Lda",
  billNumber: '4667',
  billDate: '2026-06-11',
  total: 450,
  status: 'pending',
  ...over,
});

const candidate = {
  vendorId: 'v-primos',
  billNumber: '4667',
  billDate: '2026-06-11',
  amount: 450,
};

describe('findDuplicateBills — same invoice number', () => {
  it('flags the same number from the same vendor', () => {
    const matches = findDuplicateBills([bill()], candidate);
    expect(matches).toHaveLength(1);
    expect(matches[0].reason).toBe('same_number');
  });

  it('reads a number the way a human does, ignoring case and punctuation', () => {
    for (const stored of ['INV-0473', 'inv 0473', 'INV0473', 'inv/0473']) {
      const matches = findDuplicateBills(
        [bill({ billNumber: stored })],
        { ...candidate, billNumber: 'INV-0473' },
      );
      expect(matches, stored).toHaveLength(1);
    }
  });

  it('flags a repeat even when the amount or date was typed differently', () => {
    // Same invoice, mis-keyed total — still the same invoice.
    const matches = findDuplicateBills(
      [bill({ total: 45, billDate: '2026-06-30' })],
      candidate,
    );
    expect(matches[0].reason).toBe('same_number');
  });

  it('does not cross vendors', () => {
    expect(findDuplicateBills([bill({ vendorId: 'v-other' })], candidate)).toHaveLength(0);
  });

  it('ignores a cancelled bill — re-entering one is how a correction is made', () => {
    expect(findDuplicateBills([bill({ status: 'cancelled' })], candidate)).toHaveLength(0);
  });

  it('never flags a bill as a duplicate of itself while editing', () => {
    expect(findDuplicateBills([bill({ id: 'b9' })], { ...candidate, excludeId: 'b9' }))
      .toHaveLength(0);
  });
});

describe('findDuplicateBills — no number to compare', () => {
  const numberless = { ...candidate, billNumber: null };

  it('falls back to the same amount on a nearby date', () => {
    const matches = findDuplicateBills(
      [bill({ billNumber: undefined, billDate: '2026-06-13' })],
      numberless,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].reason).toBe('same_amount_and_date');
  });

  it('compares money at cent precision, not by float equality', () => {
    const matches = findDuplicateBills(
      [bill({ billNumber: undefined, total: 0.1 + 0.2 })],
      { ...numberless, amount: 0.3 },
    );
    expect(matches).toHaveLength(1);
  });

  it('does not reach across weeks', () => {
    expect(findDuplicateBills(
      [bill({ billNumber: undefined, billDate: '2026-05-01' })],
      numberless,
    )).toHaveLength(0);
  });

  it('does not flag a different amount', () => {
    expect(findDuplicateBills(
      [bill({ billNumber: undefined, total: 451 })],
      numberless,
    )).toHaveLength(0);
  });

  it('stays quiet when EITHER side has a number — distinct numbers mean distinct bills', () => {
    // Two real invoices of equal value on one day, each with its own number:
    // flagging these would be the false positive that trains people to ignore
    // the warning.
    expect(findDuplicateBills([bill({ billNumber: '5389' })],
      { ...candidate, billNumber: '5390' })).toHaveLength(0);
    expect(findDuplicateBills([bill({ billNumber: '5389' })], numberless)).toHaveLength(0);
    expect(findDuplicateBills([bill({ billNumber: undefined })],
      { ...candidate, billNumber: '5390' })).toHaveLength(0);
  });
});

describe('findDuplicateBills — ordering and shape', () => {
  it('puts the near-certain number match first', () => {
    const bills = [
      bill({ id: 'amount-match', billNumber: undefined }),
      bill({ id: 'number-match' }),
    ];
    // The candidate carries a number, so only the number match can fire.
    const matches = findDuplicateBills(bills, candidate);
    expect(matches[0].bill.id).toBe('number-match');
  });

  it('returns the most recent first among equal reasons', () => {
    const bills = [
      bill({ id: 'older', billDate: '2026-06-09', billNumber: undefined }),
      bill({ id: 'newer', billDate: '2026-06-12', billNumber: undefined }),
    ];
    const matches = findDuplicateBills(bills, { ...candidate, billNumber: null });
    expect(matches.map((m) => m.bill.id)).toEqual(['newer', 'older']);
  });

  it('uses amount when a record has no total', () => {
    const matches = findDuplicateBills(
      [{ id: 'x', vendorId: 'v-primos', billDate: '2026-06-11', amount: 450 }],
      { ...candidate, billNumber: null },
    );
    expect(matches).toHaveLength(1);
  });

  it('handles an empty list and unparseable dates without throwing', () => {
    expect(findDuplicateBills([], candidate)).toEqual([]);
    expect(() => findDuplicateBills(
      [bill({ billNumber: undefined, billDate: 'not-a-date' })],
      { ...candidate, billNumber: null },
    )).not.toThrow();
  });
});

describe('hasDuplicateBill', () => {
  it('answers the yes/no the form asks', () => {
    expect(hasDuplicateBill([bill()], candidate)).toBe(true);
    expect(hasDuplicateBill([bill({ vendorId: 'v-other' })], candidate)).toBe(false);
  });
});
