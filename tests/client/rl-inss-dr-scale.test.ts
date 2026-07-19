import { describe, expect, it } from 'vitest';
import { buildInssDrWorkbook } from '@/lib/reports/inssDrExcel';
import { roundMoney, sumMoney, subtractMoney } from '@/lib/currency';
import type {
  MonthlyINSSReturn,
  MonthlyINSSEmployeeRecord,
} from '@/types/tax-filing';

/**
 * Real-life scenario: a large employer (e.g. a Dili hotel group) runs the INSS
 * Declaração de Remunerações export for ~200 workers. The generator must emit
 * exactly one worker row per employee, place the 4%/6% contributions in the
 * template's columns, and reconcile the Resumo totals to the row sums — without
 * crashing or truncating at scale.
 *
 * INSS law: employee contributes 4%, employer 6% of the contributable base.
 * We supply already-computed base/INSS figures (this exercises the DR
 * generator, not the payroll engine) and assert the workbook maps them 1:1.
 */

const EMPLOYEE_COUNT = 200;

// Template geometry (must match inssDrExcel.ts COL map / header row).
const HEADER_ROW = 9;
const FIRST_DATA_ROW = HEADER_ROW + 1;
const COL_EMPLOYEE_NO = 4;
const COL_FULL_NAME = 7;
const COL_BASE_SALARY = 21;
const COL_TOTAL_DECLARED = 25;
const COL_EMPLOYER_SS = 27; // 6%
const COL_WORKER_SS = 28; // 4%
const COL_NET_PAY = 29;

function buildReturn(): {
  ret: MonthlyINSSReturn;
  employees: MonthlyINSSEmployeeRecord[];
} {
  const employees: MonthlyINSSEmployeeRecord[] = [];
  for (let i = 0; i < EMPLOYEE_COUNT; i++) {
    // Synthetic, invented figures. Vary base salary $150.00–$644.50 so some
    // residents cross the $500 WIT threshold and cents differ across rows.
    const base = roundMoney(150 + (i % 100) * 4.945);
    const employeeContribution = roundMoney(base * 0.04);
    const employerContribution = roundMoney(base * 0.06);
    const incomeTax =
      i % 2 === 0 && base > 500 ? roundMoney((base - 500) * 0.1) : 0;
    const netPay = subtractMoney(base, employeeContribution, incomeTax);
    employees.push({
      employeeId: `EMP-${String(i + 1).padStart(4, '0')}`,
      fullName: `Trabalhador Sintetiku ${i + 1}`,
      inssNumber: `NISS${100000 + i}`,
      contributionBase: base,
      employeeContribution,
      employerContribution,
      totalContribution: roundMoney(
        employeeContribution + employerContribution,
      ),
      grossWages: base,
      annualSubsidy: 0,
      incomeTax,
      netPay,
      isResident: i % 5 !== 0, // ~40 non-residents
    });
  }

  const ret: MonthlyINSSReturn = {
    employerTIN: '1234567',
    employerName: 'Hotel Sintetiku Lda',
    employerAddress: 'Rua Sintetiku, Dili',
    reportingPeriod: '2026-06',
    periodStartDate: '2026-06-01',
    periodEndDate: '2026-06-30',
    totalEmployees: employees.length,
    totalContributionBase: sumMoney(employees.map((e) => e.contributionBase)),
    totalEmployeeContributions: sumMoney(
      employees.map((e) => e.employeeContribution),
    ),
    totalEmployerContributions: sumMoney(
      employees.map((e) => e.employerContribution),
    ),
    totalContributions: sumMoney(employees.map((e) => e.totalContribution)),
    employees,
  };
  return { ret, employees };
}

describe('INSS DR export at scale (rl-inss-dr-scale)', () => {
  const { ret, employees } = buildReturn();
  const wb = buildInssDrWorkbook(ret);
  const ws = wb.getWorksheet('DR')!;

  it('emits exactly one worker row per employee — no truncation at scale', () => {
    // Last data row must be present and populated; no overflow beyond it.
    const lastRow = FIRST_DATA_ROW + EMPLOYEE_COUNT - 1;
    expect(ws.getCell(lastRow, COL_EMPLOYEE_NO).value).toBe(
      employees[EMPLOYEE_COUNT - 1].employeeId,
    );
    expect(ws.getCell(lastRow + 1, COL_EMPLOYEE_NO).value).toBeFalsy();
    expect(ws.getCell(lastRow, COL_FULL_NAME).value).toBe(
      employees[EMPLOYEE_COUNT - 1].fullName,
    );
  });

  it('places correct 4%/6% contributions and money columns on every row', () => {
    for (let i = 0; i < EMPLOYEE_COUNT; i++) {
      const r = FIRST_DATA_ROW + i;
      const emp = employees[i];
      expect(ws.getCell(r, COL_EMPLOYEE_NO).value).toBe(emp.employeeId);
      expect(ws.getCell(r, COL_WORKER_SS).value).toBeCloseTo(
        emp.employeeContribution,
        2,
      );
      expect(ws.getCell(r, COL_EMPLOYER_SS).value).toBeCloseTo(
        emp.employerContribution,
        2,
      );
      expect(ws.getCell(r, COL_TOTAL_DECLARED).value).toBeCloseTo(
        emp.grossWages,
        2,
      );
      // annualSubsidy is 0 -> base salary column equals gross.
      expect(ws.getCell(r, COL_BASE_SALARY).value).toBeCloseTo(
        emp.grossWages,
        2,
      );
      expect(ws.getCell(r, COL_NET_PAY).value).toBeCloseTo(emp.netPay, 2);
    }
  });

  it('reconciles Resumo totals to the sum of the emitted rows', () => {
    // Independently sum the money columns straight off the DR sheet.
    const rowWorker: number[] = [];
    const rowEmployer: number[] = [];
    for (let i = 0; i < EMPLOYEE_COUNT; i++) {
      const r = FIRST_DATA_ROW + i;
      rowWorker.push(Number(ws.getCell(r, COL_WORKER_SS).value));
      rowEmployer.push(Number(ws.getCell(r, COL_EMPLOYER_SS).value));
    }
    const summedWorker = sumMoney(rowWorker);
    const summedEmployer = sumMoney(rowEmployer);

    const resumo = wb.getWorksheet('Resumo')!;
    // summaryRows: index 3 employees(row6), 5 worker(row8), 6 employer(row9), 7 total(row10)
    expect(Number(resumo.getCell(6, 4).value)).toBe(EMPLOYEE_COUNT);
    const resumoWorker = Number(resumo.getCell(8, 4).value);
    const resumoEmployer = Number(resumo.getCell(9, 4).value);
    const resumoTotal = Number(resumo.getCell(10, 4).value);

    expect(Math.abs(resumoWorker - summedWorker)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(resumoEmployer - summedEmployer)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(resumoTotal - (summedWorker + summedEmployer)))
      .toBeLessThanOrEqual(0.02);
    // Resumo totals must equal the declared return totals too.
    expect(resumoWorker).toBe(ret.totalEmployeeContributions);
    expect(resumoEmployer).toBe(ret.totalEmployerContributions);
  });
});
