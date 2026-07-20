/**
 * Exit-interview surfacing — pure module (no Firebase imports) so the CSV
 * row mapping is unit-testable. The Offboarding page captures exit-interview
 * answers live (each field persists through its own mutation as it is
 * edited); this module only READS those stored answers off offboarding cases
 * and flattens them into export rows. Nothing here writes or aggregates.
 */

/**
 * Structural subset of OffboardingCase this module needs. Kept structural
 * (rather than importing from offboardingService) so this module — and its
 * unit test — never pull in Firebase.
 */
export interface ExitInterviewCaseSource {
  employeeName?: string;
  department?: string;
  departureReason?: string;
  lastWorkingDay?: string;
  exitInterview?: {
    overallSatisfaction?: string;
    managerRelationship?: string;
    primaryReason?: string;
    suggestions?: string;
    wouldRecommend?: string;
    additionalComments?: string;
  } | null;
}

/**
 * Type alias on purpose (not an interface): aliases get an implicit index
 * signature, so rows are directly assignable to exportToCSV's
 * Record<string, unknown>[] without casting.
 */
export type ExitInterviewRow = {
  employeeName: string;
  department: string;
  lastWorkingDay: string;
  departureReason: string;
  overallSatisfaction: string;
  managerRelationship: string;
  primaryReason: string;
  wouldRecommend: string;
  additionalComments: string;
};

// Stored slugs → readable English. Unknown values pass through unchanged so
// the export never silently drops data it does not recognise.
const SATISFACTION_LABELS: Record<string, string> = {
  "very-satisfied": "Very satisfied",
  satisfied: "Satisfied",
  neutral: "Neutral",
  dissatisfied: "Dissatisfied",
  "very-dissatisfied": "Very dissatisfied",
};

const MANAGER_LABELS: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  poor: "Poor",
};

const RECOMMEND_LABELS: Record<string, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};

const REASON_LABELS: Record<string, string> = {
  resignation: "Resignation",
  redundancy: "Redundancy",
  termination: "Termination",
  retirement: "Retirement",
  contract_end: "Contract end",
  mutual_agreement: "Mutual agreement",
  death: "Death of employee",
  other: "Other",
};

const label = (map: Record<string, string>, value: string | undefined): string =>
  value ? (map[value] ?? value) : "";

export const satisfactionLabel = (value: string | undefined): string =>
  label(SATISFACTION_LABELS, value);
export const managerRelationshipLabel = (value: string | undefined): string =>
  label(MANAGER_LABELS, value);
export const recommendLabel = (value: string | undefined): string =>
  label(RECOMMEND_LABELS, value);
export const departureReasonExportLabel = (value: string | undefined): string =>
  label(REASON_LABELS, value);

const ANSWER_FIELDS = [
  "overallSatisfaction",
  "managerRelationship",
  "primaryReason",
  "suggestions",
  "wouldRecommend",
  "additionalComments",
] as const;

/** True when at least one exit-interview answer was actually recorded. */
export function hasExitInterviewAnswers(source: ExitInterviewCaseSource): boolean {
  const interview = source.exitInterview;
  if (!interview) return false;
  return ANSWER_FIELDS.some((field) => Boolean(interview[field]?.trim()));
}

/**
 * Flatten cases into export rows. Cases with no recorded answers are dropped
 * (no empty rows in the export); input order is preserved.
 */
export function toExitInterviewRows(
  cases: ExitInterviewCaseSource[],
): ExitInterviewRow[] {
  return cases.filter(hasExitInterviewAnswers).map((source) => {
    const interview = source.exitInterview ?? {};
    const comments = [interview.additionalComments, interview.suggestions]
      .map((part) => part?.trim() ?? "")
      .filter(Boolean)
      .join(" — ");
    return {
      employeeName: source.employeeName ?? "",
      department: source.department ?? "",
      lastWorkingDay: source.lastWorkingDay ?? "",
      departureReason: departureReasonExportLabel(source.departureReason),
      overallSatisfaction: satisfactionLabel(interview.overallSatisfaction),
      managerRelationship: managerRelationshipLabel(interview.managerRelationship),
      primaryReason: interview.primaryReason?.trim() ?? "",
      wouldRecommend: recommendLabel(interview.wouldRecommend),
      additionalComments: comments,
    };
  });
}

/** Default (English) CSV columns; the page overlays t() labels over these. */
export const EXIT_INTERVIEW_CSV_COLUMNS: {
  key: keyof ExitInterviewRow;
  label: string;
}[] = [
  { key: "employeeName", label: "Employee" },
  { key: "department", label: "Department" },
  { key: "lastWorkingDay", label: "Last working day" },
  { key: "departureReason", label: "Departure reason" },
  { key: "overallSatisfaction", label: "Overall satisfaction" },
  { key: "managerRelationship", label: "Manager relationship" },
  { key: "primaryReason", label: "Primary reason for leaving" },
  { key: "wouldRecommend", label: "Would recommend" },
  { key: "additionalComments", label: "Additional comments" },
];
