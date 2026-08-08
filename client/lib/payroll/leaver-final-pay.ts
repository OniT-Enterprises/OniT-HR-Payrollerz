/**
 * Once-only final pay for a leaver (Art. 56 severance + Art. 44 subsidio).
 *
 * Pure module on purpose: usePayrollCalculator (and its unit tests) share it,
 * and keeping it out of the hook file means tests don't drag the hook's
 * firebase/context import chain into vitest, where the Firebase env vars
 * don't exist.
 *
 * ---------------------------------------------------------------------------
 * THE SCOPE CONTRACT — read this before changing anything below.
 *
 * Every defect this module has had (four in July 2026, three of them inside the
 * FIX for the previous one) was the same mistake in a different costume:
 *
 *     the ENTITLEMENT was computed over one scope, and the amount NETTED OFF it
 *     was computed over a different one.
 *
 *   - netted across two civil years, entitlement over one    -> underpaid
 *   - netted per run-year, entitlement per termination-year   -> paid twice
 *   - netted across the civil year, entitlement per engagement -> underpaid
 *   - netted using a defaulted date, entitlement from a real one -> paid twice
 *
 * So when you touch either side, state the scope out loud and change both:
 *   1. WHICH PERIOD does the entitlement cover? (calculateSubsidioAnual prorates
 *      from the hire date to the as-of/termination date.)
 *   2. WHICH COMMITTED AMOUNTS discharge exactly that period? (nothing earlier,
 *      nothing from another engagement, nothing from another civil year.)
 *   3. Is the data bounding (2) RECORDED, or synthesized? A default may prorate
 *      an entitlement; it must never narrow a netting — narrowing on a guess
 *      re-pays money that was already paid.
 *
 * Art. 56 is the deliberate exception: its suppression is year-agnostic, because
 * a second run over the same period must never re-pay it. See MONEY_CHAIN.md §4a.
 * ---------------------------------------------------------------------------
 */
