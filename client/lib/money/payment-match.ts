/**
 * Matching a bank payment slip to the bill it paid.
 *
 * A large share of what Timor-Leste businesses email as "Fatura" attachments are
 * not invoices at all: they are BNU transfer slips, *comprovativos* and ATM
 * *levantamento* receipts kept as proof of payment. Extraction now recognises
 * them (`documentType: 'payment_proof'`), but recognising a document and then
 * leaving the person to find the bill by hand is only half an answer.
 *
 * This is deliberately STRICT. Offering the wrong bill to settle is worse than
 * offering none — it marks a supplier paid who has not been paid, and hides a
 * real payable. So a suggestion is made only when the money matches exactly, at
 * cent precision; near-misses are left for the human to handle.
 *
 * Pure and Firebase-free so CI can test it.
 */

/** The subset of a Bill this comparison needs. */
export interface PayableBill {
  id: string;
  billNumber?: string;
  vendorId: string;
  vendorName?: string;
  billDate: string;
  total?: number;
  amount?: number;
  amountPaid?: number;
  balanceDue?: number;
  status?: string;
}

export interface PaymentEvidence {
  /** Amount on the slip. */
  amount: number;
  /** Date the payment left the account, `YYYY-MM-DD`. */
  date: string;
}

/**
 * Why this bill was offered:
 * - `settles_balance` — the bill records what is still owed, and this clears it.
 * - `matches_total`   — the bill records no balance, and this equals the total
 *   less anything already paid.
 *
 * The distinction matters: a stored `balanceDue` is authoritative. When it is
 * present and does not match, the bill is NOT offered — falling back to the
 * total there would suggest settling a bill that owes a different amount.
 */
export type PaymentMatchReason = 'settles_balance' | 'matches_total';

export interface PaymentMatch {
  bill: PayableBill;
  reason: PaymentMatchReason;
  /** Days between the bill and the payment, for display and ranking. */
  daysAfterBill: number;
}

/** A bill older than this is unlikely to be what a slip today settles. */
const MAX_AGE_DAYS = 365;

/** A payment dated slightly before its bill is a clock/date-entry artefact. */
const EARLY_PAYMENT_SLACK_DAYS = 2;

const OPEN_STATUSES = new Set(['pending', 'partial', 'overdue']);

function toCents(value: number): number {
  return Math.round(value * 100);
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return (to - from) / 86_400_000;
}

/** What the bill is worth in full, whichever field the record carries. */
function billTotal(bill: PayableBill): number | null {
  if (typeof bill.total === 'number') return bill.total;
  if (typeof bill.amount === 'number') return bill.amount;
  return null;
}

/** What the bill still owes according to its own total, less anything paid. */
function outstandingFromTotal(bill: PayableBill): number | null {
  const total = billTotal(bill);
  if (total === null) return null;
  return total - (typeof bill.amountPaid === 'number' ? bill.amountPaid : 0);
}

/**
 * Bills this payment could have settled, best first.
 *
 * Only open bills are considered, only exact money matches are offered, and the
 * payment must not predate the bill by more than a couple of days.
 */
export function findBillsSettledBy(
  bills: readonly PayableBill[],
  payment: PaymentEvidence,
): PaymentMatch[] {
  if (!Number.isFinite(payment.amount) || payment.amount <= 0) return [];
  const paidCents = toCents(payment.amount);
  const matches: PaymentMatch[] = [];

  for (const bill of bills) {
    if (bill.status && !OPEN_STATUSES.has(bill.status)) continue;

    const age = daysBetween(bill.billDate, payment.date);
    if (age === null) continue;
    if (age < -EARLY_PAYMENT_SLACK_DAYS) continue; // paid before it was issued
    if (age > MAX_AGE_DAYS) continue;

    // A stored balance is what the bill says it is owed, so it decides alone.
    // Falling through to the total when it does not match would offer a bill
    // owing $900 to settle a $472 payment.
    if (typeof bill.balanceDue === 'number') {
      if (toCents(bill.balanceDue) === paidCents) {
        matches.push({ bill, reason: 'settles_balance', daysAfterBill: Math.round(age) });
      }
      continue;
    }

    const owed = outstandingFromTotal(bill);
    if (owed !== null && toCents(owed) === paidCents) {
      matches.push({ bill, reason: 'matches_total', daysAfterBill: Math.round(age) });
    }
  }

  return matches.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === 'settles_balance' ? -1 : 1;
    // Closest to the payment date first: the likeliest bill is the recent one.
    return a.daysAfterBill - b.daysAfterBill;
  });
}

/**
 * True when exactly one bill matches — the only case safe to act on in one tap.
 * With several candidates the person must choose, since the money alone cannot
 * tell two identical bills apart.
 */
export function hasSingleBillMatch(
  bills: readonly PayableBill[],
  payment: PaymentEvidence,
): boolean {
  return findBillsSettledBy(bills, payment).length === 1;
}
