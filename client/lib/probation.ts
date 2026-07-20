/**
 * Timor-Leste probation period derivation.
 *
 * TL Labour Code (Lei n.º 4/2012):
 * - Fixed-term contract ≤ 6 months → 8 days probation
 * - Fixed-term contract > 6 months → 15 days probation
 * - Permanent contract → 30 days default; up to 90 days for managers/complex roles
 * - After 3 years of continuous fixed-term renewals, the contract becomes permanent
 */

export type ContractType = "Permanent" | "Fixed-Term";

export type PermanentProbationOption = "30_days" | "90_days";

export interface ProbationInput {
  contractType: ContractType | string;
  contractDurationMonths?: number;
  permanentProbation?: PermanentProbationOption;
}

export interface ProbationResult {
  days: number;
  label: string;
  derived: boolean;
  rationale: string;
}

export function parseDurationToMonths(duration: string): number | undefined {
  if (!duration) return undefined;
  const trimmed = duration.trim().toLowerCase();
  const num = parseFloat(trimmed);
  if (!Number.isFinite(num)) return undefined;
  if (/year|yr/.test(trimmed)) return Math.round(num * 12);
  if (/week|wk/.test(trimmed)) return Math.round(num / 4.345);
  if (/day/.test(trimmed)) return Math.round(num / 30);
  return Math.round(num);
}

export function deriveProbation(input: ProbationInput): ProbationResult {
  const { contractType, contractDurationMonths, permanentProbation } = input;

  if (contractType === "Fixed-Term") {
    const months = contractDurationMonths ?? 0;
    if (months <= 0) {
      return {
        days: 8,
        label: "8 days",
        derived: true,
        rationale: "Defaulted to shortest probation until contract duration is set.",
      };
    }
    if (months <= 6) {
      return {
        days: 8,
        label: "8 days",
        derived: true,
        rationale: "Fixed-term ≤ 6 months → 8 days (TL Labour Code).",
      };
    }
    return {
      days: 15,
      label: "15 days",
      derived: true,
      rationale: "Fixed-term > 6 months → 15 days (TL Labour Code).",
    };
  }

  const selection: PermanentProbationOption = permanentProbation ?? "30_days";
  if (selection === "90_days") {
    return {
      days: 90,
      label: "90 days (3 months)",
      derived: false,
      rationale: "Permanent contract — extended probation (manager / complex role).",
    };
  }
  return {
    days: 30,
    label: "30 days (1 month)",
    derived: false,
    rationale: "Permanent contract — standard probation.",
  };
}

export const THREE_YEAR_CONVERSION_DAYS = 3 * 365;

export function hasExceededFixedTermLimit(
  fixedTermStart: Date | string | undefined,
  today: Date = new Date(),
): boolean {
  if (!fixedTermStart) return false;
  const start = typeof fixedTermStart === "string" ? new Date(fixedTermStart) : fixedTermStart;
  if (Number.isNaN(start.getTime())) return false;
  const diffMs = today.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= THREE_YEAR_CONVERSION_DAYS;
}

/**
 * Art. 12(4)/13: true when the contract AS DATED already spans more than the
 * 3-year fixed-term limit (hireDate → contractEndDate), even if that end date
 * is still in the future. Complements hasExceededFixedTermLimit (which only
 * measures elapsed time since hire).
 */
export function contractSpanExceedsFixedTermLimit(
  hireDate: string | undefined,
  contractEndDate: string | undefined,
): boolean {
  if (!hireDate || !contractEndDate) return false;
  const end = new Date(contractEndDate);
  if (Number.isNaN(end.getTime())) return false;
  return hasExceededFixedTermLimit(hireDate, end);
}

// ─── Fixed-term justification motives (Art. 12) ─────────────────────────────

/**
 * Art. 12(1): a fixed-term contract may only be celebrated to meet the
 * employer's TEMPORARY needs, "nomeadamente" (i.e. a non-exhaustive list):
 *   (a) substitution of an absent/impeded worker;
 *   (b) seasonal activities;
 *   (c) work on a specific job, project or other determined temporary activity.
 * The last two entries below cover common practice under the same
 * "temporary need" umbrella (the statute's list is explicitly illustrative).
 *
 * Art. 12(2): the contract must clearly state the justifying motive — a
 * fixed-term contract without one is deemed a contract of indefinite duration.
 */
export const FIXED_TERM_MOTIVES = [
  { value: "substitution_absent_worker", label: "Substitution of an absent worker", article: "Art. 12(1)(a)" },
  { value: "seasonal_activity", label: "Seasonal activity", article: "Art. 12(1)(b)" },
  { value: "specific_project", label: "Specific job or project", article: "Art. 12(1)(c)" },
  { value: "activity_increase", label: "Temporary increase in activity", article: "Art. 12(1)" },
  { value: "other_temporary_need", label: "Other temporary need", article: "Art. 12(1)" },
] as const;

export type FixedTermMotive = (typeof FIXED_TERM_MOTIVES)[number]["value"];

// ─── Pure date helpers (timezone-stable, noon-UTC anchored) ─────────────────

function parseISO(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add whole days to a YYYY-MM-DD string. Returns "" for unparseable input. */
export function addDaysToISODate(isoDate: string, days: number): string {
  const base = parseISO(isoDate);
  if (!base) return "";
  base.setUTCDate(base.getUTCDate() + days);
  return formatISO(base);
}

/**
 * Add calendar months to a YYYY-MM-DD string, clamping day overflow
 * (e.g. 2026-01-31 + 1 month → 2026-02-28). Returns "" for bad input.
 */
export function addMonthsToISODate(isoDate: string, months: number): string {
  const base = parseISO(isoDate);
  if (!base) return "";
  const day = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + months);
  const daysInTarget = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, daysInTarget));
  return formatISO(base);
}

/**
 * Art. 14: statutory probation end date for a contract starting `startDate`
 * (YYYY-MM-DD) — start + deriveProbation(...).days. Returns "" for bad input.
 */
export function deriveProbationEndDate(startDate: string, input: ProbationInput): string {
  if (!startDate) return "";
  const { days } = deriveProbation(input);
  return addDaysToISODate(startDate, days);
}

// ─── Contract renewals (Arts. 12(4), 13) ─────────────────────────────────────

export interface ContractRenewalEntry {
  /** Previous contract end date (YYYY-MM-DD). */
  from: string;
  /** New contract end date (YYYY-MM-DD). */
  to: string;
  /** ISO timestamp of when the change was recorded. */
  changedAt: string;
  /** Optional user id/email that made the change. */
  changedBy?: string;
}

/**
 * Art. 13: record a renewal whenever the contract end date moves FORWARD.
 * Returns the new renewals array to persist, or null when the change is not a
 * renewal (first-time set, cleared, unchanged, or moved backward) — in which
 * case the caller should leave the stored array untouched.
 * Never mutates `existing`.
 */
export function appendContractRenewal(
  existing: ContractRenewalEntry[] | undefined,
  previousEndDate: string | undefined,
  newEndDate: string | undefined,
  changedAt: string,
  changedBy?: string,
): ContractRenewalEntry[] | null {
  if (!previousEndDate || !newEndDate) return null;
  // ISO date strings compare correctly as strings.
  if (newEndDate <= previousEndDate) return null;
  const entry: ContractRenewalEntry = changedBy
    ? { from: previousEndDate, to: newEndDate, changedAt, changedBy }
    : { from: previousEndDate, to: newEndDate, changedAt };
  return [...(existing ?? []), entry];
}
