import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generateATTLExcel } from "@/lib/excel/attlExport";
import type { MonthlyWITReturn } from "@/types/tax-filing";

const monthlyReturn: MonthlyWITReturn = {
  employerTIN: "0000000",
  employerName: "Synthetic Business",
  employerAddress: "Timor-Leste",
  reportingPeriod: "2026-06",
  periodStartDate: "2026-06-01",
  periodEndDate: "2026-06-30",
  totalEmployees: 0,
  totalResidentEmployees: 0,
  totalNonResidentEmployees: 0,
  totalGrossWages: 0,
  totalTaxableWages: 0,
  totalWITWithheld: 0,
  employees: [],
};

async function formSheet(blob: Blob): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook.getWorksheet("Monthly Tax Form")!;
}

function findRow(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Row {
  let row: ExcelJS.Row | undefined;
  sheet.eachRow((candidate) => {
    if ((candidate.values as unknown[]).includes(label)) row = candidate;
  });
  if (!row) throw new Error(`Missing row: ${label}`);
  return row;
}

describe("ATTL consolidated monthly tax workbook", () => {
  it("uses the current 4.5% mining rate and whole-dollar form values", async () => {
    const sheet = await formSheet(
      await generateATTLExcel(monthlyReturn, undefined, {
        miningServices: { payment: 1_000.49, tax: 45.49 },
      }),
    );
    const row = findRow(sheet, "Mining and mining support services");
    expect(row.getCell(3).value).toBe(1_000);
    expect(row.getCell(4).value).toBe("4.5%");
    expect(row.getCell(5).value).toBe(45);
  });

  it("shows the frozen treaty rate instead of the statutory default label", async () => {
    const sheet = await formSheet(
      await generateATTLExcel(monthlyReturn, undefined, {
        nonResidentPayments: { payment: 1_000, tax: 50, rateLabel: "5%" },
      }),
    );
    const row = findRow(sheet, "Non-resident without permanent establishment");
    expect(row.getCell(3).value).toBe(1_000);
    expect(row.getCell(4).value).toBe("5%");
    expect(row.getCell(5).value).toBe(50);
  });

  it("does not put services tax on sub-$500 designated receipts", async () => {
    const sheet = await formSheet(
      await generateATTLExcel(monthlyReturn, undefined, {
        hotelServices: 499.99,
      }),
    );
    expect(findRow(sheet, "Services Tax Payable").getCell(5).value).toBe("");
  });

  it("puts 5% of all designated receipts on the form at the $500 boundary", async () => {
    const sheet = await formSheet(
      await generateATTLExcel(monthlyReturn, undefined, {
        hotelServices: 300,
        restaurantBarServices: 150,
        telecomServices: 50,
      }),
    );
    expect(findRow(sheet, "Services Tax Payable").getCell(5).value).toBe(25);
  });
});
