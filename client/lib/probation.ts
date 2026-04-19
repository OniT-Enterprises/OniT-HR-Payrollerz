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
