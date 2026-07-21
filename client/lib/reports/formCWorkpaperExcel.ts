/**
 * Annual income tax (TADR-IT 1) preparation workpaper Excel export.
 *
 * PROVENANCE: this is Xefe's OWN workpaper layout — it is NOT the official
 * form and is not modeled on any client or accounting firm's workbook. Only
 * the line numbers and line labels quote the official ATTL "Annual Income
 * Tax Form" (TADR Form No TADR-IT 1, 2023 edition, attl.gov.tl) so the
 * accountant can transcribe each figure onto the official form. Xefe does
 * not generate or file the official form itself.
 *
 * Import this module dynamically (`await import(...)`) — exceljs is heavy
 * and must stay out of the main bundle.
 */

import ExcelJS from 'exceljs';
import type { FormCWorkpaper, FormCLineCode } from '@/lib/tax/form-c';

// Cents everywhere — ATTL's e-Tax system keeps cents on every line (see the
// engine's rounding note; validated against two real Aviso assessments).
const MONEY_FMT = '#,##0.00';
const MONEY_CENTS_FMT = '#,##0.00';

/** Official TADR-IT 1 (2023) line labels, quoted for transcription. */
const LINE_LABELS: Record<FormCLineCode, string> = {
  '05': 'Total/Gross income',
  '10': 'Purchases - Inventory and trading stock',
  '15': 'Tax deductible depreciation',
  '20': 'Tax deductible amortisation of intangibles',
  '25': 'Tax deductible bad debts',
  '30': 'Tax deductible foreign currency exchange losses',
  '35': 'Salary & wages',
  '40': 'Contractor and sub-contractor expenses',
  '45': 'Commission expenses',
  '50': 'Rent and/or lease expenses',
  '55': 'Motor vehicle expenses',
  '60': 'Repairs & maintenance',
  '65': 'Research & development expenses',
  '70': 'Scholarship, apprenticeship & training costs',
  '75': 'Royalties',
  '80': 'Losses from sale/transfer of property',
  '110': 'Other tax deductible expenses',
};

function addHeader(sheet: ExcelJS.Worksheet, workpaper: FormCWorkpaper): void {
  sheet.addRow([
    `Annual income tax preparation workpaper — tax year ${workpaper.taxYear}`,
  ]).font = { bold: true, size: 13 };
  sheet.addRow([
    'PREPARATION AID ONLY — not the official form. Review every figure with your accountant,',
  ]);
  sheet.addRow([
    'then transcribe onto the official ATTL Annual Income Tax Form (TADR-IT 1). attl.gov.tl',
  ]);
  sheet.addRow([
    `Enterprise type: ${
      workpaper.entityType === 'sole_trader'
        ? 'Sole trader (individually-owned) — Table A rates'
        : 'Company (Unipessoal Lda, Lda, SA) — Table B rates'
    }`,
  ]);
  sheet.addRow([
    `Tax depreciation method: ${
      workpaper.taxDepreciationMethod === 'full_expensing'
        ? '100% expensing in acquisition year (Schedule VII)'
        : 'Straight-line useful-life rates (asset register)'
    }`,
  ]);
  sheet.addRow([]);
}

function moneyCell(row: ExcelJS.Row, index: number, format = MONEY_FMT): void {
  row.getCell(index).numFmt = format;
}

