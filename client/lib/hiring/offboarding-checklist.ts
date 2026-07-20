/**
 * Offboarding checklist — pure module (no Firebase imports) so the progress
 * math is unit-testable and shared by offboardingService + the Offboarding
 * page. Adding a key here changes every case's progress denominator, so the
 * math iterates the CANONICAL key list (not whatever keys a stored doc
 * happens to have): older cases missing a newer key are treated as
 * not-yet-done rather than silently reaching 100% early.
 */

export interface OffboardingChecklist {
  accessRevoked: boolean;
  equipmentReturned: boolean;
  documentsSigned: boolean;
  knowledgeTransfer: boolean;
  finalPayCalculated: boolean;
  benefitsCancelled: boolean;
  exitInterviewCompleted: boolean;
  referenceLetter: boolean;
  /**
   * DL 20/2017 Art. 5(2)-(3): cessation declared at the INSS portal by day 10
   * of the month after the last working day — until declared, INSS presumes
   * the employment continues and contributions keep accruing.
   */
  inssCessationDeclared: boolean;
}

export const DEFAULT_OFFBOARDING_CHECKLIST: OffboardingChecklist = {
  accessRevoked: false,
  equipmentReturned: false,
  documentsSigned: false,
  knowledgeTransfer: false,
  finalPayCalculated: false,
  benefitsCancelled: false,
  exitInterviewCompleted: false,
  referenceLetter: false,
  inssCessationDeclared: false,
};

export const OFFBOARDING_CHECKLIST_KEYS = Object.keys(
  DEFAULT_OFFBOARDING_CHECKLIST,
) as (keyof OffboardingChecklist)[];

/**
 * Fill any keys a stored (older) checklist is missing with false, so every
 * case renders and computes against the full current checklist.
 */
export function normalizeOffboardingChecklist(
  raw: Partial<OffboardingChecklist> | null | undefined,
): OffboardingChecklist {
  return { ...DEFAULT_OFFBOARDING_CHECKLIST, ...(raw ?? {}) };
}

/**
 * Progress percentage over the canonical key list. Absent keys (legacy docs)
 * count as false — an 8-of-9 legacy case shows 89%, never a premature 100%.
 */
export function getChecklistProgress(
  checklist: Partial<OffboardingChecklist> | null | undefined,
): number {
  const completed = OFFBOARDING_CHECKLIST_KEYS.filter(
    (key) => checklist?.[key] === true,
  ).length;
  return Math.round((completed / OFFBOARDING_CHECKLIST_KEYS.length) * 100);
}
