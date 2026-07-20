/**
 * Once-only final pay for a leaver (Art. 56 severance + Art. 44 subsidio).
 *
 * Pure module on purpose: usePayrollCalculator (and its unit tests) share it,
 * and keeping it out of the hook file means tests don't drag the hook's
 * firebase/context import chain into vitest, where the Firebase env vars
 * don't exist.
 */
import { calculateSubsidioAnual } from "@/lib/payroll/calculations-tl";
import { maxMoney, subtractMoney } from "@/lib/currency";

export type DepartureReason =
  | "resignation"
  | "redundancy"
  | "termination"
  | "retirement"
  | "contract_end"
  | "mutual_agreement"
  | "other";

/**
 * Cause-aware Art. 56 default (Lei 4/2012). The article's text is
 * cause-independent ("independentemente do motivo"), but real firm practice
 * pays severance on employer-initiated endings and NEVER on resignation
 * payslips — so resignation defaults OFF (with an "employee may still be
 * entitled — confirm with your accountant" note in the UI) and every other
 * cause defaults ON. Always editable per case; the offboarding decision is
 * stamped on the employee as `severanceOnTermination` at completion, which
 * is what the payroll run honors.
 */
export function severanceDefaultForReason(reason: DepartureReason): boolean {
  return reason !== "resignation";
}

/**
 * Resolves the once-only final-pay inputs for the engine. Shared by the two
 * TLPayrollInput builders (display calc + validation/records) so they can
 * never diverge on how a leaver is paid.
 *
 *  - Art. 56 severance fires (via terminationDate) ONLY if no service
 *    compensation has already been committed for this employee this year —
 *    so a second run over the same period does not re-pay it — AND the
 *    offboarding decision didn't exclude it (severanceEntitled). Real TL
 *    practice pays Art. 56 on employer-initiated endings, not resignations,
 *    so offboarding stamps that cause-aware decision on the employee.
 *  - Art. 44 subsidio for a leaver is the termination-year entitlement net of
 *    whatever 13th month is already committed (annual run or a prior final
 *    run), clamped at 0. It is owed regardless of the severance decision.
 *  - A non-leaver follows the ordinary includeSubsidioAnual toggle.
 */
export function resolveLeaverFinalPay(args: {
  inPeriodTermination: string | null;
  monthlySalary: number;
  hireDate: string;
  asOfDate: Date;
  includeSubsidioAnual: boolean;
  subsidioConfig?: { proRataForNewEmployees?: boolean };
  committed: { serviceCompensation: number; subsidioAnual: number };
  /** Default true (statute-literal). False = offboarding excluded Art. 56. */
  severanceEntitled?: boolean;
}): { terminationDate: string | undefined; subsidioAnual: number } {
  const {
    inPeriodTermination,
    monthlySalary,
    hireDate,
    asOfDate,
    includeSubsidioAnual,
    subsidioConfig,
    committed,
    severanceEntitled = true,
  } = args;

  if (!inPeriodTermination) {
    return {
      terminationDate: undefined,
      subsidioAnual: includeSubsidioAnual
        ? calculateSubsidioAnual(monthlySalary, hireDate, asOfDate, subsidioConfig)
        : 0,
    };
  }

  const entitlement = calculateSubsidioAnual(
    monthlySalary,
    hireDate,
    new Date(`${inPeriodTermination}T00:00:00`),
    { ...subsidioConfig, terminationDate: inPeriodTermination },
  );
  return {
    // Skip severance if it was already paid/committed in an earlier run, or
    // if the offboarding decision excluded it for this termination's cause.
    terminationDate:
      committed.serviceCompensation > 0 || !severanceEntitled
        ? undefined
        : inPeriodTermination,
    subsidioAnual: maxMoney(
      0,
      subtractMoney(entitlement, committed.subsidioAnual),
    ),
  };
}
