/**
 * Matching a bank payment slip to the bill it paid.
 *
 * The corpus is full of BNU transfer slips, comprovativos and ATM receipts that
 * businesses email as proof of payment, so this is a common upload. The rule is
 * deliberately strict: offering the wrong bill marks a supplier paid who has not
 * been paid and hides a real payable, which is worse than offering nothing.
 */
import { describe, it, expect } from 'vitest';
import {
  findBillsSettledBy,
  hasSingleBillMatch,
  type PayableBill,
} from '@/lib/money/payment-match';

const bill = (over: Partial<PayableBill> = {}): PayableBill => ({
  id: 'b1',
  vendorId: 'v1',
  vendorName: 'Primos Boot Unipessoal Lda',
  billNumber: '5390',
  billDate: '2026-07-01',
  total: 472,
  amountPaid: 0,
  balanceDue: 472,
  status: 'pending',
  ...over,
});

// A real BNU slip from the corpus: $472.00 debited on 7 April.
const payment = { amount: 472, date: '2026-07-08' };

describe('findBillsSettledBy — what it offers', () => {
  it('offers a bill whose outstanding balance the payment clears exactly', () => {
    const matches = findBillsSettledBy([bill()], payment);
    expect(matches).toHaveLength(1);
    expect(matches[0].reason).toBe('settles_balance');
    expect(matches[0].daysAfterBill).toBe(7);
  });

  it('clears the remainder of a partly-paid bill', () => {
    const matches = findBillsSettledBy(
      [bill({ total: 1000, amountPaid: 528, balanceDue: 472, status: 'partial' })],
      payment,
    );
    expect(matches[0].reason).toBe('settles_balance');
  });

  it('matches the full total when nothing has been paid and no balance is stored', () => {
    const matches = findBillsSettledBy(
      [{ id: 'x', vendorId: 'v1', billDate: '2026-07-01', total: 472, status: 'pending' }],
      payment,
    );
    expect(matches[0].reason).toBe('matches_total');
  });

  it('compares money at cent precision', () => {
    expect(findBillsSettledBy([bill({ balanceDue: 0.1 + 0.2 })], { amount: 0.3, date: '2026-07-08' }))
      .toHaveLength(1);
    expect(findBillsSettledBy([bill({ balanceDue: 472.01 })], payment)).toHaveLength(0);
  });
});

describe('findBillsSettledBy — what it refuses to guess', () => {
  it('says nothing when the amount does not match exactly', () => {
    // A partial payment could belong to any open bill; the person must choose.
    expect(findBillsSettledBy([bill({ balanceDue: 900 })], payment)).toHaveLength(0);
    expect(findBillsSettledBy([bill({ balanceDue: 471.99 })], payment)).toHaveLength(0);
  });

  it('ignores bills that are already settled or cancelled', () => {
    for (const status of ['paid', 'cancelled']) {
      expect(findBillsSettledBy([bill({ status })], payment), status).toHaveLength(0);
    }
  });

  it('will not settle a bill issued after the payment left the account', () => {
    expect(findBillsSettledBy([bill({ billDate: '2026-08-01' })], payment)).toHaveLength(0);
  });

  it('allows a couple of days of slack for date-entry differences', () => {
    expect(findBillsSettledBy([bill({ billDate: '2026-07-09' })], payment)).toHaveLength(1);
  });

  it('does not reach back more than a year', () => {
    expect(findBillsSettledBy([bill({ billDate: '2025-06-01' })], payment)).toHaveLength(0);
  });

  it('ignores a nonsensical payment amount', () => {
    for (const amount of [0, -472, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(findBillsSettledBy([bill()], { amount, date: '2026-07-08' }), String(amount))
        .toHaveLength(0);
    }
  });

  it('skips a record with no usable money or date', () => {
    expect(findBillsSettledBy([{ id: 'x', vendorId: 'v1', billDate: '2026-07-01' }], payment))
      .toHaveLength(0);
    expect(findBillsSettledBy([bill({ billDate: 'not-a-date' })], payment)).toHaveLength(0);
  });
});

describe('findBillsSettledBy — ranking', () => {
  it('puts a balance-clearing match above a whole-total match', () => {
    const matches = findBillsSettledBy(
      [
        bill({ id: 'total-match', balanceDue: undefined, amountPaid: 0, total: 472 }),
        bill({ id: 'balance-match', balanceDue: 472, amountPaid: 100, total: 572, status: 'partial' }),
      ],
      payment,
    );
    expect(matches[0].bill.id).toBe('balance-match');
  });

  it('offers the bill closest to the payment date first', () => {
    const matches = findBillsSettledBy(
      [bill({ id: 'older', billDate: '2026-05-01' }), bill({ id: 'newer', billDate: '2026-07-05' })],
      payment,
    );
    expect(matches.map((m) => m.bill.id)).toEqual(['newer', 'older']);
  });

  it('returns every candidate when two bills are genuinely identical', () => {
    // Two $472 bills a day apart: the money cannot tell them apart, so both are
    // offered and the person picks.
    const matches = findBillsSettledBy(
      [bill({ id: 'a' }), bill({ id: 'b', billDate: '2026-07-02' })],
      payment,
    );
    expect(matches).toHaveLength(2);
  });
});

describe('hasSingleBillMatch', () => {
  it('is true only when one bill can be the answer', () => {
    expect(hasSingleBillMatch([bill()], payment)).toBe(true);
    expect(hasSingleBillMatch([bill({ id: 'a' }), bill({ id: 'b' })], payment)).toBe(false);
    expect(hasSingleBillMatch([], payment)).toBe(false);
  });
});
