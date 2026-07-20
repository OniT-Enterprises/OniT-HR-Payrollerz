/**
 * Bank reconciliation settlement decisions (pure, Firebase-free).
 *
 * When a bank-statement line is matched to an OUTSTANDING invoice or bill,
 * the match records a real payment through the existing payment paths
 * (invoiceService.recordPayment / billService.recordPayment — payment doc,
 * paid/partial status, GL journal when a chart of accounts exists). These
 * helpers make the one decision that gates that: how the bank line's amount
 * compares to what is still due.
 *
 *   equal (to the cent)       -> 'full'    — record it; the doc becomes paid
 *   less than the balance due -> 'partial' — record it; the doc goes partial
 *   more than the balance due -> blocked   — never guess an overpayment
 *   nothing due / bad input   -> blocked
 */
import { compareMoney, roundMoney, subtractMoney } from '@/lib/currency';

export type SettlementBlockReason =
  /** Bank amount is missing, zero, or not a usable number. */
  | 'invalid_amount'
  /** The invoice/bill has no balance due (already settled or bad data). */
  | 'nothing_outstanding'
  /** Bank amount exceeds the balance due — we never invent an overpayment. */
  | 'overpayment';

export type SettlementDecision =
  | { kind: 'full'; amount: number }
  | { kind: 'partial'; amount: number; remainingAfter: number }
  | { kind: 'blocked'; reason: SettlementBlockReason };

/**
 * Decide whether a bank line can settle a document with `outstanding` due.
 * `bankAmount` may be signed (withdrawals are negative) — only its magnitude
 * matters here; the caller pairs deposits with invoices and withdrawals with
 * bills before asking.
 */
export function decideSettlement(
  bankAmount: number,
  outstanding: number,
): SettlementDecision {
  if (!Number.isFinite(bankAmount)) {
    return { kind: 'blocked', reason: 'invalid_amount' };
  }
  const amount = roundMoney(Math.abs(bankAmount));
  if (amount <= 0) {
    return { kind: 'blocked', reason: 'invalid_amount' };
  }

  if (!Number.isFinite(outstanding)) {
    return { kind: 'blocked', reason: 'nothing_outstanding' };
  }
  const due = roundMoney(outstanding);
  if (due <= 0) {
    return { kind: 'blocked', reason: 'nothing_outstanding' };
  }

  const comparison = compareMoney(amount, due);
  if (comparison > 0) {
    return { kind: 'blocked', reason: 'overpayment' };
  }
  if (comparison === 0) {
    return { kind: 'full', amount };
  }
  return { kind: 'partial', amount, remainingAfter: subtractMoney(due, amount) };
}

/**
 * Bills whose payment splits cash vs withheld tax can NOT be settled from a
 * bank line: the statement shows the CASH leg only, while recordPayment's
 * amount is the GROSS AP cleared — recording the bank amount as gross would
 * misstate both the payable and the withholding. Those bills are paid from
 * the Bills page, where the accountant sees the split. (Simple-flow bills
 * never carry payer withholding, so this only excludes advanced-tax bills.)
 */
export function canSettleBillFromBank(
  withholding?: { collectionMethod?: string; rate?: number } | null,
): boolean {
  return !(
    withholding?.collectionMethod === 'payer_withholding' &&
    (withholding.rate ?? 0) > 0
  );
}
