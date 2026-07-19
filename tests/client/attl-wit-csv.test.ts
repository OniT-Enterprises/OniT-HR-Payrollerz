import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Papa from "papaparse";

const source = readFileSync(
  join(process.cwd(), "client/pages/reports/ATTLMonthlyWIT.tsx"),
  "utf8",
);

describe("ATTL monthly WIT CSV export", () => {
  it("escapes fields via papaparse instead of a raw comma join", () => {
    expect(source).toContain('import Papa from "papaparse"');
    expect(source).toContain("Papa.unparse(");
    // The vulnerable pattern that concatenated fields with no quoting.
    expect(source).not.toContain('rows.map((row) => row.join(","))');
    expect(source).not.toContain('headers.join(",")');
  });

  it("keeps a comma, quote, or newline in a name from corrupting the CSV", () => {
    // Mirrors the ragged shape the page builds: single-column header info lines,
    // a blank line, the column headers, then employee rows.
    const headers = ["employeeId", "fullName", "witWithheld"];
    const rows = [
      ["E1", 'Silva, Maria "MJ"', "50.00"],
      ["E2", "Line\nBreak Name", "200.00"],
    ];
    const csv = Papa.unparse(
      [
        ["Employer: Acme, Inc"],
        ["TIN: 123"],
        ["Period: 2026-06"],
        [],
        headers,
        ...rows,
      ],
      { newline: "\n" },
    );

    // Round-tripping recovers the original fields intact — the comma-containing
    // name stays a single field rather than splitting into two columns.
    const parsed = Papa.parse<string[]>(csv).data;
    const table = parsed.slice(4); // skip 3 info lines + blank line
    expect(table[0]).toEqual(headers);
    expect(table[1]).toEqual(["E1", 'Silva, Maria "MJ"', "50.00"]);
    expect(table[2]).toEqual(["E2", "Line\nBreak Name", "200.00"]);
  });
});
