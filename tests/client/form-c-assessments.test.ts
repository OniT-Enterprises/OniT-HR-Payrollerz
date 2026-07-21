/**
 * GOLDEN TESTS against real ATTL output: two official "Aviso de Avaliação"
 * assessment notices for e-filed 2024 annual income tax returns (companies,
 * de-identified — the source documents live in the gitignored mail corpus,
 * mining/form-c-jul21/). The engine must reproduce every assessed line to
 * the cent from the same submitted inputs.
 *
 * These pin two facts about how ATTL actually assesses:
 * - every line keeps cents (no whole-dollar coercion), and
 * - tax = 10% computed to the cent, half-up (165,819.68 → 16,581.97;
 *   12,880.65 → 1,288.07) — NOT the paper form's floor-to-dollar note.
 */
import { describe, expect, it } from "vitest";
import {
  buildFormCWorkpaper,
  EMPTY_FORM_C_MANUAL_INPUTS,
  type FormCGlRow,
} from "@/lib/tax/form-c";

const gl = (
  accountCode: string,
  accountName: string,
  accountType: "revenue" | "expense",
  amount: number,
): FormCGlRow => ({ accountCode, accountName, accountType, amount });

describe("ATTL Aviso de Avaliação — company A, 2024 (e-filed, assessed 2025)", () => {
  // Submitted: line 05 = 223,096.67; 60 = 246.01; 110 = 57,030.98;
  // instalments (175) = 1,115.49. Assessed: 135 = 57,276.99;
  // 140/150/160 = 165,819.68; 165 = 16,581.97; 215 = 1,115.49; 220 = 15,466.48.
  const workpaper = buildFormCWorkpaper({
    taxYear: 2024,
    glRows: [
      gl("4100", "Service Revenue", "revenue", 223096.67),
      gl("5525", "Building Repairs and Maintenance", "expense", 246.01),
      gl("5900", "Other Expenses", "expense", 57030.98),
    ],
    assets: [],
    manual: { ...EMPTY_FORM_C_MANUAL_INPUTS, installmentsPaid: 1115.49 },
  });

  it("reproduces every assessed line to the cent", () => {
    const line = (code: string) =>
      workpaper.lines.find((entry) => entry.line === code)?.amount;
    expect(line("05")).toBe(223096.67);
    expect(line("60")).toBe(246.01);
    expect(line("110")).toBe(57030.98);
    expect(workpaper.totals.totalExpenses).toBe(57276.99); // 135
    expect(workpaper.totals.netIncome).toBe(165819.68); // 140
    expect(workpaper.totals.taxableIncome).toBe(165819.68); // 150
    expect(workpaper.totals.incomeSubjectToTax).toBe(165819.68); // 160
    expect(workpaper.totals.tax).toBe(16581.97); // 165 — cent, half-up
    expect(workpaper.totals.totalCredits).toBe(1115.49); // 215
    expect(workpaper.totals.taxOwing).toBe(15466.48); // 220
    expect(workpaper.totals.overpaid).toBe(false);
  });
});

describe("ATTL Aviso de Avaliação — company B, 2024 (e-filed, assessed 2025)", () => {
  // Submitted: line 05 = 102,650.00; 25 bad debts = 51,600.00; 50 rent =
  // 5,622.22; 55 vehicles = 1,707.92; 110 = 30,839.21; instalments = 510.75.
  // Assessed: 135 = 89,769.35; 140/150/160 = 12,880.65; 165 = 1,288.07;
  // 215 = 510.75; 220 = 777.32.
  const workpaper = buildFormCWorkpaper({
    taxYear: 2024,
    glRows: [
      gl("4100", "Service Revenue", "revenue", 102650.0),
      gl("5905", "Bad Debts Written Off", "expense", 51600.0),
      gl("5200", "Rent Expense", "expense", 5622.22),
      gl("5500", "Transportation Expense", "expense", 1707.92),
      gl("5900", "Other Expenses", "expense", 30839.21),
    ],
    assets: [],
    manual: { ...EMPTY_FORM_C_MANUAL_INPUTS, installmentsPaid: 510.75 },
  });

  it("reproduces every assessed line to the cent", () => {
    const line = (code: string) =>
      workpaper.lines.find((entry) => entry.line === code)?.amount;
    expect(line("05")).toBe(102650.0);
    expect(line("25")).toBe(51600.0);
    expect(line("50")).toBe(5622.22);
    expect(line("55")).toBe(1707.92);
    expect(line("110")).toBe(30839.21);
    expect(workpaper.totals.totalExpenses).toBe(89769.35); // 135
    expect(workpaper.totals.netIncome).toBe(12880.65); // 140
    expect(workpaper.totals.taxableIncome).toBe(12880.65); // 150
    expect(workpaper.totals.tax).toBe(1288.07); // 165 — 1,288.065 half-up
    expect(workpaper.totals.totalCredits).toBe(510.75); // 215
    expect(workpaper.totals.taxOwing).toBe(777.32); // 220
  });
});
