/**
 * Spotting a bill that has already been entered.
 *
 * Nothing stopped the same supplier invoice being recorded twice, which matters
 * more now that uploading a photo fills the form in: the fast path is exactly the
 * one where somebody adds the same invoice from their phone and again from the
 * emailed PDF. Two bills means the supplier is queued to be paid twice.
 *
 * This WARNS, never blocks. Real businesses do issue two invoices to one customer
 * on the same day for the same amount, and a supplier may legitimately reuse a
 * number series — so the decision stays with the person, who can see both bills.
 *
 * Pure and Firebase-free so CI can test it.
 */

/** The subset of a Bill this comparison needs. */
export interface ComparableBill {
  id: string;
  billNumber?: string;
  vendorId: string;
  vendorName?: string;
  billDate: string;
  total?: number;
  amount?: number;
  status?: string;
}

export interface DuplicateCandidate {
  vendorId: string;
  billNumber?: string | null;
  billDate: string;
  amount: number;
  /** Set when editing, so a bill is never flagged as a duplicate of itself. */
  excludeId?: string;
}

/** Why a bill was flagged — the UI shows this so the user can judge. */
export type DuplicateReason = 'same_number' | 'same_amount_and_date';

export interface DuplicateMatch {
  bill: ComparableBill;
  reason: DuplicateReason;
}

/** Days apart that still counts as "the same bill entered twice". */
const NEAR_DATE_DAYS = 5;

/**
 * Compare invoice numbers the way a human reads them: "INV-0473", "inv 0473" and
 * "INV0473" are the same number. Digits alone are NOT enough — "1" would collide
 * with everything — so the whole alphanumeric string is compared.
 */
function normalizeNumber(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function daysBetween(a: string, b: string): number {
  const first = new Date(`${a}T00:00:00Z`).getTime();
  const second = new Date(`${b}T00:00:00Z`).getTime();
  if (Number.isNaN(first) || Number.isNaN(second)) return Number.POSITIVE_INFINITY;
  return Math.abs(first - second) / 86_400_000;
}

/** A bill's payable value, whichever field the record carries. */
function billTotal(bill: ComparableBill): number | null {
  if (typeof bill.total === 'number') return bill.total;
  if (typeof bill.amount === 'number') return bill.amount;
  return null;
}

function sameMoney(a: number, b: number): boolean {
  // Cent-level equality without binary float noise.
  return Math.round(a * 100) === Math.round(b * 100);
}

/**
 * Find bills that look like the one about to be created, strongest signal first.
 *
 * `same_number` is near-certain: one supplier does not issue two invoices under
 * one number. `same_amount_and_date` is weaker and only considered when neither
 * side carries a number to compare, so a matching number never gets downgraded.
 *
 * A cancelled bill is not a duplicate — re-entering a cancelled invoice is the
 * normal way to correct one.
 */
export function findDuplicateBills(
  bills: readonly ComparableBill[],
  candidate: DuplicateCandidate,
): DuplicateMatch[] {
  const candidateNumber = normalizeNumber(candidate.billNumber);
  const matches: DuplicateMatch[] = [];

  for (const bill of bills) {
    if (bill.id === candidate.excludeId) continue;
    if (bill.vendorId !== candidate.vendorId) continue;
    if (bill.status === 'cancelled') continue;

    const existingNumber = normalizeNumber(bill.billNumber);
    if (candidateNumber && existingNumber && candidateNumber === existingNumber) {
      matches.push({ bill, reason: 'same_number' });
      continue;
    }

    // Only fall back to amount+date when there is no number on either side to
    // judge by; otherwise two genuinely different invoices of equal value on one
    // day would be flagged despite having distinct numbers.
    if (candidateNumber || existingNumber) continue;

    const total = billTotal(bill);
    if (total === null || !sameMoney(total, candidate.amount)) continue;
    if (daysBetween(bill.billDate, candidate.billDate) > NEAR_DATE_DAYS) continue;

    matches.push({ bill, reason: 'same_amount_and_date' });
  }

  // Certain matches first, then most recent, so the UI shows the best evidence.
  return matches.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === 'same_number' ? -1 : 1;
    return b.bill.billDate.localeCompare(a.bill.billDate);
  });
}

/** True when anything looks like a repeat of this bill. */
export function hasDuplicateBill(
  bills: readonly ComparableBill[],
  candidate: DuplicateCandidate,
): boolean {
  return findDuplicateBills(bills, candidate).length > 0;
}
