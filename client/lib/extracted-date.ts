/**
 * Document-date sanity for AI-extracted bill/receipt fields.
 *
 * Extraction is not reliable on ambiguous dates. A real supplier invoice in the
 * TL document corpus printed `Invoice date: 06/11/2024`, was emailed on 18 June
 * 2024 and billed "Maio e Junho 2024" — the extractor returned `2024-11-06`,
 * swapping day and month and pushing the bill five months into the future, even
 * though the prompt states DD/MM is the local convention. A bill date drives AP
 * aging, the period the bill lands in, and the withholding remittance month, so
 * an implausible one must not be pre-filled silently.
 *
 * Only FUTURE dates are treated as implausible. Old dates are not: auditing the
 * corpus showed every document dated more than a year before its email was a
 * genuinely old document being sent on later, which is normal for a small
 * business catching up on paperwork.
 *
 * Firebase-free on purpose: CI unit tests run without VITE_FIREBASE_* env.
 */

/**
 * How an extracted document date relates to today:
 * - `usable`  — today or in the past; pre-fill it.
 * - `future`  — dated ahead of today, which an already-issued document cannot
 *               be. Do NOT pre-fill; ask the user to check it.
 * - `missing` — absent or not a real `YYYY-MM-DD` calendar date.
 */
export type ExtractedDateClass = 'usable' | 'future' | 'missing';

/**
 * One day of slack. `todayIso` comes from Timor-Leste local time while the
 * extractor resolves "today" in UTC (TL is UTC+9), so a document issued today
 * in Dili must not be called future-dated on a boundary.
 */
const FUTURE_SLACK_DAYS = 1;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a strict `YYYY-MM-DD` string, rejecting non-calendar dates like 02-31. */
function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject dates the Date constructor silently rolls over (e.g. 2024-02-31).
  if (
    date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() + 1 !== Number(month)
    || date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return date;
}

/** Classify an extracted document date against today (both `YYYY-MM-DD`). */
export function classifyExtractedDocumentDate(
  raw: string | null | undefined,
  todayIso: string,
): ExtractedDateClass {
  if (typeof raw !== 'string') return 'missing';
  const documentDate = parseIsoDate(raw.trim());
  if (!documentDate) return 'missing';
  const today = parseIsoDate(todayIso);
  if (!today) return 'usable'; // No trustworthy reference — do not block the pre-fill.

  const daysAhead = (documentDate.getTime() - today.getTime()) / 86_400_000;
  return daysAhead > FUTURE_SLACK_DAYS ? 'future' : 'usable';
}

/**
 * True when the extracted date must not be pre-filled. A missing date is not
 * implausible — there is simply nothing to pre-fill.
 */
export function isImplausibleDocumentDate(
  raw: string | null | undefined,
  todayIso: string,
): boolean {
  return classifyExtractedDocumentDate(raw, todayIso) === 'future';
}