export function buildFormCWorkpaperWorkbook(
  workpaper: FormCWorkpaper,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Xefe';

  // ── Sheet 1: the line-numbered workpaper ─────────────────────────────────
  const main = wb.addWorksheet('Workpaper');
  main.columns = [
    { width: 8 },
    { width: 52 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 40 },
  ];
  addHeader(main, workpaper);

  const headerRow = main.addRow([
    'Line',
    'Description (official form label)',
    'From books',
    'Adjustment',
    'Form amount',
    'Notes',
  ]);
  headerRow.font = { bold: true };

  for (const line of workpaper.lines) {
    const row = main.addRow([
      line.line,
      LINE_LABELS[line.line],
      line.fromBooks,
      line.adjustment || null,
      line.amount,
      line.adjustmentNotes.join('; '),
    ]);
    moneyCell(row, 3);
    moneyCell(row, 4);
    moneyCell(row, 5);
  }

  const totals = workpaper.totals;
  const { credits } = workpaper;
  const totalRows: [string, string, number, string?][] = [
    ['135', 'Total expenses (add lines 10 to 110)', totals.totalExpenses],
    ['140', 'Net Income/Loss before carry forward losses', totals.netIncome],
    ['145', 'Loss carried forward (TADR-verified)', totals.lossCarriedForward],
    ['150', 'Taxable Income or Loss', totals.taxableIncome],
    ['155', 'Total losses to carry forward', totals.lossCarryForwardOut],
    ['160', 'Income subject to income tax', totals.incomeSubjectToTax],
    ['165', 'Tax on income subject to income tax', totals.tax],
    ['170', 'Foreign tax credits', credits.foreignTaxCredits],
    ['175', 'Income tax instalments paid', credits.installmentsPaid],
    [
      '180',
      'WHT withheld from royalty income',
      credits.wht.royalties.amount,
      credits.wht.royalties.payerTin,
    ],
    [
      '185',
      'WHT withheld from rental income (land/buildings)',
      credits.wht.rentalLandBuildings.amount,
      credits.wht.rentalLandBuildings.payerTin,
    ],
    [
      '190',
      'WHT withheld from building and construction income',
      credits.wht.buildingConstruction.amount,
      credits.wht.buildingConstruction.payerTin,
    ],
    [
      '195',
      'WHT withheld from construction consulting services income',
      credits.wht.constructionConsulting.amount,
      credits.wht.constructionConsulting.payerTin,
    ],
    [
      '200',
      'WHT withheld from air and sea transportation services income',
      credits.wht.airSeaTransport.amount,
      credits.wht.airSeaTransport.payerTin,
    ],
    [
      '205',
      'WHT withheld from mining and mining support services income',
      credits.wht.mining.amount,
      credits.wht.mining.payerTin,
    ],
    ['215', 'Total credits (add lines 170 to 205)', totals.totalCredits],
    [
      '220',
      `Tax owing/overpaid${totals.overpaid ? " — OVERPAID, circle 'R'" : ''}`,
      totals.taxOwing,
    ],
  ];
  const boldCodes = new Set(['135', '140', '150', '165', '215', '220']);
  for (const [code, label, amount, payerTin] of totalRows) {
    const row = main.addRow([
      code,
      label,
      null,
      null,
      amount,
      payerTin ? `Payer TIN: ${payerTin}` : '',
    ]);
    if (boldCodes.has(code)) row.font = { bold: true };
    moneyCell(row, 5);
  }

  if (workpaper.otherExpenseDetails.length > 0) {
    main.addRow([]);
    main.addRow([
      '',
      'Lines 115–130: Other expenses over $1,000 (attach if more than 4)',
    ]).font = { bold: true };
    for (const detail of workpaper.otherExpenseDetails) {
      const row = main.addRow([
        '',
        `${detail.accountCode} · ${detail.accountName}`,
        null,
        null,
        detail.amount,
        '',
      ]);
      moneyCell(row, 5);
    }
  }

  if (workpaper.excluded.length > 0) {
    main.addRow([]);
    main.addRow(['', 'Excluded as non-deductible (review)']).font = {
      bold: true,
    };
    for (const entry of workpaper.excluded) {
      const row = main.addRow([
        '',
        `${entry.accountCode} · ${entry.accountName}`,
        entry.amount,
        null,
        null,
        entry.reason === 'interest_non_deductible'
          ? 'Interest — deductible only for financial institutions (TDA §31)'
          : entry.reason === 'books_depreciation_tax_method'
            ? 'Books depreciation — replaced by the Schedule VII tax schedule'
            : 'Income tax expense — not deductible',
      ]);
      moneyCell(row, 3, MONEY_CENTS_FMT);
    }
  }

  // ── Sheet 2: depreciation schedule (official schedule columns) ───────────
  if (workpaper.depreciationSchedule.length > 0) {
    const dep = wb.addWorksheet('Depreciation Schedule');
    dep.columns = [
      { width: 36 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 10 },
      { width: 14 },
      { width: 16 },
    ];
    dep.addRow([
      `Depreciation schedule — tax year ${workpaper.taxYear} (attach to the official form)`,
    ]).font = { bold: true, size: 12 };
    dep.addRow([]);
    dep.addRow([
      'Description of asset',
      `Value as at 01/01/${workpaper.taxYear}`,
      'Cost (if purchased)',
      'Date of purchase',
      'Disposal date',
      'Proceeds from disposal',
      "Depr'n rate %",
      'Calculated depreciation',
      `Closing WDV 31/12/${workpaper.taxYear}`,
    ]).font = { bold: true };
    for (const row of workpaper.depreciationSchedule) {
      const added = dep.addRow([
        row.description,
        row.openingValue,
        row.purchaseCost ?? null,
        row.purchaseDate ?? '',
        row.disposalDate ?? '',
        row.disposalProceeds ?? null,
        row.ratePercent,
        row.yearDepreciation,
        row.closingValue,
      ]);
      for (const index of [2, 3, 6, 8, 9]) {
        moneyCell(added, index, MONEY_CENTS_FMT);
      }
    }
    const totalRow = dep.addRow([
      'Total',
      null,
      null,
      '',
      '',
      null,
      null,
      workpaper.scheduleTotalDepreciation,
      null,
    ]);
    totalRow.font = { bold: true };
    moneyCell(totalRow, 8, MONEY_CENTS_FMT);
  }

  // ── Sheet 3: GL detail (which accounts fed each line) ────────────────────
  const detail = wb.addWorksheet('GL Detail');
  detail.columns = [{ width: 8 }, { width: 12 }, { width: 44 }, { width: 14 }];
  detail.addRow(['Line', 'Account', 'Account name', 'Amount']).font = {
    bold: true,
  };
  for (const line of workpaper.lines) {
    for (const account of line.accounts) {
      const row = detail.addRow([
        line.line,
        account.accountCode,
        account.accountName,
        account.amount,
      ]);
      moneyCell(row, 4, MONEY_CENTS_FMT);
    }
  }

  return wb;
}

/** Build the workpaper workbook and trigger a browser download. */
export async function downloadFormCWorkpaperExcel(
  workpaper: FormCWorkpaper,
): Promise<void> {
  const wb = buildFormCWorkpaperWorkbook(workpaper);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Annual_Income_Tax_Workpaper_${workpaper.taxYear}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
