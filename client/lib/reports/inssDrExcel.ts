/**
 * INSS Declaração de Remunerações (DR) Excel export.
 *
 * PROVENANCE: the worker-row column layout mirrors ONLY the official INSS
 * portal template (DR_global_VF.xlsx, published at segurancasocial.gov.tl →
 * Formulários). It is deliberately NOT modeled on any client or accounting
 * firm's internal workbook — matching the government's own template is a
 * compliance requirement (portal upload), matching anyone else's would be
 * copying. Everything outside the official column grid (the Resumo sheet,
 * attribution) is Xefe's own presentation.
 *
 * Mirrors the column layout of the official INSS template: employer
 * identification block, reference period, then one row per worker in the
 * template's column positions (3–29). Public-function-only columns
 * (Cargo/Categoria/Grau/Escalão/Carreira) are left blank for private-sector
 * employers. Since 1 Jan 2026 INSS only accepts declarations through its
 * employer portal — this file gives users the numbers in the portal's own
 * shape for upload or transcription.
 *
 * Import this module dynamically (`await import(...)`) — exceljs is heavy
 * and must stay out of the main bundle.
 */

import ExcelJS from 'exceljs';
import type { MonthlyINSSReturn } from '@/types/tax-filing';
import { subtractMoney } from '@/lib/currency';
import {
  MissingStatutoryPayrollDataError,
  requireStatutoryPayrollAmount,
  requireStatutoryPayrollEmployeeId,
  requireStatutoryPayrollResidency,
  withStatutoryEmployeeContext,
} from '@/lib/tax/statutory-payroll-record';

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONEY_FMT = '#,##0.00';

// Table column positions in the official template (sheet "DR").
const COL = {
  payrollNo: 3,
  employeeNo: 4,
  tin: 5,
  niss: 6,
  fullName: 7,
  laborSituation: 8,
  // 9–13: public-function career fields (left blank)
  resident: 14,
  contributesSS: 15,
  ssInfo: 16,
  contractDays: 17,
  unjustifiedAbsences: 18,
  parentalLeaveDays: 19,
  careerDays: 20,
  baseSalary: 21,
  annualSubsidy: 22,
  regimeSupplements: 23,
  otherSupplements: 24,
  totalDeclared: 25,
  incomeTax: 26,
  employerSS: 27,
  workerSS: 28,
  netPay: 29,
} as const;

const HEADER_LABELS: Array<[number, string]> = [
  [COL.payrollNo, 'N.º Payroll'],
  [COL.employeeNo, 'N.º Funcionário'],
  [COL.tin, 'N° Identificação Fiscal (TIN)'],
  [COL.niss, 'N° Identificação da Segurança Social (NISS)'],
  [COL.fullName, 'Nome completo do trabalhador'],
  [COL.laborSituation, 'Situação Laboral'],
  [9, 'Cargo Direção ou Chefia'],
  [10, 'Categoria'],
  [11, 'Grau'],
  [12, 'Escalão'],
  [13, 'Informação no caso de CARREIRA ESPECIAL'],
  [COL.resident, 'Residente em Timor-Leste?'],
  [COL.contributesSS, 'Desconta para a Segurança Social em Timor-Leste?'],
  [COL.ssInfo, 'Informação considerada pela Segurança Social'],
  [COL.contractDays, 'Dias Contrato (mensal)'],
  [COL.unjustifiedAbsences, 'Faltas Injustificadas declaradas'],
  [COL.parentalLeaveDays, 'Dias Falta por parentalidade'],
  [COL.careerDays, 'Dias Carreira considerados pela Segurança Social'],
  [COL.baseSalary, 'Salário base'],
  [COL.annualSubsidy, 'Subsídio anual (13.º mês)'],
  [COL.regimeSupplements, 'Suplementos remuneratórios previstos em regimes especiais'],
  [COL.otherSupplements, 'Outros suplementos e remunerações'],
  [COL.totalDeclared, 'Valor Total declarado'],
  [COL.incomeTax, '10% Imposto'],
  [COL.employerSS, '6% Contribuição EE SS'],
  [COL.workerSS, '4% Contribuição Trabalhador SS'],
  [COL.netPay, 'Valor Líquido a pagar ao trabalhador'],
];

export interface InssDrExportOptions {
  /** Employer NISS — not part of MonthlyINSSReturn; pass when known. */
  employerNISS?: string;
}

