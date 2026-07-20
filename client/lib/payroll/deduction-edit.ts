/**
 * Edit semantics for the Deductions & Advances register (pure, Firebase-free).
 *
 * The register (top-level `recurringDeductions`, edited from
 * client/pages/payroll/DeductionsAdvances.tsx) is settled by PAID payroll
 * runs — see client/lib/payroll/recurring-deductions.ts and
 * payrollService.settleRecurringDeductions. An edit must never rewrite that
 * settlement history, so the rules are:
 *
 * - `lastAppliedPeriod` is NEVER written by an edit — the once-per-period-month
 *   guard survives every edit.
 * - `employeeId` and `type` are identity fields: the edit dialog disables them
 *   and this helper never emits them (a doc's settled history is meaningless
 *   under a different employee or engine slot).
 * - `remainingBalance` is only recomputed when `totalAmount` itself changes,
 *   preserving what has already been repaid:
 *       alreadyRepaid = clamp(oldTotal - oldRemaining, 0, oldTotal)
 *       newRemaining  = clamp(newTotal - alreadyRepaid, 0, newTotal)
 *   Editing the per-period installment `amount` (or the percentage) alone
 *   never touches the balance. For an advance that was never balance-tracked
 *   (created with totalAmount 0), alreadyRepaid is 0 — untracked installments
 *   were never recorded against a balance, so the whole new total is treated
 *   as outstanding.
 * - Status only moves with a recomputed balance: 0 remaining -> 'completed'
 *   (nothing left to collect); a 'completed' advance whose new total leaves
 *   money outstanding reactivates to 'active' (leaving it completed would
 *   silently never collect); 'paused' stays paused — pause/resume has its own
 *   control.
 * - A balance-tracked advance must keep a total: dropping totalAmount to 0
 *   would turn it into an open-ended installment that deducts forever
 *   (resolveScheduledDeductions only treats totalAmount > 0 as
 *   balance-tracked), so that edit is refused rather than guessed at.
 *
 * Kept Firebase-free so vitest can run it in CI (no VITE_FIREBASE env).
 */

import { compareMoney, subtractMoney } from "@/lib/currency";

/** The fields the edit dialog lets the user change. */
export interface DeductionEditValues<F extends string = string> {
  description: string;
  /** Flat installment per period (ignored and stored as 0 when isPercentage). */
  amount: number;
  isPercentage: boolean;
  /** Percent of monthly salary (stored as 0 when not isPercentage). */
  percentage: number;
  isPreTax: boolean;
  startDate: string;
  endDate: string;
  frequency: F;
  /** Only read for advance_repayment docs (the dialog only shows it there). */
  totalAmount: number;
}

/** The parts of the existing register doc the balance rule depends on. */
export interface DeductionEditTarget {
  type: string;
  status: string;
  totalAmount?: number;
  remainingBalance?: number;
}

/** Firestore update payload for the edit — note what is deliberately absent:
 * lastAppliedPeriod, employeeId, type. */
export interface DeductionEditUpdates<F extends string = string> {
  description: string;
  amount: number;
  isPercentage: boolean;
  percentage: number;
  isPreTax: boolean;
  startDate: string;
  endDate: string;
  frequency: F;
  totalAmount?: number;
  remainingBalance?: number;
  status?: "active" | "completed";
}

export function buildDeductionEditUpdates<F extends string>(
  existing: DeductionEditTarget,
  edits: DeductionEditValues<F>,
): DeductionEditUpdates<F> {
  const updates: DeductionEditUpdates<F> = {
    description: edits.description,
    // Mirror the create dialog's shape: exactly one of amount/percentage is set.
    amount: edits.isPercentage ? 0 : edits.amount,
    isPercentage: edits.isPercentage,
    percentage: edits.isPercentage ? edits.percentage : 0,
    isPreTax: edits.isPreTax,
    startDate: edits.startDate,
    endDate: edits.endDate || "",
    frequency: edits.frequency,
  };

  // Only advances carry a total/balance; for every other type the dialog does
  // not show the field and this helper must not touch balance state.
  if (existing.type !== "advance_repayment") return updates;

  const oldTotal = existing.totalAmount ?? 0;
  const newTotal = edits.totalAmount;

  if (oldTotal > 0 && !(newTotal > 0)) {
    throw new Error(
      "An advance that tracks a balance must keep a total amount greater than zero",
    );
  }

  // Installment-only edit: repayment progress is untouched.
  if (compareMoney(newTotal, oldTotal) === 0) return updates;

  const oldTracked = oldTotal > 0 && typeof existing.remainingBalance === "number";
  const oldRemaining = oldTracked ? (existing.remainingBalance as number) : oldTotal;
  const alreadyRepaid = Math.min(
    Math.max(0, subtractMoney(oldTotal, oldRemaining)),
    oldTotal,
  );
  const newRemaining = Math.min(
    Math.max(0, subtractMoney(newTotal, alreadyRepaid)),
    newTotal,
  );

  updates.totalAmount = newTotal;
  updates.remainingBalance = newRemaining;
  if (newRemaining <= 0) {
    updates.status = "completed";
  } else if (existing.status === "completed") {
    updates.status = "active";
  }
  return updates;
}
