/**
 * INSS DR export — conformance to the OFFICIAL government template.
 *
 * The DR (declaração de remunerações) is uploaded to the INSS employer portal
 * as an .xlsx, so our export must land each value in the exact column position
 * of the official template `DR_global_VF.xlsx` (segurancasocial.gov.tl →
 * Formulários; direct file api.segurancasocial.gov.tl/uploads/DR_global_VF_*.xlsx).
 * Verified against that official blank template (NOT any firm's filed instance —
 * filed client workbooks can use older/variant templates and must never be the
 * source of truth). This test locks the column layout so it can't silently
 * drift (or get "corrected" toward a non-official layout).
 *
 * Official worker-row columns (section 5, "TODOS OS TRABALHADORES ATIVOS"):
 *   3 N.º Payroll · 5 TIN · 6 NISS · 7 Nome · 8 Situação Laboral ·
 *   14 Residente em TL? · 15 Desconta para SS · 17 Dias Contrato ·
 *   18 Faltas Injustificadas · 19 Dias parentalidade · 21 Salário base ·
 *   25 Valor Total declarado · 26 10% Imposto · 27 6% Contribuição EE SS ·
 *   28 4% Contribuição Trabalhador SS · 29 Valor Líquido a pagar
 *
 * Synthetic data only — no corpus/client figures.
 */
import { describe, expect, it } from 'vitest';
import { buildMonthlyINSSReturn, type TaxablePayrollRecord, type StatutoryEmployeeMaster } from '@/lib/tax/statutory-returns';
import { requireStatutoryEmployerIdentity } from '@/lib/tax/statutory-payroll-record';
import { buildInssDrWorkbook } from '@/lib/reports/inssDrExcel';

// Official DR_global_VF worker-row column positions.
const COL = {
  payrollNo: 3, niss: 6, name: 7, resident: 14, dias: 17,
  salarioBase: 21, valorTotal: 25, imposto10: 26, ss6: 27, ss4: 28, liquido: 29,
} as const;

// Two synthetic workers: a resident below the $500 WIT threshold (WIT 0) and a
// non-resident (flat 10%). Values chosen so every column is non-trivial.
function record(id: string, base: number, resident: boolean): TaxablePayrollRecord {
  const wit = resident ? Math.max(0, (base - 500) * 0.1) : base * 0.1;
  const ss4 = Math.round(base * 4) / 100;
  const ss6 = Math.round(base * 6) / 100;
  return {
    employeeId: id, grossWages: base, wagesPaid: base, taxableIncome: base,
    witTaxableAmount: resident ? Math.max(0, base - 500) : base,
    inssBase: base, contributionBase: base, annualSubsidy: 0,
    incomeTax: wit, inssEmployee: ss4, inssEmployer: ss6,
    netPay: Math.round((base - wit - ss4) * 100) / 100, isResident: resident,
    earnings: [{ type: 'regular', amount: base }], deductions: [], hourlyRate: base / 240,
  };
}
function master(id: string): StatutoryEmployeeMaster {
  return { id, personalInfo: { firstName: 'Test', lastName: id }, documents: { socialSecurityNumber: { number: `NISS-${id}` } }, jobDetails: { hireDate: '2019-01-01' }, status: 'active' };
}

const employer = requireStatutoryEmployerIdentity({ tinNumber: 'TIN-TEST', legalName: 'Test Co', registeredAddress: 'Dili' });
const records = [record('W-RES', 300, true), record('W-NONRES', 600, false)];
const ret = buildMonthlyINSSReturn(records, records.map((r) => master(r.employeeId!)), new Map(), employer, '2026-06');
const ws = buildInssDrWorkbook(ret).getWorksheet('DR')!;

// Locate each worker's data row by the payroll-number/name column.
function rowFor(id: string): number {
  for (let r = 1; r <= 60; r++) {
    for (const c of [COL.payrollNo, 4, COL.name]) {
      if (String(ws.getCell(r, c).value ?? '').includes(id)) return r;
    }
  }
  throw new Error(`no DR row for ${id}`);
}

describe('INSS DR export conforms to the official DR_global_VF template', () => {
  it('worker-row headers sit in the official column positions', () => {
    // Assert our export carries the official labels at the official columns
    // (scan the header band; our export's header row may differ from the
    // official template's row offset — only the COLUMN positions must match).
    const headerText = (col: number) =>
      Array.from({ length: 17 }, (_, i) => String(ws.getCell(i + 1, col).value ?? '')).join(' ');
    expect(headerText(COL.salarioBase)).toMatch(/Salário base|Remunera/i);
    expect(headerText(COL.valorTotal)).toMatch(/Valor Total/i);
    expect(headerText(COL.imposto10)).toMatch(/10%/);
    expect(headerText(COL.ss6)).toMatch(/6%/);
    expect(headerText(COL.ss4)).toMatch(/4%/);
    expect(headerText(COL.liquido)).toMatch(/Líquido/i);
  });

  it('resident (base 300, below $500): base/total/6%/4%/net in the right cells, 10% = 0', () => {
    const r = rowFor('W-RES');
    expect(ws.getCell(r, COL.salarioBase).value).toBe(300);
    expect(ws.getCell(r, COL.valorTotal).value).toBe(300);
    expect(ws.getCell(r, COL.imposto10).value).toBe(0);
    expect(ws.getCell(r, COL.ss6).value).toBe(18);
    expect(ws.getCell(r, COL.ss4).value).toBe(12);
    expect(ws.getCell(r, COL.liquido).value).toBe(288);
    expect(String(ws.getCell(r, COL.resident).value)).toMatch(/Sim/);
  });

  it('non-resident (base 600): flat 10% WIT = 60 in the 10%-Imposto column', () => {
    const r = rowFor('W-NONRES');
    expect(ws.getCell(r, COL.salarioBase).value).toBe(600);
    expect(ws.getCell(r, COL.imposto10).value).toBe(60);
    expect(ws.getCell(r, COL.ss6).value).toBe(36);
    expect(ws.getCell(r, COL.ss4).value).toBe(24);
    expect(ws.getCell(r, COL.liquido).value).toBe(516);
    expect(String(ws.getCell(r, COL.resident).value)).toMatch(/Não/);
  });
});
