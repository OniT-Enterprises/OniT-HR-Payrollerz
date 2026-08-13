/**
 * Attendance premium (prémio de assiduidade) — a standing monthly amount an
 * employer pays only when the period is clean of unjustified absence.
 *
 * WHY THIS EXISTS. This is not a statutory entitlement; it is the single most
 * repeated payroll instruction in the corpus of real TL payroll correspondence.
 * One client sends the same shape every month for years:
 *
 *   "Venho solicitar a emissão dos recibos de salário dos funcionários …
 *    [worker A] (s/faltas, com prémio 145 USD) … [worker B]
 *    (com desconto de 3 dias de falta ao serviço, com prémio 95 USD)"
 *
 * Note what that instruction contains: the docking AND the premium, decided
 * together off the same attendance facts. Xefe already derives the docking
 * (`absenceHours` in usePayrollCalculator, applied by `calculateTLPayroll`);
 * this module derives the premium from the same number so an operator stops
 * retyping the employer's letter twelve times a year.
 *
 * ABSENCE HERE MEANS UNJUSTIFIED ABSENCE. The `absenceHours` this reads is
 * already net of paid leave and public holidays, so approved leave never costs a
 * worker their premium — which matches "falta ao serviço" in the instruction
 * above.
 *
 * TAX TREATMENT IS AN OPEN READING. Xefe treats the premium as remuneration for
 * individual performance: always taxable for WIT, and inside the INSS
 * contributable base (the same side of DL 20/2017 Arts. 8-9 that
 * `bonusINSSCategory: 'individual_performance'` already takes). That is the
 * employer-costlier, worker-protective reading, but it is a reading — see
 * docs/NICO_OPEN_QUESTIONS.md A13 and the pending-confirmation badge on the
 * statutory rates card.
 */

import { multiplyMoney, roundMoney } from '@/lib/currency';

export type AttendancePremiumMode =
  /** Any unjustified absence beyond the grace allowance forfeits the whole premium. */
  | 'all_or_nothing'
  /** The premium is reduced in proportion to hours missed. */
  | 'pro_rata';

export interface AttendancePremium {
  /** Full amount when the period is clean. */
  amount: number;
  mode: AttendancePremiumMode;
  /**
   * Hours of unjustified absence tolerated before the premium is affected.
   * Absent means zero tolerance, which is what "s/faltas" states.
   */
  graceHours?: number;
  /**
   * Explicitly false or absent pays nothing. A discretionary employer payment is
   * never inferred — an employee with no configured premium gets no premium
   * line, not a zero-dollar one.
   */
  active: boolean;
}

export interface AttendancePremiumResult {
  /** Amount to pay. Zero when forfeited. */
  amount: number;
  /** True when a configured premium was reduced or withheld by absence. */
  reduced: boolean;
  /** Unjustified absence hours counted against the premium, after grace. */
  chargeableAbsenceHours: number;
}

/**
 * The premium payable for a period.
 *
 * `expectedRegularHours` is the denominator for pro-rata mode — the hours the
 * employee was rostered to work, which is what the docking engine measures
 * absence against. When it is zero or missing, pro-rata cannot be computed and
 * the premium is treated as all-or-nothing rather than silently paid in full.
 */
export function calculateAttendancePremium(
  premium: AttendancePremium | undefined | null,
  absenceHours: number,
  expectedRegularHours: number,
): AttendancePremiumResult {
  const none: AttendancePremiumResult = {
    amount: 0,
    reduced: false,
    chargeableAbsenceHours: 0,
  };

  if (!premium?.active) return none;
  if (!Number.isFinite(premium.amount) || premium.amount <= 0) return none;

  const absence = Number.isFinite(absenceHours) ? Math.max(0, absenceHours) : 0;
  const grace = Number.isFinite(premium.graceHours ?? 0)
    ? Math.max(0, premium.graceHours ?? 0)
    : 0;
  const chargeable = Math.max(0, absence - grace);

  if (chargeable === 0) {
    return { amount: roundMoney(premium.amount), reduced: false, chargeableAbsenceHours: 0 };
  }

  const canProRate =
    premium.mode === 'pro_rata' &&
    Number.isFinite(expectedRegularHours) &&
    expectedRegularHours > 0;

  if (!canProRate) {
    return { amount: 0, reduced: true, chargeableAbsenceHours: chargeable };
  }

  const worked = Math.max(0, expectedRegularHours - chargeable);
  const amount = roundMoney(
    multiplyMoney(premium.amount, worked / expectedRegularHours),
  );
  return { amount, reduced: true, chargeableAbsenceHours: chargeable };
}
