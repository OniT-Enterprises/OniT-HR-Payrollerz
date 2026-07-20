/**
 * Bank reconciliation settle-on-match decision logic (pure, Firebase-free).
 *
 * Matching a bank-statement line to an OUTSTANDING invoice/bill records a
 * real payment through the existing payment paths. decideSettlement() is the
 * gate: bank amount == balance due -> full; below -> partial; above ->
 * blocked (never guess an overpayment); nothing due / bad input -> blocked.
 * canSettleBillFromBank() excludes payer-withholding bills, whose bank line
 * shows the cash leg while recordPayment's amount is gross AP cleared.
 */
import { describe, expect, it } from 'vitest';
import {
  canSettleBillFromBank,
  decideSettlement,
} from '@/lib/accounting/bank-reconciliation-settlement';

describe('decideSettlement', () => {
  it('settles in full when the bank amount equals the balance due', () => {
    expect(decideSettlement(150, 150)).toEqual({ kind: 'full', amount: 150 });
  });

  it('uses the magnitude of withdrawals (bills) — sign does not matter', () => {
    expect(decideSettlement(-250.75, 250.75)).toEqual({
      kind: 'full',
      amount: 250.75,
    });
  });

  it('treats amounts equal to the cent as full despite float drift', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in raw floats
    expect(decideSettlement(0.1 + 0.2, 0.3)).toEqual({
      kind: 'full',
      amount: 0.3,
    });
    // Money comparison happens at currency precision, not float precision
    expect(decideSettlement(100.004999, 100)).toEqual({
      kind: 'full',
      amount: 100,
    });
  });

  it('records a partial payment when the bank amount is below the balance due', () => {
    expect(decideSettlement(40, 100)).toEqual({
      kind: 'partial',
      amount: 40,
      remainingAfter: 60,
    });
    expect(decideSettlement(-40, 100)).toEqual({
      kind: 'partial',
      amount: 40,
      remainingAfter: 60,
    });
  });

  it('computes the remaining balance at currency precision', () => {
    expect(decideSettlement(33.33, 100)).toEqual({
      kind: 'partial',
      amount: 33.33,
      remainingAfter: 66.67,
    });
  });

  it('blocks when the bank amount exceeds the balance due — even by a cent', () => {
    expect(decideSettlement(150, 100)).toEqual({
      kind: 'blocked',
      reason: 'overpayment',
    });
    expect(decideSettlement(100.01, 100)).toEqual({
      kind: 'blocked',
      reason: 'overpayment',
    });
    expect(decideSettlement(-100.01, 100)).toEqual({
      kind: 'blocked',
      reason: 'overpayment',
    });
  });

  it('blocks when nothing is outstanding', () => {
    expect(decideSettlement(50, 0)).toEqual({
      kind: 'blocked',
      reason: 'nothing_outstanding',
    });
    expect(decideSettlement(50, -10)).toEqual({
      kind: 'blocked',
      reason: 'nothing_outstanding',
    });
    expect(decideSettlement(50, Number.NaN)).toEqual({
      kind: 'blocked',
      reason: 'nothing_outstanding',
    });
  });

  it('blocks unusable bank amounts', () => {
    expect(decideSettlement(0, 100)).toEqual({
      kind: 'blocked',
      reason: 'invalid_amount',
    });
    expect(decideSettlement(Number.NaN, 100)).toEqual({
      kind: 'blocked',
      reason: 'invalid_amount',
    });
    expect(decideSettlement(Number.POSITIVE_INFINITY, 100)).toEqual({
      kind: 'blocked',
      reason: 'invalid_amount',
    });
    // Rounds to $0.00 at currency precision
    expect(decideSettlement(0.004, 100)).toEqual({
      kind: 'blocked',
      reason: 'invalid_amount',
    });
  });
});

describe('canSettleBillFromBank', () => {
  it('allows bills with no withholding instruction (the simple flow)', () => {
    expect(canSettleBillFromBank(undefined)).toBe(true);
    expect(canSettleBillFromBank(null)).toBe(true);
  });

  it('blocks payer-withholding bills — bank cash is not gross AP', () => {
    expect(
      canSettleBillFromBank({ collectionMethod: 'payer_withholding', rate: 2.64 }),
    ).toBe(false);
    expect(
      canSettleBillFromBank({ collectionMethod: 'payer_withholding', rate: 10 }),
    ).toBe(false);
  });

  it('allows payer-withholding instructions with a zero rate (no split)', () => {
    expect(
      canSettleBillFromBank({ collectionMethod: 'payer_withholding', rate: 0 }),
    ).toBe(true);
  });

  it('allows bills where the supplier remits its own tax (full cash paid)', () => {
    expect(
      canSettleBillFromBank({ collectionMethod: 'supplier_self_assessment', rate: 10 }),
    ).toBe(true);
  });
});