import { calculateSubsidioAnual } from "@/lib/payroll/calculations-tl";
import { maxMoney, multiplyMoney, subtractMoney } from "@/lib/currency";
import {
  committedSubsidioDischarging,
  type CommittedSubsidioRun,
} from "@/lib/payroll/run-payroll-helpers";

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
 * Legacy practice suggestion for Art. 56 review (Lei 4/2012). The article's text is
 * cause-independent ("independentemente do motivo"), but real firm practice
 * pays severance on employer-initiated endings and NEVER on resignation
 * payslips — so resignation defaults OFF (with an "employee may still be
 * entitled — confirm with your accountant" note in the UI) and every other
 * cause suggests ON. The production pipeline does not apply this helper as a
 * default: a reviewer must make and acknowledge the decision, which is stamped
 * on the employee as `severanceOnTermination` and then honored by payroll.
 *
 * "death" (Art. 47(1)(b) caducidade on the worker's death) defaults ON on the
 * statute-literal reading — the Art. 56 payment is then payable to the
 * estate/heirs, which the offboarding UI flags for accountant confirmation.
 */
export function severanceDefaultForReason(
  reason: DepartureReason,
  options?: JustaCausaOption,
): boolean {
  // A dismissal for just cause on a VALID process extinguishes termination pay —
  // see JustaCausaOption. Overrides the cause-based suggestion above.
  if (options?.justaCausaEstablished) return false;
  return reason !== "resignation";
}

/**
 * Whether a dismissal for just cause has been established on a **valid**
 * disciplinary process (mined answer A1).
 *
 * Art. 23(4)(d) says a worker dismissed for just cause gets "sem qualquer
 * indemnização ou compensação" — both nouns, i.e. the Art. 55 indemnity AND the
 * Art. 56 compensation — while Art. 56 itself reads "independentemente do
 * motivo". A practitioner advisory resolves the conflict in favour of
 * Art. 23(4)(d): on just-cause termination under Arts. 50/23/24 there is
 * "**no severance pay if the process is valid**", where valid means a
 * disciplinary procedure with written accusation, right of defence and a formal
 * decision. Evidence: docs/MINED_ANSWERS_TERMINATION_AUG2026.md §A1.
 *
 * The validity condition is why this is a separate, explicitly-set flag rather
 * than a new DepartureReason: a procedurally defective dismissal does NOT earn
 * the exemption, and only a human reviewer can attest to the process. Absent or
 * false leaves every existing behaviour untouched.
 *
 * It also settles Art. 50(3) ("sem necessidade de aviso prévio") for
 * requiredNoticeDays, which previously had to bundle justa-causa dismissal into
 * the Art. 53(2) notice band because the two were indistinguishable.
 */
export interface JustaCausaOption {
  justaCausaEstablished?: boolean;
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
 *  - resignation: 30 days by the worker (Art. 49(8) — "cessar o contrato
 *    independentemente de justa causa, mediante comunicação escrita [...] com a
 *    antecedência mínima de 30 dias"); a shortfall means the worker owes the
 *    employer the missing days' pay (Art. 49(9));
 *  - employer-initiated termination (redundancy / market reasons and
 *    dismissal): 15 days when tenure is up to 2 years, 30 days beyond 2 years
 *    (Art. 53(2)); a shortfall means the employer pays the missing days
 *    (Art. 53(3));
 *  - every other cause (caducidade, mutual agreement, retirement, death,
 *    other): no statutory notice.
 * Unknown/invalid hireDate on an employer-side cause assumes the longer
 * 30-day notice (the safer reading for the worker).
 *
 * The articles are easy to transpose and were swapped here until Jul 2026:
 * Art. 49 is "Rescisão por iniciativa do TRABALHADOR" (so its (8)/(9) carry the
 * worker's 30-day notice and the worker-pays shortfall), while Art. 53 is
 * "Comunicação da rescisão" for the employer's market/technological/structural
 * rescission of Art. 52 (so its (2)/(3) carry the 15/30-day band and the
 * employer-pays shortfall). Both verified against the Jornal da República text.
 *
 * RESOLVED (was needs-Nico): `termination` is still bundled with `redundancy`
 * into the Art. 53(2) band by DEFAULT, because Xefe's `termination` label alone
 * cannot distinguish justa-causa from no-cause dismissal. A caller that knows it
 * was justa causa on a valid process now says so via `justaCausaEstablished`, and
 * gets the Art. 50(3) answer — no prior notice required. Absent, behaviour is
 * unchanged. See docs/MINED_ANSWERS_TERMINATION_AUG2026.md §A1 and
 * docs/TL_LAW_GAP_MATRIX_JUL2026.md §4.1.
 */
export function requiredNoticeDays(
  reason: DepartureReason,
  hireDate: string,
  lastWorkingDay: string,
  options?: JustaCausaOption,
): NoticeRequirement {
  // Art. 50(3): a justa-causa dismissal needs no prior notice at all. Only
  // meaningful for an employer-initiated dismissal — it must not silence the
  // worker's own 30-day duty on a resignation, so it is checked after that.
  if (reason === "resignation") {
    return { days: 30, basis: "Lei 4/2012 Art. 49(8)" };
  }
  if (options?.justaCausaEstablished && reason === "termination") {
    return { days: 0, basis: "Lei 4/2012 Art. 50(3)" };
  }
  if (reason === "redundancy" || reason === "termination") {
    const basis = "Lei 4/2012 Art. 53(2)";
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
 * resignation (Art. 49(9)), the employer on a market-reason termination
 * (Art. 53(3)). Null when the dates cannot be evaluated.
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
 * Paid job-search credit during an employer redundancy notice — Lei 4/2012
 * Art. 53(4): "Durante o período de aviso prévio, o trabalhador tem direito a
 * utilizar um crédito de horas correspondente a dois dias de trabalho por semana
 * sem prejuízo do direito à correspondente remuneração."
 *
 * Paid in full: these hours are NOT an absence and must not be docked, and they
 * do not consume the Art. 32 annual-leave balance. Art. 53(5) requires the worker
 * to tell the employer how they will use the credit at least 1 day in advance.
 *
 * `redundancy` ONLY. Art. 53 is the communication rule for the Art. 52
 * market/technological/structural rescission, so the credit does not attach to a
 * resignation (Art. 49) or to a justa-causa dismissal (Art. 50, which needs no
 * notice period at all).
 *
 * Counts 2 days per COMPLETE week of notice — the conservative floor. The statute
 * says "por semana" without addressing a part-week, so whether a trailing partial
 * week also earns the 2 days is unresolved; this returns the floor and the UI
 * presents it as a minimum. OPEN (needs-Nico).
 *
 * Returns null when the dates cannot be evaluated, 0 for any non-redundancy cause.
 */
export function jobSearchCreditDays(
  reason: DepartureReason,
  noticeDate: string,
  lastWorkingDay: string,
): number | null {
  if (reason !== "redundancy") return 0;
  const noticeDays = noticeDaysGiven(noticeDate, lastWorkingDay);
  if (noticeDays === null) return null;
  return Math.floor(noticeDays / 7) * 2;
}

// ============================================
// Re-engagement / rehire seniority (Lei 4/2012 Arts. 12, 7)
// ============================================

/** Lei 4/2012 Art. 12 — gap below which a re-engagement continues the old service. */
export const REENGAGEMENT_CONTINUITY_DAYS = 90;

export interface RehireSeniority {
  /** The hireDate to store: the ORIGINAL one when service continues, else the new start. */
  hireDate: string;
  /** True when the earlier engagement's service carries into the new one. */
  seniorityContinuous: boolean;
  /** Calendar days between the previous last working day and the new start, or null. */
  gapDays: number | null;
  /**
   * True when Art. 12 converts the new fixed-term contract to PERMANENT. Surfaced
   * for a reviewer; Xefe does not silently rewrite the contract type, because the
   * conversion also requires the re-engagement to be for the SAME reason, which
   * is not recorded.
   */
  becomesPermanent: boolean;
  basis: string;
}

/**
 * Which hire date a re-engaged worker keeps — Lei 4/2012 Arts. 12 and 7.
 *
 * A practitioner advisory states the rule as: a new fixed-term contract with the
 * same worker for the same reason **within 90 days** automatically becomes
 * permanent and **seniority counts from the original start date**; re-engagement
 * after more than 90 days "may restart seniority unless continuity is proven".
 * Seniority drives severance, service compensation and holiday accrual. Evidence:
 * docs/MINED_ANSWERS_TERMINATION_AUG2026.md §A4.
 *
 * Xefe previously moved hireDate to the new start date unconditionally, which
 * silently erased service the worker was still entitled to whenever the break was
 * short. Inside the window the ORIGINAL date is kept.
 *
 * Note the asymmetry in how missing data is treated, and keep it:
 *  - an unreadable/absent PREVIOUS termination date cannot establish continuity,
 *    so it does not carry seniority back — but it is reported (gapDays null) so
 *    the UI can ask rather than quietly resetting;
 *  - beyond 90 days the default is a fresh clock, matching the advisory's "may
 *    restart", with continuity available as an explicit reviewer override.
 *
 * `continuityProven` forces continuity regardless of the gap — the reviewer
 * asserting the "unless continuity is proven" branch.
 */
export function resolveRehireSeniority(args: {
  originalHireDate: string;
  previousTerminationDate: string | null | undefined;
  newStartDate: string;
  continuityProven?: boolean;
}): RehireSeniority {
  const { originalHireDate, previousTerminationDate, newStartDate, continuityProven } = args;

  const prev = parseIsoDayUtc(previousTerminationDate);
  const start = parseIsoDayUtc(newStartDate);
  const gapDays =
    prev === null || start === null ? null : Math.max(0, Math.round((start - prev) / MS_PER_DAY));

  const withinWindow = gapDays !== null && gapDays <= REENGAGEMENT_CONTINUITY_DAYS;
  const continuous = Boolean(continuityProven) || withinWindow;

  // Only a *valid* original hire date can be carried back; otherwise there is
  // nothing coherent to preserve and the new start is the only usable date.
  const originalUsable = parseIsoDayUtc(originalHireDate) !== null;

  return {
    hireDate: continuous && originalUsable ? originalHireDate : newStartDate,
    seniorityContinuous: continuous && originalUsable,
    gapDays,
    becomesPermanent: withinWindow,
    basis:
      continuityProven && !withinWindow
        ? 'Lei 4/2012 Art. 12 — continuity asserted by reviewer'
        : withinWindow
          ? `Lei 4/2012 Art. 12 — re-engaged within ${REENGAGEMENT_CONTINUITY_DAYS} days`
          : gapDays === null
            ? 'no usable previous termination date — service restarted'
            : `re-engaged after ${REENGAGEMENT_CONTINUITY_DAYS} days — service restarted`,
  };
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
 * Never a payroll earning. Xefe surfaces it purely as a REFERENCE figure
 * (exposure) and never auto-pays it.
 *
 * The old wording here — "it exists ONLY when a court declares the dismissal
 * unlawful" — was wrong, and wrong four times over. Two different things need
 * separating:
 *
 *  - Art. 55's NATIVE pathway does involve a court: n.º 1 gives reinstatement
 *    plus back pay once the rescission "seja declarada ilícita", and Art.
 *    51(2) / Art. 54(2) supply the tribunal and the 60-day window. The n.º 3
 *    scale then applies in lieu of reinstatement.
 *
 *  - Art. 55's QUANTUM is separately IMPORTED by four articles that mention
 *    no court at all:
 *      Art. 15(9)  cessation agreed after a suspension — "tendo o trabalhador
 *                  direito ao pagamento da indemnização prevista no artigo 55.º"
 *      Art. 17(3)  worker rescinds after a prejudicial transfer — "com direito
 *                  a indemnização, nos termos previstos no artigo 55.º"
 *      Art. 45(3)  dismissal on a prohibited ground is NULO (not "ilícito") —
 *                  "conferindo ao trabalhador o direito a ser indemnizado nos
 *                  termos do disposto no artigo 55.º"
 *      Art. 49(5)  worker resigns for just cause — "tendo o trabalhador
 *                  direito ao DOBRO dos valores indicados naquele artigo"
 *
 * Two cautions before anyone wires those up:
 *
 *  1. The Art. 49(5) doubling is CONTINGENT, not settled. Art. 49(6) lets the
 *     employer challenge the resignation in court within 60 days, and Art.
 *     49(7) gives the EMPLOYER an indemnity if the court finds the just cause
 *     unfounded. It is exposure conditional on the worker's case standing up.
 *  2. Only Art. 49(5) uses the unambiguous quantum formula ("é calculada nos
 *     termos do disposto no artigo 55.º"). The other three say "a indemnização
 *     prevista no artigo 55.º", and Art. 55(3)'s own chapeau is conditional on
 *     reinstatement being declined or refused — so how much those three import
 *     is an interpretive question, not a lookup.
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
  /**
   * Art. 49(5) doubling. DELIBERATELY UNREACHED by app code: the only call
   * site (Offboarding.tsx) passes three arguments, so this is exercised by
   * tests alone.
   *
   * That is not an oversight to tidy away. Reaching it means showing the card
   * for a RESIGNATION, and an ordinary resignation is owed nothing at all —
   * Art. 49(8) carries no indemnity, and Art. 49(9) runs the money the other
   * way (the worker owes the employer for unserved notice). Rendering a
   * dollar figure captioned "indemnity" beside every resignation would invite
   * a first-time employer to pay money that is not owed.
   *
   * Wiring it therefore needs the just-cause attestation to gate the card's
   * VISIBILITY, not merely the ×2 — and a practitioner's sign-off first, given
   * the Art. 49(6)-(7) contingency above. Keep the parameter: the doubling is
   * real law and the arithmetic is tested.
   */
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
 *    whatever 13th month is already committed FOR THAT SAME CIVIL YEAR (annual
 *    run or a prior final run), clamped at 0. It is owed regardless of the
 *    severance decision.
 *  - A non-leaver follows the ordinary includeSubsidioAnual toggle.
 *
 * The two once-only guards are scoped DIFFERENTLY on purpose, and mixing them up
 * has now caused a bug in each direction:
 *  - Art. 44 is a per-civil-year entitlement, so it may only be netted against
 *    the SAME year's committed subsidio. `subsidioAnualByRun` carries the per-run breakdown that makes that
 *    breakdown. Netting the year-agnostic total against a termination-year
 *    entitlement paid a January leaver $0 of a subsidio they were owed, because
 *    the lookup spans both years of a period straddling 1 January.
 *  - Art. 56 severance is suppressed on ANY committed service compensation in
 *    the looked-up window, deliberately year-agnostic: a second run over the
 *    same period must never re-pay it. (Whether Art. 56 is once-per-employment
 *    rather than once-per-year — which would matter for a rehire — is OPEN, gap
 *    matrix F20/line 104. Widening it all-time would underpay a genuinely
 *    rehired worker who completes a fresh 5-year block, so it stays as-is.)
 */
export function resolveLeaverFinalPay(args: {
  inPeriodTermination: string | null;
  monthlySalary: number;
  hireDate: string;
  asOfDate: Date;
  includeSubsidioAnual: boolean;
  subsidioConfig?: { proRataForNewEmployees?: boolean };
  committed: {
    serviceCompensation: number;
    subsidioAnual: number;
    /** Committed subsidio with the wage period of each run that paid it. */
    subsidioAnualByRun?: readonly CommittedSubsidioRun[];
    /** Art. 32 untaken-leave payout already committed, year-agnostic. */
    untakenLeavePayout?: number;
  };
  /**
   * Start of the CURRENT period of employment, from the employee's RECORDED hire
   * date — pass undefined when none is on file. Deliberately separate from
   * `hireDate` above, which callers default to today when the field is empty: that
   * default is fine for prorating an entitlement but must never bound the netting,
   * because "today" would exclude every earlier run of a CONTINUOUS engagement and
   * re-pay a subsidio already paid. Only recorded data may narrow the netting.
   */
  engagementStart?: string;
  /** Only explicit true includes Art. 56; absence is review-blocked/safe-off. */
  severanceEntitled?: boolean;
  /**
   * Art. 56 already settled for service BEFORE the current engagement, from
   * `Employee.priorServiceCompensationSettled`. Suppresses a re-pay all-time,
   * which `committed.serviceCompensation` cannot: that lookup only spans the
   * termination year ±~2 months, so a rehire carrying seniority back across a
   * year boundary would otherwise re-pay blocks already settled. Only ever
   * suppresses — it can never increase a payment.
   */
  priorServiceCompensationSettled?: boolean;
  /**
   * Art. 32 untaken-leave days a reviewer recorded at offboarding. Paid once, on
   * the same year-agnostic footing as Art. 56: a second run over the same period
   * must not re-pay it, so any committed `untaken_leave` earning zeroes it.
   */
  untakenLeaveDays?: number;
}): {
  terminationDate: string | undefined;
  subsidioAnual: number;
  /** Days to pay out this run — 0 once a previous run has settled them. */
  untakenLeaveDays: number;
} {
  const {
    inPeriodTermination,
    monthlySalary,
    hireDate,
    asOfDate,
    includeSubsidioAnual,
    subsidioConfig,
    committed,
    engagementStart,
    severanceEntitled = false,
    priorServiceCompensationSettled = false,
    untakenLeaveDays = 0,
  } = args;

  // Suppressed year-agnostically, exactly like Art. 56: the entitlement is a
  // once-per-departure balance, so ANY committed untaken-leave payout in the
  // looked-up window discharges it and a re-run must not pay it again.
  const leaveDaysToPay =
    committed.untakenLeavePayout && committed.untakenLeavePayout > 0
      ? 0
      : Math.max(0, untakenLeaveDays);

  if (!inPeriodTermination) {
    return {
      terminationDate: undefined,
      subsidioAnual: includeSubsidioAnual
        ? calculateSubsidioAnual(monthlySalary, hireDate, asOfDate, subsidioConfig)
        : 0,
      // Art. 32 payout belongs to a departure; a non-leaver run never pays it.
      untakenLeaveDays: 0,
    };
  }

  const entitlement = calculateSubsidioAnual(
    monthlySalary,
    hireDate,
    new Date(`${inPeriodTermination}T00:00:00`),
    { ...subsidioConfig, terminationDate: inPeriodTermination },
  );
  return {
    // Skip severance if it was already paid/committed in an earlier run, or paid
    // for pre-rehire service outside that lookup's window, or if the offboarding
    // decision excluded it for this termination's cause.
    terminationDate:
      committed.serviceCompensation > 0 ||
      priorServiceCompensationSettled ||
      !severanceEntitled
        ? undefined
        : inPeriodTermination,
    subsidioAnual: maxMoney(
      0,
      subtractMoney(
        entitlement,
        committedSubsidioForLeaver(committed, inPeriodTermination, engagementStart),
      ),
    ),
    untakenLeaveDays: leaveDaysToPay,
  };
}

/**
 * Committed Art. 44 subsidio that discharges this leaver's own civil-year
 * entitlement — see committedSubsidioDischarging for the rule and why a per-year
 * key cannot express it.
 *
 * Falls back to the year-agnostic total when no per-run breakdown was supplied,
 * so a caller that predates the breakdown keeps OVER-netting. That direction is
 * deliberate: over-netting underpays a subsidio, which the worker sees and can be
 * topped up, while under-netting sends a second 13th month out the door.
 */
function committedSubsidioForLeaver(
  committed: {
    subsidioAnual: number;
    subsidioAnualByRun?: readonly CommittedSubsidioRun[];
  },
  inPeriodTermination: string,
  engagementStart: string | undefined,
): number {
  const byRun = committed.subsidioAnualByRun;
  if (!byRun) return committed.subsidioAnual;
  // The recorded hire date scopes BOTH sides: calculateSubsidioAnual prorates the
  // entitlement from it, so the netting must ignore runs that predate it or a
  // rehired worker is charged twice for the same months. Absent (or incoherent)
  // recorded data means no narrowing at all — the whole civil year is considered,
  // which is the direction that cannot double-pay. See committedSubsidioDischarging.
  const usable =
    engagementStart && engagementStart <= inPeriodTermination ? engagementStart : undefined;
  return committedSubsidioDischarging(byRun, inPeriodTermination, usable);
}
