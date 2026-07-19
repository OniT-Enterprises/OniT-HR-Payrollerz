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

/**
 * Resolves the once-only final-pay inputs for the engine. Shared by the two
 * TLPayrollInput builders (display calc + validation/records) so they can
 * never diverge on how a leaver is paid.
 *
 *  - Art. 56 severance fires (via terminationDate) ONLY if no service
 *    compensation has already been committed for this employee this year —
 *    so a second run over the same period does not re-pay it.
 *  - Art. 44 subsidio for a leaver is the termination-year entitlement net of
 *    whatever 13th month is already committed (annual run or a prior final
 *    run), clamped at 0.
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
}): { terminationDate: string | undefined; subsidioAnual: number } {
  const {
    inPeriodTermination,
    monthlySalary,
    hireDate,
    asOfDate,
    includeSubsidioAnual,
    subsidioConfig,
    committed,
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
    // Skip severance if it was already paid/committed in an earlier run.
    terminationDate:
      committed.serviceCompensation > 0 ? undefined : inPeriodTermination,
    subsidioAnual: maxMoney(
      0,
      subtractMoney(entitlement, committed.subsidioAnual),
    ),
  };
}
