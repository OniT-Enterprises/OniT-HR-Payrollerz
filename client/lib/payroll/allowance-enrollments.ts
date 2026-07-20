/**
 * Allowance-enrollment wiring for payroll runs (pure, Firebase-free).
 *
 * The Allowances register (top-level `benefitEnrollments` collection, see
 * client/pages/payroll/BenefitsEnrollment.tsx) holds recurring per-employee
 * allowances — transport, meal, housing, hardship, etc. This module turns
 * the active docs into the engine's per-employee earning inputs, classified
 * per Timor-Leste law:
 *
 *  - meal/food        → foodAllowance      (WIT-taxable; INSS-excluded by
 *                                           default per DL 20/2017 Art. 9(d),
 *                                           tenant toggle can opt it in)
 *  - transport/fuel   → transportAllowance (WIT-taxable; Art. 9(a) excluded)
 *  - housing/phone/
 *    education/uniform/
 *    other (+ legacy
 *    health/life)     → otherEarnings      (WIT-taxable; treated as Art. 9
 *                                           expense allowances, outside INSS)
 *  - hardship         → regularAllowances  (WIT-taxable AND contributable:
 *                                           a recurring contractual supplement
 *                                           is remuneracao contributiva under
 *                                           DL 20/2017 Art. 8, not an Art. 9
 *                                           expense allowance)
 *
 * Amounts on the register are MONTHLY; perPeriodAllowances divides them for
 * sub-monthly runs. Run rows stay hand-editable — a manually typed row
 * amount ADDS to the enrolled amount (same additive model as the Deductions
 * & Advances register).
 *
 * Kept Firebase-free so vitest can run it in CI (no VITE_FIREBASE env).
 */

import { addMoney, divideMoney } from "@/lib/currency";

/** Structural subset of BenefitEnrollment (client/types/payroll.ts). */
export interface BenefitEnrollmentLike {
  employeeId: string;
  /** Allowance type slug (transport/fuel/housing/meal/phone/hardship/
   * education/uniform/other, plus legacy food/health/life docs). */
  benefitType: string;
  /** Monthly allowance amount (allowances are employer-paid). */
  employerContribution: number;
  effectiveDate?: string;
  terminationDate?: string;
  status: string;
}

/** Monthly totals per engine input slot. */
export interface EmployeeAllowanceInputs {
  foodAllowance: number;
  transportAllowance: number;
  otherEarnings: number;
  regularAllowances: number;
}

const EMPTY_INPUTS: EmployeeAllowanceInputs = {
  foodAllowance: 0,
  transportAllowance: 0,
  otherEarnings: 0,
  regularAllowances: 0,
};

function slotForType(benefitType: string): keyof EmployeeAllowanceInputs {
  switch (benefitType) {
    case "meal":
    case "food":
      return "foodAllowance";
    case "transport":
    case "fuel":
      return "transportAllowance";
    case "hardship":
      return "regularAllowances";
    default:
      // housing, phone, education, uniform, other, legacy health/life —
      // taxable, outside the INSS base (Art. 9 expense-allowance treatment).
      return "otherEarnings";
  }
}

/**
 * Active enrollments for a pay period, aggregated into monthly engine-input
 * totals per employee. An enrollment counts when its status is `active` and
 * its [effectiveDate, terminationDate] window overlaps the period. Docs with
 * a non-positive amount are ignored.
 */
export function aggregateAllowanceInputs(
  enrollments: BenefitEnrollmentLike[],
  options: { periodStart: string; periodEnd: string },
): Record<string, EmployeeAllowanceInputs> {
  const byEmployee: Record<string, EmployeeAllowanceInputs> = {};
  for (const enrollment of enrollments) {
    if (!enrollment.employeeId) continue;
    if (enrollment.status !== "active") continue;
    const amount = Number(enrollment.employerContribution);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (enrollment.effectiveDate && enrollment.effectiveDate > options.periodEnd) continue;
    if (enrollment.terminationDate && enrollment.terminationDate < options.periodStart) continue;

    const current = byEmployee[enrollment.employeeId] ?? { ...EMPTY_INPUTS };
    const slot = slotForType(enrollment.benefitType);
    current[slot] = addMoney(current[slot], amount);
    byEmployee[enrollment.employeeId] = current;
  }
  return byEmployee;
}

/**
 * Monthly totals → this run's per-period amounts. Monthly runs pass 1;
 * weekly/biweekly runs split the monthly allowance across the month's
 * paychecks (cent-rounded per period, like the other per-period splits).
 */
export function perPeriodAllowances(
  monthly: EmployeeAllowanceInputs | undefined,
  /** undefined = monthly run (getPayPeriodsInPayMonth's convention). */
  totalPeriodsInMonth: number | undefined,
): EmployeeAllowanceInputs {
  if (!monthly) return EMPTY_INPUTS;
  const periods =
    totalPeriodsInMonth !== undefined &&
    Number.isFinite(totalPeriodsInMonth) &&
    totalPeriodsInMonth > 1
      ? totalPeriodsInMonth
      : 1;
  if (periods === 1) return monthly;
  return {
    foodAllowance: divideMoney(monthly.foodAllowance, periods),
    transportAllowance: divideMoney(monthly.transportAllowance, periods),
    otherEarnings: divideMoney(monthly.otherEarnings, periods),
    regularAllowances: divideMoney(monthly.regularAllowances, periods),
  };
}
