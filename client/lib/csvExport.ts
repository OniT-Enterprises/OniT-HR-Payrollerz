import Papa from "papaparse";
import { getTodayTL } from "@/lib/dateUtils";
import { downloadBlob } from "@/lib/downloadBlob";

interface CsvColumn {
  key: string;
  label: string;
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
      row[col.label] = value ?? "";
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
export type { CsvColumn };
