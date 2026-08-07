/**
 * Turning a real attendance spreadsheet into text the extractor can read.
 *
 * Measured against 12 real TL attendance workbooks (Indonesian "Absensi" sheets
 * and hand-made timesheets), the previous inline conversion in Attendance.tsx
 * failed on a whole class of file for three reasons:
 *
 *  1. Every `Date` cell was rendered `YYYY-MM-DD`. Excel stores a TIME-ONLY cell
 *     as a date on the 1899-12-30 epoch, so a clock-in of 09:23 arrived as the
 *     text "1899-12-30" — every clock time in the file was destroyed before the
 *     model saw it, and those sheets returned zero rows.
 *  2. Only `worksheets[0]` was read. Real timesheets carry ONE SHEET PER MONTH
 *     (one workbook had 73), so the import silently looked at July 2017.
 *  3. The whole sheet went in one request. A 253k-character workbook exceeded the
 *     extractor's 90s timeout and aborted, importing nothing.
 *
 * Pure and Firebase-free so CI can test it.
 */

/** A sheet's cells, tab-joined per row — what the extractor is fed. */
export interface TableText {
  text: string;
  /** Sheet the text came from, for the operator-facing summary. */
  sheetName: string;
}

/**
 * Excel has no time type: a time-only cell is a date on the workbook epoch
 * (1899-12-30 for the 1900 date system, or 1904 for the Mac system). Anything at
 * or before 1904 is therefore a clock time, never a real attendance day.
 */
