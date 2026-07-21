import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { buildCSV } from "@/lib/csvExport";

describe("CSV export", () => {
  it("round-trips commas, quotes and newlines", () => {
    const csv = buildCSV(
      ["Project", "Description", "Amount"],
      [["Health, East", 'Donor "A"\nPhase 2', "10.25"]],
    );
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.errors).toEqual([]);
    expect(parsed.data[0]).toEqual({
      Project: "Health, East",
      Description: 'Donor "A"\nPhase 2',
      Amount: "10.25",
    });
  });
});
