import { describe, expect, it } from 'vitest';
import { buildInssDrWorkbook } from '@/lib/reports/inssDrExcel';
import type { MonthlyINSSReturn } from '@/types/tax-filing';

const ret: MonthlyINSSReturn = {
  employerTIN: '1234567',
  employerName: 'Onit Enterprises',
  employerAddress: 'Dili',
  reportingPeriod: '2026-06',
  periodStartDate: '2026-06-01',
  periodEndDate: '2026-06-30',
  totalEmployees: 2,
  totalContributionBase: 1500,
  totalEmployeeContributions: 60,
  totalEmployerContributions: 90,
  totalContributions: 150,
  employees: [
    {
      employeeId: 'EMP-1',
      fullName: 'Maria da Silva',
      inssNumber: 'NISS001',
      contributionBase: 1000,
      employeeContribution: 40,
      employerContribution: 60,
      totalContribution: 100,
      grossWages: 1000,
      annualSubsidy: 100,
      incomeTax: 50,
      netPay: 910,
      isResident: true,
    },
    {
      employeeId: 'EMP-2',
      fullName: 'John Foreigner',
      contributionBase: 500,
      employeeContribution: 20,
      employerContribution: 30,
      totalContribution: 50,
      grossWages: 500,
      annualSubsidy: 0,
      incomeTax: 0,
      netPay: 480,
      isResident: false,
    },
  ],
};

describe('INSS DR Excel export', () => {
  it('lays out employer block, per-worker rows, and totals in template positions', () => {
    const wb = buildInssDrWorkbook(ret, { employerNISS: 'EE-NISS-9' });
    const dr = wb.getWorksheet('DR')!;

    expect(dr.getCell('C4').value).toBe('Onit Enterprises');
    expect(dr.getCell('C5').value).toBe('1234567');
    expect(dr.getCell('C6').value).toBe('EE-NISS-9');
    expect(dr.getCell('G5').value).toBe(2026);
    expect(dr.getCell('G6').value).toBe('Junho');

    // Worker rows start at row 10 (header row 9)
    const first = dr.getRow(10);
    expect(first.getCell(7).value).toBe('Maria da Silva');
    expect(first.getCell(6).value).toBe('NISS001');
    expect(first.getCell(8).value).toBe('Contratado nacional');
    expect(first.getCell(14).value).toBe('Sim');
    expect(first.getCell(21).value).toBe(900); // base = gross − 13th
    expect(first.getCell(22).value).toBe(100); // subsídio anual
    expect(first.getCell(25).value).toBe(1000); // total declared
    expect(first.getCell(26).value).toBe(50); // 10% imposto
    expect(first.getCell(27).value).toBe(60); // 6% EE
    expect(first.getCell(28).value).toBe(40); // 4% worker
    expect(first.getCell(29).value).toBe(910); // líquido

    // Second worker: explicitly stored zero-tax values, foreign
    const second = dr.getRow(11);
    expect(second.getCell(8).value).toBe('Contratado estrangeiro');
    expect(second.getCell(14).value).toBe('Não');
    expect(second.getCell(25).value).toBe(500);
    expect(second.getCell(29).value).toBe(480); // 500 − 0 tax − 20 INSS

    const resumo = wb.getWorksheet('Resumo')!;
    expect(resumo.getCell('D10').value).toBe(150); // total contributions row
  });

  it('refuses a legacy snapshot with missing DR source values', () => {
    const incomplete = {
      ...ret,
      employees: [
        {
          employeeId: 'EMP-3',
          fullName: 'Incomplete Record',
          contributionBase: 500,
          employeeContribution: 20,
          employerContribution: 30,
          totalContribution: 50,
        },
      ],
    } as MonthlyINSSReturn;

    expect(() => buildInssDrWorkbook(incomplete)).toThrow(/will not infer compliance values/);
  });
});
