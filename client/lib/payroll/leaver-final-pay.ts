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
  | "death"
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
 *
 * "death" (Art. 47(1)(b) caducidade on the worker's death) defaults ON on the
 * statute-literal reading — the Art. 56 payment is then payable to the
 * estate/heirs, which the offboarding UI flags for accountant confirmation.
 */
export function severanceDefaultForReason(reason: DepartureReason): boolean {
  return reason !== "resignation";
}

// ============================================
// Notice periods (Lei 4/2012 Arts. 49(8)-(9), 53(2)-(3))
// ============================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse a strict YYYY-MM-DD string to a UTC day timestamp, or null. */
function parseIsoDayUtc(iso: string | null | undefined): number | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return t;
}

export interface NoticeRequirement {
  /** Statutory minimum written notice, in calendar days (0 = no notice due). */
  days: number;
  /** Statutory citation, or "none" for causes with no notice requirement. */
  basis: string;
}

/**
 * Statutory written-notice requirement for a departure cause (Lei 4/2012):
 *  - resignation: 30 days by the worker (Art. 53(2)); a shortfall means the
 *    worker owes the employer the missing days' pay (Art. 53(3));
 *  - employer-initiated termination (redundancy / market reasons and
 *    dismissal): 15 days when tenure is up to 2 years, 30 days beyond 2 years
 *    (Art. 49(8)); a shortfall means the employer pays the missing days
 *    (Art. 49(9));
 *  - every other cause (caducidade, mutual agreement, retirement, death,
 *    other): no statutory notice.
 * Unknown/invalid hireDate on an employer-side cause assumes the longer
 * 30-day notice (the safer reading for the worker).
 */
export function requiredNoticeDays(
  reason: DepartureReason,
  hireDate: string,
  lastWorkingDay: string,
): NoticeRequirement {
  if (reason === "resignation") {
    return { days: 30, basis: "Lei 4/2012 Art. 53(2)" };
  }
  if (reason === "redundancy" || reason === "termination") {
    const basis = "Lei 4/2012 Art. 49(8)";
    const hire = parseIsoDayUtc(hireDate);
    const last = parseIsoDayUtc(lastWorkingDay);
    if (hire === null || last === null) return { days: 30, basis };
    const hireD = new Date(hire);
    const secondAnniversary = Date.UTC(
      hireD.getUTCFullYear() + 2,
      hireD.getUTCMonth(),
      hireD.getUTCDate(),
    );
    return { days: last > secondAnniversary ? 30 : 15, basis };
  }
  return { days: 0, basis: "none" };
}

/**
 * Calendar days of notice actually given (noticeDate → lastWorkingDay).
 * Clamped at 0 when notice was given on/after the last day; null when either
 * date is missing or invalid.
 */
export function noticeDaysGiven(
  noticeDate: string,
  lastWorkingDay: string,
): number | null {
  const notice = parseIsoDayUtc(noticeDate);
  const last = parseIsoDayUtc(lastWorkingDay);
  if (notice === null || last === null) return null;
  return Math.max(0, Math.round((last - notice) / MS_PER_DAY));
}

/**
 * How many required-notice days were NOT given (0 = notice satisfied).
 * The shortfall is what one side owes the other in pay: the worker on a
 * resignation (Art. 53(3)), the employer on a market-reason termination
 * (Art. 49(9)). Null when the dates cannot be evaluated.
 */
export function noticeShortfallDays(
  noticeDate: string,
  lastWorkingDay: string,
  requiredDays: number,
): number | null {
  const given = noticeDaysGiven(noticeDate, lastWorkingDay);
  if (given === null) return null;
  return Math.max(0, requiredDays - given);
}

/**
 * DL 20/2017 Art. 5(2)-(3): the employer must declare the contract cessation
 * to INSS by day 10 of the month FOLLOWING the cessation; until declared,
 * the employment (and its contributions) is legally presumed to continue.
 * Returns the concrete deadline (YYYY-MM-DD) for a last working day.
 */
export function inssCessationDeadline(lastWorkingDay: string): string | null {
  const t = parseIsoDayUtc(lastWorkingDay);
  if (t === null) return null;
  const d = new Date(t);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 10));
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  return `${next.getUTCFullYear()}-${mm}-10`;
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
