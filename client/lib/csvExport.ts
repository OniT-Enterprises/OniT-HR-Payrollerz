import Papa from "papaparse";
import { getTodayTL } from "@/lib/dateUtils";
import { downloadBlob } from "@/lib/downloadBlob";

interface CsvColumn {
  key: string;
  label: string;
}

/**
 * Neutralise spreadsheet formula injection in one cell.
 *
 * Excel and LibreOffice evaluate a CSV cell that begins with `=`, `+`, `@`, or a
 * tab/CR as a formula on open, which turns an exported report into code the
 * recipient runs. The text in these exports is not all typed by the exporter:
 * a vendor name read off an uploaded supplier invoice reaches a journal line as
 * `Payment to <name>` (client/lib/accounting/calculations.ts), so a hostile PDF
 * can reach an accountant's spreadsheet. Prefixing an apostrophe forces the cell
 * to text — the value still reads correctly to a human.
 *
 * A leading `-` is only guarded when the value is not a plain negative number,
 * so `-472.00` exports unchanged while `-2+cmd|…` does not.
 *
 * Only the FIRST character is examined, and the value is never otherwise
 * rewritten. `Payment to =X` is inert text to a spreadsheet, and a description
 * legitimately containing commas, quotes or newlines round-trips inside a quoted
 * field — rewriting those would corrupt real data (see csv-export.test.ts).
 */
export function sanitizeCsvCell(value: unknown): unknown {
  if (typeof value !== 'string' || value === '') return value;
  const isNegativeNumber = /^-\d/.test(value) && Number.isFinite(Number(value));
  // A leading tab or CR counts: spreadsheets skip it and evaluate what follows.
  const startsDangerous = /^[=+@\t\r]/.test(value) || (value.startsWith('-') && !isNegativeNumber);
  return startsDangerous ? `'${value}` : value;
}

/** Build an RFC-compatible CSV string (quotes, commas and newlines included). */
export function buildCSV(headers: string[], rows: unknown[][]): string {
  return Papa.unparse({
    fields: headers.map((header) => sanitizeCsvCell(header)) as string[],
    data: rows.map((row) => row.map(sanitizeCsvCell)),
  });
}

/** Download tabular rows as an Excel-friendly UTF-8 CSV. */
export function downloadCSVRows(
  filename: string,
  headers: string[],
  rows: unknown[][],
): void {
  const blob = new Blob(["\uFEFF" + buildCSV(headers, rows)], {
    type: "text/csv;charset=utf-8;",
  });
  downloadBlob(blob, filename);
}

/**
 * Export data to a properly-formatted CSV file using papaparse.
 * Handles quoting, escaping, commas in values, and BOM for Excel compatibility.
 */
function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns: CsvColumn[]
): void {
  const rows = data.map((item) =>
    columns.reduce((row, col) => {
      let value: unknown = col.key.split(".").reduce<unknown>((obj, key) => {
        if (obj != null && typeof obj === 'object') return (obj as Record<string, unknown>)[key];
        return undefined;
      }, item);
      // Convert Firestore Timestamps
      if (value != null && typeof value === 'object' && 'toDate' in value) {
        value = (value as { toDate: () => Date }).toDate().toISOString();
      }
      row[col.label] = sanitizeCsvCell(value ?? "");
      return row;
    }, {} as Record<string, unknown>)
  );

  const csv = Papa.unparse(rows, {
    columns: columns.map((c) => c.label),
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}_${getTodayTL()}.csv`);
}

export { exportToCSV };
