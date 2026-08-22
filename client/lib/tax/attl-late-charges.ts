/**
 * Additional tax on a late ATTL domestic filing or payment.
 *
 * The authority is UNTAET Regulation 2000/18 as amended July 2002 — the
 * unofficial consolidation ATTL itself publishes — NOT Lei 8/2008, which has no
 * general late-payment regime (its only penalty provisions are the petroleum
 * instalment shortfalls in Secs. 82.8/90.5). Every "Aviso de Avaliação" cites
 * Sec. 73 for exactly this.
 *
 *   Sec. 72.1  Failure to deliver a tax FORM by the due date → $100.
 *   Sec. 73.1  Failure to deliver the PAYMENT → 5% of the tax not paid by the
 *              due date, "plus an additional 1% of the tax that remains unpaid
 *              on the 15th day of each month following the due date".
 *
 * Two things that rule is NOT, and getting either wrong overstates the debt:
 *
 *  - The 1% is not daily interest and does not compound. It is a discrete
 *    stamp applied on the 15th of each month AFTER the due date, so a payment
 *    made on the 14th of the following month carries the 5% and no 1% at all.
 *  - Sec. 73.1(a)/(b) add 25% for gross carelessness and 100% for a deliberate
 *    attempt to avoid payment. Those require a finding by the Commissioner
 *    about the taxpayer's state of mind. Xefe must never presume either, so
 *    they are absent from this module by design.
 *
 * And Sec. 71.4 lets the Commissioner forgive some or all additional tax for
 * good reason. So this is an ESTIMATE to warn with, never a figure to post: the
 * assessment notice remains the only authority for what is actually owed.
 *
 * Pure, Firebase-free module (unit-tested; CI has no VITE_FIREBASE_* env).
 */

import { addMoney, applyRate, multiplyMoney, roundMoney } from '@/lib/currency';

/** Sec. 72.1 — fixed additional tax for a late tax form. */
export const ATTL_LATE_FORM_ADDITIONAL_TAX = 100;
/** Sec. 73.1 — one-off share of the tax unpaid at the due date. */
export const ATTL_LATE_PAYMENT_INITIAL_RATE = 0.05;
/** Sec. 73.1 — added on the 15th of each month after the due date. */
export const ATTL_LATE_PAYMENT_MONTHLY_RATE = 0.01;
/** Sec. 73.1 — the day of the month each 1% stamp falls on. */
export const ATTL_LATE_PAYMENT_STAMP_DAY = 15;
export const ATTL_LATE_CHARGES_LEGAL_BASIS =
  'UNTAET Reg. 2000/18 Secs. 72.1 and 73.1 (as amended July 2002)';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseUTC(iso: string): Date {
  if (!ISO_DATE_RE.test(iso)) {
    throw new RangeError('Dates must use YYYY-MM-DD format.');
  }
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * How many 1% stamps have fallen: the count of 15ths of a month strictly after
 * the due date and on or before `asOf`.
 *
 * Worked from the rule's own words rather than a month-difference shortcut,
 * because the two disagree exactly where it matters. A payment due 15 July and
 * made 14 August is one calendar month late by any rounding, but no 15th has
 * passed since the due date, so Sec. 73.1 adds nothing beyond the 5%.
 */
export function attlLatePaymentStampCount(
  dueDateISO: string,
  asOfISO: string,
): number {
  const due = parseUTC(dueDateISO);
  const asOf = parseUTC(asOfISO);
  if (asOf.getTime() <= due.getTime()) return 0;

  let stamps = 0;
  // Start from the stamp day in the due date's own month, then walk forward.
  let year = due.getUTCFullYear();
  let month = due.getUTCMonth();
  for (;;) {
    const stamp = Date.UTC(year, month, ATTL_LATE_PAYMENT_STAMP_DAY);
    if (stamp > asOf.getTime()) break;
    if (stamp > due.getTime()) stamps += 1;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return stamps;
}

export interface ATTLLateChargeEstimate {
  /** Sec. 72.1, only when the RETURN itself was late. */
  formAdditionalTax: number;
  /** Sec. 73.1 first limb: 5% of the unpaid tax. */
  initialAdditionalTax: number;
  /** Sec. 73.1 second limb: 1% per stamp that has fallen. */
  monthlyAdditionalTax: number;
  /** How many 15ths have passed since the due date. */
  monthlyStamps: number;
  total: number;
  isLate: boolean;
  legalBasis: string;
}

/**
 * Estimate the additional tax on a late domestic filing.
 *
 * `taxUnpaid` is the tax still outstanding — pass the full liability when
 * nothing has been paid. `formWasLate` should be true only when the RETURN
 * missed its due date; a return filed on time whose payment is late owes
 * Sec. 73 alone.
 */
export function estimateATTLLateCharges(input: {
  taxUnpaid: number;
  dueDate: string;
  asOf: string;
  formWasLate?: boolean;
}): ATTLLateChargeEstimate {
  const { taxUnpaid, dueDate, asOf } = input;
  if (!Number.isFinite(taxUnpaid) || taxUnpaid < 0) {
    throw new RangeError('Unpaid tax must be a non-negative finite amount.');
  }

  const stamps = attlLatePaymentStampCount(dueDate, asOf);
  const isLate = parseUTC(asOf).getTime() > parseUTC(dueDate).getTime();

  // The $100 stands on its own: Sec. 72.1 attaches to the form, so a nil
  // return filed late still owes it even though no tax was outstanding.
  const formAdditionalTax = isLate && input.formWasLate
    ? ATTL_LATE_FORM_ADDITIONAL_TAX
    : 0;
  const initialAdditionalTax = isLate
    ? applyRate(taxUnpaid, ATTL_LATE_PAYMENT_INITIAL_RATE)
    : 0;
  const monthlyAdditionalTax = multiplyMoney(
    applyRate(taxUnpaid, ATTL_LATE_PAYMENT_MONTHLY_RATE),
    stamps,
  );

  return {
    formAdditionalTax,
    initialAdditionalTax,
    monthlyAdditionalTax,
    monthlyStamps: stamps,
    total: roundMoney(
      addMoney(addMoney(formAdditionalTax, initialAdditionalTax), monthlyAdditionalTax),
    ),
    isLate,
    legalBasis: ATTL_LATE_CHARGES_LEGAL_BASIS,
  };
}