export function buildInssDrWorkbook(ret: MonthlyINSSReturn, options: InssDrExportOptions = {}): ExcelJS.Workbook {
  const [yearStr, monthStr] = ret.reportingPeriod.split('-');
  const monthName = MONTHS_PT[Number(monthStr) - 1] || monthStr;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Xefe';

  // ---------- Sheet 1: DR ----------
  const ws = wb.addWorksheet('DR');

  ws.getCell('B1').value = 'DECLARAÇÃO DE REMUNERAÇÕES';
  ws.getCell('B1').font = { bold: true, size: 14 };

  ws.getCell('B3').value = 'Identificação da Entidade Empregadora';
  ws.getCell('B3').font = { bold: true };
  ws.getCell('B4').value = 'Nome';
  ws.getCell('C4').value = ret.employerName;
  ws.getCell('B5').value = 'N° Identificação Fiscal (TIN)';
  ws.getCell('C5').value = ret.employerTIN;
  ws.getCell('B6').value = 'N° Identificação da Segurança Social (NISS)';
  ws.getCell('C6').value = options.employerNISS || '';

  ws.getCell('F4').value = 'Data de Referência';
  ws.getCell('F4').font = { bold: true };
  ws.getCell('F5').value = 'Ano';
  ws.getCell('G5').value = Number(yearStr);
  ws.getCell('F6').value = 'Mês';
  ws.getCell('G6').value = monthName;

  const headerRowIdx = 9;
  const headerRow = ws.getRow(headerRowIdx);
  for (const [col, label] of HEADER_LABELS) {
    const cell = headerRow.getCell(col);
    cell.value = label;
    cell.font = { bold: true, size: 9 };
    cell.alignment = {
      wrapText: true,
      vertical: 'middle',
      horizontal: 'center',
    };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EDF5' },
    };
  }
  headerRow.height = 48;

  let rowIdx = headerRowIdx + 1;
  for (const emp of ret.employees) {
    const row = ws.getRow(rowIdx);
    const empLabel = emp.fullName || emp.employeeId;
    // The declared-base columns MUST come from the INSS contribution base the
    // 4%/6% were actually levied on — NOT grossWages, which includes cash
    // earnings excluded from the base by DL 20/2017 Art. 9 (per diem, food/
    // transport allowances, overtime). Using gross made the per-row declared
    // total diverge from the contribution columns and from the Resumo sheet.
    const { employeeId, contributionBase, annualSubsidy, incomeTax, netPay, isResident } =
      withStatutoryEmployeeContext(empLabel, () => {
        const base = requireStatutoryPayrollAmount(emp, 'contributionBase');
        // Subsídio anual is contributable (isINSSBase), so it is a slice of
        // the base — it can never exceed it on a well-formed record.
        const sub = requireStatutoryPayrollAmount(emp, 'annualSubsidy');
        if (sub > base) {
          throw new MissingStatutoryPayrollDataError('annualSubsidy not exceeding the INSS contribution base');
        }
        return {
          employeeId: requireStatutoryPayrollEmployeeId(emp),
          contributionBase: base,
          annualSubsidy: sub,
          incomeTax: requireStatutoryPayrollAmount(emp, 'incomeTax'),
          netPay: requireStatutoryPayrollAmount(emp, 'netPay'),
          isResident: requireStatutoryPayrollResidency(emp),
        };
      });

    row.getCell(COL.employeeNo).value = employeeId;
    // Worker NIF/TIN — Xefe's employee master has no TIN field yet, so this is
    // blank unless a backfilled snapshot carries one.
    row.getCell(COL.tin).value = emp.tinNumber || '';
    row.getCell(COL.niss).value = emp.inssNumber || '';
    row.getCell(COL.fullName).value = emp.fullName;
    row.getCell(COL.laborSituation).value = isResident ? 'Contratado nacional' : 'Contratado estrangeiro';
    row.getCell(COL.resident).value = isResident ? 'Sim' : 'Não';
    row.getCell(COL.contributesSS).value = 'Sim';
    // DL 20/2017 Art. 12: declare the DAYS the remuneration covers — 30 only
    // when the contract spans the whole month (SS convention), prorated for a
    // mid-month hire/termination. Legacy snapshots without the computed value
    // keep the previous full-month behavior.
    row.getCell(COL.contractDays).value =
      typeof emp.contractDays === 'number' && Number.isFinite(emp.contractDays) ? emp.contractDays : 30;
    // Faltas Injustificadas declaradas / Dias Falta por parentalidade — a
    // written 0 is a declaration of "no absences"; legacy snapshots without
    // the fields leave the cells blank (unknown, not zero).
    if (typeof emp.unjustifiedAbsenceDays === 'number' && Number.isFinite(emp.unjustifiedAbsenceDays)) {
      row.getCell(COL.unjustifiedAbsences).value = emp.unjustifiedAbsenceDays;
    }
    if (typeof emp.parentalLeaveDays === 'number' && Number.isFinite(emp.parentalLeaveDays)) {
      row.getCell(COL.parentalLeaveDays).value = emp.parentalLeaveDays;
    }
    row.getCell(COL.baseSalary).value = subtractMoney(contributionBase, annualSubsidy);
    if (annualSubsidy > 0) row.getCell(COL.annualSubsidy).value = annualSubsidy;
    row.getCell(COL.totalDeclared).value = contributionBase;
    row.getCell(COL.incomeTax).value = incomeTax;
    row.getCell(COL.employerSS).value = emp.employerContribution;
    row.getCell(COL.workerSS).value = emp.employeeContribution;
    row.getCell(COL.netPay).value = netPay;

    for (const col of [
      COL.baseSalary,
      COL.annualSubsidy,
      COL.regimeSupplements,
      COL.otherSupplements,
      COL.totalDeclared,
      COL.incomeTax,
      COL.employerSS,
      COL.workerSS,
      COL.netPay,
    ]) {
      row.getCell(col).numFmt = MONEY_FMT;
    }
    rowIdx += 1;
  }

  ws.getColumn(COL.fullName).width = 32;
  ws.getColumn(COL.niss).width = 18;
  ws.getColumn(COL.tin).width = 16;
  ws.getColumn(COL.laborSituation).width = 20;
  for (const col of [
    COL.baseSalary,
    COL.annualSubsidy,
    COL.totalDeclared,
    COL.incomeTax,
    COL.employerSS,
    COL.workerSS,
    COL.netPay,
  ]) {
    ws.getColumn(col).width = 14;
  }

  // ---------- Sheet 2: Resumo ----------
  // Xefe's own summary sheet (not part of the official template) — branded.
  const resumo = wb.addWorksheet('Resumo');
  resumo.mergeCells('B1:E1');
  resumo.getCell('B1').value = 'DECLARAÇÃO DE REMUNERAÇÕES — RESUMO';
  resumo.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  resumo.getCell('B1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A9C29' } };
  resumo.getCell('B1').alignment = { vertical: 'middle', indent: 1 };
  resumo.getRow(1).height = 24;
  resumo.getCell('B2').value = 'Preparado por Xefe (xefe.tl) — formatu ofisiál portál INSS';
  resumo.getCell('B2').font = { size: 9, color: { argb: 'FF6B7280' } };

  const summaryRows: Array<[string, number | string]> = [
    ['Entidade Empregadora', ret.employerName],
    ['TIN', ret.employerTIN],
    ['Período', `${monthName} ${yearStr}`],
    ['Total de trabalhadores', ret.totalEmployees],
    ['Base de incidência contributiva', ret.totalContributionBase],
    ['Contribuição Trabalhador (4%)', ret.totalEmployeeContributions],
    ['Contribuição Entidade Empregadora (6%)', ret.totalEmployerContributions],
    ['Total de contribuições a pagar', ret.totalContributions],
  ];
  summaryRows.forEach(([label, value], i) => {
    const row = resumo.getRow(3 + i);
    row.getCell(2).value = label;
    row.getCell(4).value = value;
    if (typeof value === 'number' && i >= 4) row.getCell(4).numFmt = MONEY_FMT;
  });
  resumo.getColumn(2).width = 38;
  resumo.getColumn(4).width = 20;
  const totalRow = resumo.getRow(3 + summaryRows.length - 1);
  totalRow.font = { bold: true };

  return wb;
}

/** Build the DR workbook and trigger a browser download. */
export async function downloadInssDrExcel(ret: MonthlyINSSReturn, options: InssDrExportOptions = {}): Promise<void> {
  const wb = buildInssDrWorkbook(ret, options);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `INSS_DR_${ret.reportingPeriod}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