function isExcelTimeEpoch(date: Date): boolean {
  return date.getUTCFullYear() <= 1904;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Render one cell as text, preserving clock times.
 *
 * Excel time cells come back from ExcelJS as UTC-based Dates, so the time is read
 * in UTC — reading it locally would shift every clock time by the machine's
 * offset (a real hazard here: the corpus workbooks parse as GMT+0100 on this
 * machine while the business is in Dili, UTC+9).
 */
export function excelCellToText(value: unknown): string {
  if (value == null) return '';

  if (value instanceof Date) {
    const hours = value.getUTCHours();
    const minutes = value.getUTCMinutes();
    const time = `${pad(hours)}:${pad(minutes)}`;
    if (isExcelTimeEpoch(value)) return time;
    const day = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    // Midnight almost always means "a date cell", not "clocked in at 00:00".
    return hours === 0 && minutes === 0 ? day : `${day} ${time}`;
  }

  if (typeof value === 'object') {
    const cell = value as Record<string, unknown>;
    // Formula cells carry their computed value in `result`, which may itself be
    // a Date (a computed "Hours" column) — recurse so its time survives.
    if ('result' in cell) return excelCellToText(cell.result);
    if ('richText' in cell && Array.isArray(cell.richText)) {
      return cell.richText.map((part) => String((part as { text?: unknown }).text ?? '')).join('').trim();
    }
    if ('text' in cell) return String(cell.text ?? '').trim();
    if ('hyperlink' in cell) return String(cell.text ?? cell.hyperlink ?? '').trim();
    if ('error' in cell) return '';
    return '';
  }

  return String(value).trim();
}

/** The shape of an ExcelJS worksheet, narrowed to what this module reads. */
export interface MinimalWorksheet {
  name: string;
  eachRow: (callback: (row: { values?: unknown }) => void) => void;
}

/**
 * Tab-join a worksheet's cells, dropping rows that hold nothing.
 *
 * Real timesheets interleave a blank row after every data row (a print layout),
 * which doubled the payload sent to the model for no information.
 */
const TIME_OR_DATE = /^\d{1,2}:\d{2}|^\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/;

/** Does this row carry an actual clock time or calendar date? */
function hasTimeOrDate(cells: readonly string[]): boolean {
  return cells.some((cell) => TIME_OR_DATE.test(cell));
}

export function worksheetToTableText(worksheet: MinimalWorksheet): string {
  const rows: string[][] = [];
  worksheet.eachRow((row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    const cells = values.map(excelCellToText);
    if (cells.some((cell) => cell !== '')) rows.push(cells);
  });

  // Print-layout sheets put a spacer row after every data row, carrying only the
  // weekday and day-of-month labels. Those rows cost payload and add nothing, but
  // the HEADER rows above the first data row must survive — they hold the
  // employee names and the Start/Finish/Hours column groups.
  const firstDataIndex = rows.findIndex((cells) => hasTimeOrDate(cells));
  const kept = firstDataIndex === -1
    ? rows
    : rows.filter((cells, index) => index <= firstDataIndex || hasTimeOrDate(cells));

  return kept.map((cells) => cells.join('\t')).join('\n');
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Levenshtein distance, capped — only used on short month words. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[cols - 1];
}

/**
 * Which month does this sheet name mean?
 *
 * Real sheet names are misspelled in ways a prefix match cannot absorb —
 * "Agust" (no u), "Jully" (extra l), "Octoberber", "0ct" (zero for O) — so an
 * exact 3-letter prefix is tried first and a small edit distance second.
 */
function monthFromSheetName(normalized: string): number | null {
  const token = normalized.match(/^[a-z]+/)?.[0] ?? '';
  if (!token) return null;
  for (let index = 0; index < MONTH_NAMES.length; index += 1) {
    if (token.startsWith(MONTH_NAMES[index].slice(0, 3))) return index + 1;
  }
  let best: { index: number; distance: number } | null = null;
  for (let index = 0; index < MONTH_NAMES.length; index += 1) {
    const month = MONTH_NAMES[index];
    const distance = editDistance(token.slice(0, month.length + 1), month);
    if (distance <= 2 && (!best || distance < best.distance)) best = { index, distance };
  }
  return best ? best.index + 1 : null;
}

/**
 * Pick the worksheet a month-per-sheet workbook means.
 *
 * Sheet names in the wild are spelled loosely — "Jully 2022", "Agust 2022",
 * "0ct 2019", "Octoberber 2023", "November 17" — so matching is deliberately
 * forgiving: a 3-letter month prefix plus the year in either 4- or 2-digit form.
 * With no target, or no match, the first sheet is used, exactly as before.
 */
export function pickWorksheetName(
  sheetNames: readonly string[],
  target?: { year: number; month: number },
): string | undefined {
  if (sheetNames.length === 0) return undefined;
  if (!target || sheetNames.length === 1) return sheetNames[0];

  if (!MONTH_NAMES[target.month - 1]) return sheetNames[0];
  const shortYear = String(target.year % 100).padStart(2, '0');

  const scored = sheetNames
    .map((name) => {
      // A zero where an O belongs ("0ct") is a real spelling in the corpus, so
      // normalise before matching. Digits are kept for the year.
      const normalized = name.toLowerCase().replace(/^0(?=[a-z])/, 'o').replace(/[^a-z0-9]/g, '');
      const yearInName = name.match(/(?:19|20)\d{2}/)?.[0];
      const monthInName = monthFromSheetName(normalized);
      const hasFullYear = yearInName === String(target.year);
      // Only trust a bare 2-digit year when no 4-digit year is present.
      const hasShortYear = !yearInName && new RegExp(`[a-z]${shortYear}$`).test(normalized);
      if (monthInName !== target.month) return { name, score: 0 };
      return { name, score: hasFullYear ? 3 : hasShortYear ? 2 : 1 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  // A month-only match (score 1) is ambiguous across years in a 73-sheet
  // workbook, so require a year match to override the first sheet.
  return scored[0]?.score >= 2 ? scored[0].name : sheetNames[0];
}

/**
 * Split table text into model-sized chunks, repeating the header rows in each.
 *
 * Without this a large workbook is one request that exceeds the extractor's
 * timeout and imports nothing. Header rows carry the employee names and the
 * Start/Finish/Hours column groups, so every chunk needs them to be readable on
 * its own.
 */
export function chunkTableText(
  text: string,
  {
    maxChars = 12_000,
    maxDataLines = 40,
    headerLines = 3,
  }: { maxChars?: number; maxDataLines?: number; headerLines?: number } = {},
): string[] {
  const lines = text.split('\n');
  const withinBudget = text.length <= maxChars
    && lines.length - headerLines <= maxDataLines;
  if (withinBudget || lines.length <= headerLines) return text ? [text] : [];

  const header = lines.slice(0, headerLines);
  const headerText = header.join('\n');
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const line of lines.slice(headerLines)) {
    // +1 for the newline; a single line longer than the budget still gets its own
    // chunk rather than being dropped.
    const overChars = currentLength + line.length + 1 > maxChars - headerText.length;
    // A wide matrix row expands into one record per employee, so a chunk that is
    // small in characters can still be a very large extraction. Cap rows too.
    const overRows = current.length >= maxDataLines;
    if ((overChars || overRows) && current.length > 0) {
      chunks.push([...header, ...current].join('\n'));
      current = [];
      currentLength = 0;
    }
    current.push(line);
    currentLength += line.length + 1;
  }
  if (current.length > 0) chunks.push([...header, ...current].join('\n'));
  return chunks;
}

/**
 * Is this a WIDE MATRIX sheet — employees across the columns, days down the rows?
 *
 * Detected by a header row repeating the same label in consecutive columns (real
 * sheets repeat an employee name over their "Start / Finish / Hours" group). It
 * matters because one matrix row expands into one record per employee, so a chunk
 * that looks small produces a very large extraction: measured throughput is about
 * 32 records per call, and a 4-row slice of a 30-employee sheet times out.
 */
export function countMatrixColumnGroups(text: string): number {
  let best = 0;
  for (const row of text.split('\n', 4)) {
    const cells = row.split('\t').map((cell) => cell.trim());
    let runs = 0;
    let run = 1;
    for (let i = 1; i < cells.length; i += 1) {
      if (cells[i] !== '' && cells[i] === cells[i - 1]) {
        run += 1;
        if (run === 2) runs += 1;
      } else {
        run = 1;
      }
    }
    best = Math.max(best, runs);
  }
  return best;
}

export function looksLikeWideMatrix(text: string): boolean {
  return countMatrixColumnGroups(text) >= 3;
}

/** How many chunks one import will send before it stops and says so. */
export const MAX_EXTRACTION_CHUNKS = 12;

/** Records one extraction call comfortably returns (measured, see planExtraction). */
const TARGET_RECORDS_PER_CALL = 30;

export interface ExtractionPlan {
  chunks: string[];
  layout: 'matrix' | 'rows';
  /** Data lines the cap left out — reported to the user, never dropped silently. */
  skippedLines: number;
}

/**
 * Split a sheet into the calls an import will actually make.
 *
 * A wide matrix is chunked into very few rows per call because each row expands
 * per employee. The number of calls is capped: a 30-day matrix for 16 people is
 * roughly 480 records, which is minutes of extraction, so the import covers what
 * it can and reports the remainder instead of appearing to have imported it all.
 */
export function planExtraction(text: string): ExtractionPlan {
  if (!text.trim()) return { chunks: [], layout: 'rows', skippedLines: 0 };
  const groups = countMatrixColumnGroups(text);
  const layout = groups >= 3 ? 'matrix' : 'rows';
  // One matrix row expands into one record per employee. Measured throughput is
  // about 30 records per call (a 2-row slice of a 30-employee sheet took 88s; 4
  // rows exceeded the 180s ceiling), so rows-per-chunk scales inversely with the
  // number of employee column groups rather than being a fixed number.
  const all = layout === 'matrix'
    ? chunkTableText(text, {
      maxDataLines: Math.max(1, Math.floor(TARGET_RECORDS_PER_CALL / groups)),
      maxChars: 12_000,
    })
    : chunkTableText(text);

  const chunks = all.slice(0, MAX_EXTRACTION_CHUNKS);
  const skippedLines = all.slice(MAX_EXTRACTION_CHUNKS)
    .reduce((total, chunk) => total + Math.max(0, chunk.split('\n').length - 3), 0);
  return { chunks, layout, skippedLines };
}

/** Deduplicate merged rows from several chunks on (employee, date, clockIn). */
export function dedupeAttendanceRows<T extends { employee: string; date: string; clockIn: string }>(
  rows: readonly T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = `${row.employee.toLowerCase()}|${row.date}|${row.clockIn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
