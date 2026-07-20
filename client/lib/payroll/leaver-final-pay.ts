/**
 * Once-only final pay for a leaver (Art. 56 severance + Art. 44 subsidio).
 *
 * Pure module on purpose: usePayrollCalculator (and its unit tests) share it,
 * and keeping it out of the hook file means tests don't drag the hook's
 * firebase/context import chain into vitest, where the Firebase env vars
 * don't exist.
 */
import { calculateSubsidioAnual } from "@/lib/payroll/calculations-tl";
import { maxMoney, multiplyMoney, subtractMoney } from "@/lib/currency";

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

// ============================================
// Art. 55 unlawful-dismissal indemnity — REFERENCE ONLY (Lei 4/2012)
// ============================================

/**
 * Add whole calendar months to a UTC day timestamp, clamping the day-of-month
 * to the target month's length (31 Jan + 1 month = 28/29 Feb, not 2/3 Mar) so
 * contract anniversaries land where a human would put them.
 */
function addUtcMonthsClamped(t: number, months: number): number {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), lastDayOfTargetMonth));
}

/**
 * Lei 4/2012 Art. 55(3) unlawful-dismissal indemnity, in MONTHS of salary,
 * banded by CONTRACT DURATION (hire → contract end).
 *
 * This is COURT-AWARDED money, never a payroll earning: it exists only when a
 * court declares the dismissal unlawful (Art. 54(2)-(3), Art. 55(1)) AND
 * reinstatement is expressly declined by the worker or refused by the court.
 * Xefe surfaces it purely as a REFERENCE figure (exposure), never auto-pays it.
 *
 * Statute, official Portuguese text (Lei n.º 4/2012, Artigo 55.º
 * "Reintegração e Indemnização", n.º 3):
 *
 *   "3. Sem prejuízo do disposto no número 1, se o trabalhador declarar
 *    expressamente que não pretende a reintegração, ou se o tribunal
 *    considerar, a requerimento fundamentado do empregador, que a
 *    reintegração é prejudicial para o funcionamento da empresa, o
 *    trabalhador tem direito ao pagamento da seguinte indemnização:
 *    a) Metade de 1 mês de salário no caso em que a duração do contrato de
 *       trabalho tenha sido superior a 1 mês mas inferior a 6 meses;
 *    b) 1 mês de salário no caso em que a duração do contrato de trabalho
 *       tenha sido superior a 6 meses mas inferior a 1 ano;
 *    c) 2 meses de salário no caso em que a duração do contrato tenha sido
 *       superior a 1 ano mas inferior a 2 anos;
 *    d) 3 meses de salário no caso em que a duração do contrato tenha sido
 *       superior a 2 anos mas inferior a 3 anos;
 *    e) 4 meses de salário no caso em que a duração do contrato tenha sido
 *       superior a 3 anos mas inferior a 4 anos;
 *    f) 5 meses de salário no caso em que a duração do contrato de trabalho
 *       tenha sido superior a 4 anos mas inferior a 5 anos;
 *    g) 6 meses de salário no caso em que a duração do contrato tenha sido
 *       superior a 5 anos."
 *
 * Boundary readings:
 *  - duration ≤ 1 month → 0 (band (a) requires "superior a 1 mês");
 *  - exactly 6 months / exactly 1..5 years sit in a literal statutory gap
 *    ("superior a X mas inferior a Y", both strict) — we assign the exact
 *    boundary to the HIGHER band (6mo → 1, 1yr → 2, ... 5yr → 6), the
 *    pro-worker reading;
 *  - invalid/missing dates, or end on/before hire → 0.
 */
export function art55IndemnityMonths(hireDate: string, endDate: string): number {
  const hire = parseIsoDayUtc(hireDate);
  const end = parseIsoDayUtc(endDate);
  if (hire === null || end === null || end <= hire) return 0;
  if (end >= addUtcMonthsClamped(hire, 60)) return 6; // (g) > 5 yr
  if (end >= addUtcMonthsClamped(hire, 48)) return 5; // (f) 4 – 5 yr
  if (end >= addUtcMonthsClamped(hire, 36)) return 4; // (e) 3 – 4 yr
  if (end >= addUtcMonthsClamped(hire, 24)) return 3; // (d) 2 – 3 yr
  if (end >= addUtcMonthsClamped(hire, 12)) return 2; // (c) 1 – 2 yr
  if (end >= addUtcMonthsClamped(hire, 6)) return 1; //  (b) 6 mo – 1 yr
  if (end > addUtcMonthsClamped(hire, 1)) return 0.5; // (a) > 1 mo – 6 mo
  return 0; // ≤ 1 month: below band (a)'s "superior a 1 mês"
}

/**
 * Art. 55(3) indemnity in dollars: months band × monthly salary, decimal
 * money math (half-up to cents). REFERENCE ONLY — a court fixes the actual
 * award; this is never payable through payroll.
 *
 * `doubled` = Lei 4/2012 Art. 49(5): when the WORKER rescinds for just cause
 * grounded in Art. 49(3)(a)-(c) (culpable rights violation, unpaid wages,
 * offenses to physical/moral integrity), the indemnity is TWICE the Art. 55
 * values. Official Portuguese text (Artigo 49.º "Rescisão por iniciativa do
 * trabalhador", n.º 5):
 *
 *   "5. A indemnização referida no número anterior é calculada nos termos do
 *    disposto no artigo 55.º, tendo o trabalhador direito ao dobro dos
 *    valores indicados naquele artigo."
 */
export function art55Indemnity(
  monthlySalary: number,
  hireDate: string,
  endDate: string,
  doubled = false,
): number {
  const months = art55IndemnityMonths(hireDate, endDate);
  if (months === 0) return 0;
  return multiplyMoney(monthlySalary, doubled ? months * 2 : months);
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
