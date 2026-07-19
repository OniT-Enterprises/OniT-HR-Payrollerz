/**
 * Pure helpers for the attendance import flow (Attendance page).
 *
 * Kept out of the page component so unit tests can import them without
 * dragging the page's firebase/context import chain into vitest (where the
 * Firebase env vars don't exist), and so react-refresh sees the page file
 * exporting only a component.
 */

/**
 * Parse a clock time from an import cell into 24-hour "HH:MM", or null when the
 * cell isn't a time we can trust.
 *
 * Handles plain 24h ("17:00", "9:05" -> "09:05") and 12h values with a
 * meridiem ("5:00 PM" -> "17:00", "5:00pm" -> "17:00", "12:00 AM" -> "00:00").
 *
 * The old strict check used an UNANCHORED /^\d{1,2}:\d{2}/ and then sliced the
 * first 5 characters, so "5:00 PM" matched, dropped the meridiem, and became
 * "05:00" — a silent 12-hour error. This anchors the pattern and converts the
 * meridiem instead of discarding it.
 */
export function parseImportTime(raw: string): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59) return null;
  const meridiem = match[3]?.toLowerCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "am") hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export type SkippedImportReason = "employee" | "date" | "time";

export interface SkippedImportRow {
  /** 1-based row number in the source file (the header counts as row 1). */
  rowNumber: number;
  reason: SkippedImportReason;
  /** The offending value, so the admin can find and fix the row. */
  detail: string;
}

/**
 * Build a one-line, human summary of the rows an import dropped, e.g.
 * "45 of 120 rows were skipped and not imported: 20 with no matching employee,
 * 15 with an invalid date, 10 with an invalid time." Returns "" when nothing
 * was skipped. Kept pure so the silent-loss behaviour can be unit-tested.
 */
export function describeSkippedImport(
  skipped: SkippedImportRow[],
  totalRows: number,
): string {
  if (skipped.length === 0) return "";
  const counts: Record<SkippedImportReason, number> = {
    employee: 0,
    date: 0,
    time: 0,
  };
  for (const row of skipped) counts[row.reason] += 1;
  const parts: string[] = [];
  if (counts.employee)
    parts.push(`${counts.employee} with no matching employee`);
  if (counts.date) parts.push(`${counts.date} with an invalid date`);
  if (counts.time) parts.push(`${counts.time} with an invalid time`);
  return `${skipped.length} of ${totalRows} rows were skipped and not imported: ${parts.join(", ")}.`;
}
