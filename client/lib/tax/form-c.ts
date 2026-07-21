/**
 * Annual income tax (TADR-IT 1) preparation workpaper. ("Form C" survives
 * only in internal identifiers — it is not a Timor-Leste term; the official
 * title is "Annual Income Tax Form", TADR Form No TADR-IT 1.) —
 * pure, Firebase-free builder.
 *
 * SCOPE / PROVENANCE: Xefe does NOT calculate or file the official return.
 * This module assembles a PREPARATION WORKPAPER whose line numbers reference
 * the official ATTL/TADR form "Annual Income Tax Form" (TADR-IT 1, 2023
 * edition, downloaded from attl.gov.tl) so an accountant can review the
 * mapped figures and transcribe them onto the official form. The layout is
 * Xefe's own; only the line numbering and labels quote the official form.
 * `officialFormSupported` on the stored preparation record stays `false`
 * until the current form/instructions have external accountant sign-off
 * (docs/LAUNCH_READINESS_TODO.md).
 *
 * Statutory grounding (Taxes and Duties Act 2008 / Law 8/2008 + the official
 * 2023 Income Tax Form Instructions):
 * - §62.1 every income taxpayer files, loss years included; §62.2 due the
 *   last day of month 3 after year end; §62.3 businesses attach P&L, balance
 *   sheet and cash-flow.
 * - Line 145/150/155 loss mechanics per the instructions: a carried-forward
 *   loss is claimable only up to the year's net income; 2008+ losses carry
 *   forward indefinitely.
 * - Line 165 rates per the instructions: Table A (sole trader) 0% to $6,000
 *   then 10% above; Table B (Unipessoal Lda / Lda / SA etc.) 10% flat.
 * - Line 110 note: only financial institutions may deduct interest expense
 *   (TDA §31) — interest accounts are excluded with a warning, never
 *   silently dropped.
 * - Q1 instructions: a sole trader cannot deduct payments to themself.
 *
 * ROUNDING — cents, half-up, validated against ATTL's own output: the paper
 * instructions say whole dollars with tax owing rounded DOWN, but two real
 * e-filed "Aviso de Avaliação" assessments (2024 tax year) show the e-Tax
 * system keeping cents on every line and computing the 10% to the cent,
 * half-up (165,819.68 → 16,581.97; 12,880.65 → 1,288.07), and filed
 * practitioner workbooks carry cents on the form lines too. Returns are
 * e-filed now, so the workpaper matches the assessed behavior — golden
 * tests in tests/client/form-c-assessments.test.ts pin both assessments.
 *
 * TAX DEPRECIATION METHOD — the register's straight-line useful-life rates
 * ('useful_life', conservative default) or Schedule VII's 100% expensing in
 * the year of acquisition ('full_expensing', the treatment observed on real
 * filed returns and assessed by ATTL). Accountant sign-off on the default is
 * still an open launch gate; the method is an explicit per-year choice.
 */

import {
  addMoney,
  maxMoney,
  multiplyMoney,
  roundMoney,
  subtractMoney,
  sumMoney,
} from '@/lib/currency';
import {
  depreciableAmount,
  monthlyCharge,
  periodOf,
  periodsBetween,
} from '@/lib/accounting/depreciation';

// ── form line model ─────────────────────────────────────────────────────────

/** TADR-IT 1 (2023) line codes, in form order. */
export const FORM_C_LINE_CODES = [
  '05', // Total/Gross income
  '10', // Purchases - inventory and trading stock
  '15', // Tax deductible depreciation
  '20', // Tax deductible amortisation of intangibles
  '25', // Tax deductible bad debts
  '30', // Tax deductible foreign currency exchange losses
  '35', // Salary & wages
  '40', // Contractor and sub-contractor expenses
  '45', // Commission expenses
  '50', // Rent and/or lease expenses
  '55', // Motor vehicle expenses
  '60', // Repairs & maintenance
  '65', // Research & development expenses
  '70', // Scholarship, apprenticeship & training costs
  '75', // Royalties
  '80', // Losses from sale/transfer of property
  '110', // Other tax deductible expenses
] as const;

export type FormCLineCode = (typeof FORM_C_LINE_CODES)[number];

const EXPENSE_LINE_CODES = FORM_C_LINE_CODES.filter((code) => code !== '05');

export type FormCEntityType = 'sole_trader' | 'company';

/**
 * Line 15 treatment: register useful-life rates (conservative default) or
 * Schedule VII 100% expensing in the acquisition year (observed filed
 * practice — see the module header).
 */
export type FormCTaxDepreciationMethod = 'useful_life' | 'full_expensing';

/** One P&L row as read from the GL income statement (cents-accurate). */
export interface FormCGlRow {
  accountCode: string;
  accountName: string;
  accountType: 'revenue' | 'expense';
  amount: number;
}

/** Fixed-asset register row, plain data (see FixedAsset). */
export interface FormCAssetInput {
  name: string;
  reference?: string;
  acquisitionDate: string; // YYYY-MM-DD
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationStartPeriod: string; // YYYY-MM
  status: 'active' | 'fully_depreciated' | 'disposed';
  disposalDate?: string;
  disposalProceeds?: number;
}

export interface FormCWhtCreditEntry {
  amount: number;
  payerTin: string;
}

/** Credit lines 180–205 in form order. */
export interface FormCWhtCredits {
  royalties: FormCWhtCreditEntry; // 180
  rentalLandBuildings: FormCWhtCreditEntry; // 185
  buildingConstruction: FormCWhtCreditEntry; // 190
  constructionConsulting: FormCWhtCreditEntry; // 195
  airSeaTransport: FormCWhtCreditEntry; // 200
  mining: FormCWhtCreditEntry; // 205
}

export interface FormCLineAdjustment {
  line: FormCLineCode;
  amount: number; // signed, whole or cents — rounded into the line
  note: string;
}

/** Accountant-entered values the GL cannot supply. */
export interface FormCManualInputs {
  entityType: FormCEntityType;
  taxDepreciationMethod: FormCTaxDepreciationMethod;
  /** Line 145 — must be the TADR-verified carried-forward loss. */
  lossCarriedForward: number;
  /** Line 175 — §64 instalments paid toward this year. */
  installmentsPaid: number;
  /** Line 170. */
  foreignTaxCredits: number;
  /** Lines 180–205. */
  whtCredits: FormCWhtCredits;
  adjustments: FormCLineAdjustment[];
}

export interface FormCContributingAccount {
  accountCode: string;
  accountName: string;
  amount: number; // cents-accurate books amount
}

export interface FormCLine {
  line: FormCLineCode;
  /** Cents-accurate amount mapped from the books (or the tax schedule). */
  fromBooks: number;
  /** Net of the accountant's adjustments on this line. */
  adjustment: number;
  /** fromBooks + adjustment — the figure to transcribe onto the form. */
  amount: number;
  accounts: FormCContributingAccount[];
  adjustmentNotes: string[];
}

/** Lines 115–130 — every Other-expenses account over $1,000, largest first. */
export interface FormCOtherExpenseDetail {
  accountCode: string;
  accountName: string;
  amount: number;
}

export interface FormCExcludedAccount {
  accountCode: string;
  accountName: string;
  amount: number;
  reason:
    | 'interest_non_deductible'
    | 'income_tax_expense'
    | 'books_depreciation_tax_method';
}

export interface FormCDepreciationRow {
  description: string;
  /** Written-down value at 1 January of the tax year (0 for in-year buys). */
  openingValue: number;
  purchaseCost?: number;
  purchaseDate?: string;
  disposalDate?: string;
  disposalProceeds?: number;
  /** Straight-line annual rate, percent (12/lifeMonths × 100). */
  ratePercent: number;
  yearDepreciation: number;
  /** Written-down value at 31 December (0 once disposed). */
  closingValue: number;
}

export type FormCWarning =
  | { code: 'interest_excluded'; accountName: string; amount: number }
  | { code: 'income_tax_expense_excluded'; accountName: string; amount: number }
  | { code: 'sole_trader_own_salary' }
  | {
      code: 'depreciation_schedule_mismatch';
      glAmount: number;
      scheduleAmount: number;
    }
  | { code: 'books_depreciation_replaced'; glAmount: number }
  | {
      code: 'expensed_disposal_proceeds';
      assetDescription: string;
      amount: number;
    }
  | { code: 'negative_line'; line: FormCLineCode; amount: number };

export interface FormCTotals {
  /** Line 135 = Σ lines 10–110 (cents-accurate). */
  totalExpenses: number;
  /** Line 140 = line 05 − line 135; negative in a loss year. */
  netIncome: number;
  /** Line 145 as entered (TADR-verified input). */
  lossCarriedForward: number;
  /** The part of line 145 actually claimed (≤ max(netIncome, 0)). */
  lossApplied: number;
  /** Line 150. */
  taxableIncome: number;
  /** Line 155 — unexpired carry-forward into next year. */
  lossCarryForwardOut: number;
  /** Line 160 (= line 150, never below 0 for the tax calc). */
  incomeSubjectToTax: number;
  /** Line 165 — 10% to the cent, half-up (matches ATTL e-Tax assessments). */
  tax: number;
  /** Line 215 = Σ lines 170–205. */
  totalCredits: number;
  /** Line 220 = 165 − 215; negative means overpaid (circle 'R'). */
  taxOwing: number;
  overpaid: boolean;
}

export interface FormCWorkpaper {
  taxYear: number;
  entityType: FormCEntityType;
  taxDepreciationMethod: FormCTaxDepreciationMethod;
  lines: FormCLine[];
  otherExpenseDetails: FormCOtherExpenseDetail[];
  excluded: FormCExcludedAccount[];
  depreciationSchedule: FormCDepreciationRow[];
  /** Cents-accurate schedule column total (form attachment shows cents). */
  scheduleTotalDepreciation: number;
  /** Lines 170–205 echoed for transcription (with payer TINs). */
  credits: {
    foreignTaxCredits: number; // 170
    installmentsPaid: number; // 175
    wht: FormCWhtCredits; // 180–205
  };
  totals: FormCTotals;
  warnings: FormCWarning[];
}

// ── GL account → form line mapping ──────────────────────────────────────────

/**
 * Exact built-in chart codes first (client/lib/accounting/chart-of-accounts.ts).
 * 5150 INSS Employer deliberately maps to 110 Other, not 35 Salary & wages —
 * the instructions define line 35 as amounts paid to persons employed, and a
 * statutory employer contribution is not a payment to the employee.
 */
const LINE_BY_ACCOUNT_CODE: Record<string, FormCLineCode> = {
  '5110': '35',
  '5120': '35',
  '5130': '35',
  '5140': '35',
  '5160': '35',
  '5170': '35',
  '5150': '110',
  '5200': '50',
  '5500': '55',
  '5510': '55',
  '5520': '55',
  '5800': '15',
  '5930': '70',
};

/** Name-keyword fallbacks for tenant-added accounts, first match wins. */
const LINE_BY_NAME_KEYWORD: [RegExp, FormCLineCode][] = [
  [/purchase|inventory|trading stock|cost of goods|cogs/i, '10'],
  [/amorti[sz]/i, '20'],
  [/bad debt/i, '25'],
  [/exchange loss|fx loss|foreign exchange/i, '30'],
  [/salar|wage|payroll|overtime|bonus|subs[ií]dio/i, '35'],
  [/contractor|sub-?contract/i, '40'],
  [/commission/i, '45'],
  [/rent|lease/i, '50'],
  [/motor vehicle|vehicle|fuel/i, '55'],
  [/repair|mainten/i, '60'],
  [/research|development/i, '65'],
  [/training|scholarship|apprentice/i, '70'],
  [/royalt/i, '75'],
  [/loss.*(sale|disposal|transfer)|disposal loss/i, '80'],
  [/depreciat/i, '15'],
];

function lineForExpenseAccount(row: FormCGlRow): FormCLineCode {
  const byCode = LINE_BY_ACCOUNT_CODE[row.accountCode];
  if (byCode) return byCode;
  for (const [pattern, line] of LINE_BY_NAME_KEYWORD) {
    if (pattern.test(row.accountName)) return line;
  }
  return '110';
}

function nonDeductibleReason(
  row: FormCGlRow,
): FormCExcludedAccount['reason'] | null {
  // "Interest Income" is revenue, so expense-only matching is safe here.
  if (/interest/i.test(row.accountName)) return 'interest_non_deductible';
  if (/income tax|profit tax|corporate tax/i.test(row.accountName)) {
    return 'income_tax_expense';
  }
  return null;
}

// ── depreciation schedule (mirrors the register's cumulative-cap engine) ────

/** Capped cumulative depreciation through schedule index n (0 = none). */
function accumulatedThroughIndex(asset: FormCAssetInput, n: number): number {
  const life = asset.usefulLifeMonths;
  if (!life || life <= 0 || n <= 0) return 0;
  const total = depreciableAmount(asset);
  if (n >= life) return total;
  const standard = monthlyCharge(asset);
  return Math.min(total, roundMoney(standard * n));
}

/** Schedule index (months elapsed, inclusive) at the given period. */
function indexAtPeriod(asset: FormCAssetInput, period: string): number {
  return periodsBetween(asset.depreciationStartPeriod, period);
}

/**
 * One official-schedule row per asset that existed during the tax year.
 *
 * useful_life: straight-line register rates; depreciation stops at the
 * disposal month and a disposed asset closes at 0.
 *
 * full_expensing (Schedule VII, observed filed practice): only in-year
 * acquisitions appear, at rate 100% of cost with closing value 0 — prior
 * years' assets are already fully written down for tax. In-year disposals of
 * previously-expensed assets appear as zero-depreciation rows so their
 * proceeds stay visible (they belong in gross income).
 */
export function buildFormCDepreciationSchedule(
  assets: FormCAssetInput[],
  taxYear: number,
  method: FormCTaxDepreciationMethod = 'useful_life',
): FormCDepreciationRow[] {
  const yearStart = `${taxYear}-01`;
  const yearEnd = `${taxYear}-12`;
  const priorYearEnd = `${taxYear - 1}-12`;

  const rows: FormCDepreciationRow[] = [];
  for (const asset of assets) {
    const acquiredPeriod = periodOf(asset.acquisitionDate);
    if (acquiredPeriod > yearEnd) continue; // not yet acquired
    const disposedPeriod = asset.disposalDate
      ? periodOf(asset.disposalDate)
      : null;
    if (disposedPeriod && disposedPeriod < yearStart) continue; // gone before the year

    const acquiredInYear = acquiredPeriod >= yearStart;
    const cost = roundMoney(asset.acquisitionCost);
    const disposedThisYear =
      disposedPeriod !== null && disposedPeriod <= yearEnd;

    if (method === 'full_expensing') {
      // Prior-year assets carry no tax value; only surface in-year events.
      if (!acquiredInYear && !disposedThisYear) continue;
      rows.push({
        description: asset.reference
          ? `${asset.name} (${asset.reference})`
          : asset.name,
        openingValue: 0,
        ...(acquiredInYear
          ? { purchaseCost: cost, purchaseDate: asset.acquisitionDate }
          : {}),
        ...(disposedThisYear
          ? {
              disposalDate: asset.disposalDate,
              disposalProceeds: roundMoney(asset.disposalProceeds || 0),
            }
          : {}),
        ratePercent: 100,
        yearDepreciation: acquiredInYear ? cost : 0,
        closingValue: 0,
      });
      continue;
    }

    const openingAccum = accumulatedThroughIndex(
      asset,
      indexAtPeriod(asset, priorYearEnd),
    );
    const openingValue = acquiredInYear ? 0 : subtractMoney(cost, openingAccum);

    // Depreciation runs through December or the disposal month.
    const lastPeriod =
      disposedPeriod && disposedPeriod < yearEnd ? disposedPeriod : yearEnd;
    const closingAccum = accumulatedThroughIndex(
      asset,
      indexAtPeriod(asset, lastPeriod),
    );
    const yearDepreciation = maxMoney(
      0,
      subtractMoney(closingAccum, openingAccum),
    );

    const closingValue = disposedThisYear
      ? 0
      : subtractMoney(cost, closingAccum);

    const ratePercent =
      asset.usefulLifeMonths > 0
        ? Math.round((1200 / asset.usefulLifeMonths) * 100) / 100
        : 0;

    rows.push({
      description: asset.reference
        ? `${asset.name} (${asset.reference})`
        : asset.name,
      openingValue,
      ...(acquiredInYear
        ? { purchaseCost: cost, purchaseDate: asset.acquisitionDate }
        : {}),
      ...(disposedThisYear
        ? {
            disposalDate: asset.disposalDate,
            disposalProceeds: roundMoney(asset.disposalProceeds || 0),
          }
        : {}),
      ratePercent,
      yearDepreciation,
      closingValue,
    });
  }
  return rows;
}

// ── tax tables (2023 instructions, page 7–8) ────────────────────────────────

export const SOLE_TRADER_FREE_THRESHOLD = 6000;
export const INCOME_TAX_RATE = 0.1;

/**
 * Line 165, computed to the cent (half-up) — the behavior ATTL's e-Tax
 * system actually assesses (two real Avisos: 165,819.68 → 16,581.97;
 * 12,880.65 → 1,288.07). The paper instructions' "round any tax owing down
 * to the nearest dollar" applies only to hand-filed whole-dollar returns.
 */
export function calculateFormCTax(
  taxableIncome: number,
  entityType: FormCEntityType,
): number {
  if (taxableIncome <= 0) return 0;
  const base =
    entityType === 'sole_trader'
      ? maxMoney(0, subtractMoney(taxableIncome, SOLE_TRADER_FREE_THRESHOLD))
      : taxableIncome;
  return multiplyMoney(base, INCOME_TAX_RATE);
}

// ── workpaper builder ───────────────────────────────────────────────────────

export const EMPTY_WHT_CREDITS: FormCWhtCredits = {
  royalties: { amount: 0, payerTin: '' },
  rentalLandBuildings: { amount: 0, payerTin: '' },
  buildingConstruction: { amount: 0, payerTin: '' },
  constructionConsulting: { amount: 0, payerTin: '' },
  airSeaTransport: { amount: 0, payerTin: '' },
  mining: { amount: 0, payerTin: '' },
};

export const EMPTY_FORM_C_MANUAL_INPUTS: FormCManualInputs = {
  entityType: 'company',
  taxDepreciationMethod: 'useful_life',
  lossCarriedForward: 0,
  installmentsPaid: 0,
  foreignTaxCredits: 0,
  whtCredits: EMPTY_WHT_CREDITS,
  adjustments: [],
};

export interface BuildFormCWorkpaperInput {
  taxYear: number;
  glRows: FormCGlRow[];
  assets: FormCAssetInput[];
  manual: FormCManualInputs;
}

export function buildFormCWorkpaper(
  input: BuildFormCWorkpaperInput,
): FormCWorkpaper {
  const { taxYear, glRows, assets, manual } = input;
  const method = manual.taxDepreciationMethod;
  const warnings: FormCWarning[] = [];
  const excluded: FormCExcludedAccount[] = [];

  // 1. Tax depreciation schedule (line 15 sources from it in full expensing).
  const depreciationSchedule = buildFormCDepreciationSchedule(
    assets,
    taxYear,
    method,
  );
  const scheduleTotalDepreciation = sumMoney(
    depreciationSchedule.map((row) => row.yearDepreciation),
  );

  // 2. Map every P&L row to a form line (or the excluded list).
  const accountsByLine = new Map<FormCLineCode, FormCContributingAccount[]>();
  const push = (line: FormCLineCode, row: FormCGlRow) => {
    const list = accountsByLine.get(line) || [];
    list.push({
      accountCode: row.accountCode,
      accountName: row.accountName,
      amount: roundMoney(row.amount),
    });
    accountsByLine.set(line, list);
  };

  for (const row of glRows) {
    if (row.accountType === 'revenue') {
      push('05', row);
      continue;
    }
    const reason = nonDeductibleReason(row);
    if (reason) {
      excluded.push({
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: roundMoney(row.amount),
        reason,
      });
      warnings.push(
        reason === 'interest_non_deductible'
          ? {
              code: 'interest_excluded',
              accountName: row.accountName,
              amount: roundMoney(row.amount),
            }
          : {
              code: 'income_tax_expense_excluded',
              accountName: row.accountName,
              amount: roundMoney(row.amount),
            },
      );
      continue;
    }
    const line = lineForExpenseAccount(row);
    // Full expensing replaces the books depreciation with the Schedule VII
    // amount — the GL charge is excluded (visibly), never double-counted.
    if (line === '15' && method === 'full_expensing') {
      excluded.push({
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: roundMoney(row.amount),
        reason: 'books_depreciation_tax_method',
      });
      continue;
    }
    push(line, row);
  }

  // 3. Cents-accurate lines with adjustments applied.
  const lines: FormCLine[] = FORM_C_LINE_CODES.map((line) => {
    const accounts = accountsByLine.get(line) || [];
    const fromBooks =
      line === '15' && method === 'full_expensing'
        ? roundMoney(scheduleTotalDepreciation)
        : sumMoney(accounts.map((account) => account.amount));
    const lineAdjustments = manual.adjustments.filter(
      (adjustment) => adjustment.line === line,
    );
    const adjustment = sumMoney(lineAdjustments.map((entry) => entry.amount));
    const amount = addMoney(fromBooks, adjustment);
    if (line !== '05' && amount < 0) {
      warnings.push({ code: 'negative_line', line, amount });
    }
    return {
      line,
      fromBooks,
      adjustment,
      amount,
      accounts,
      adjustmentNotes: lineAdjustments
        .map((entry) => entry.note.trim())
        .filter(Boolean),
    };
  });
  const lineAmount = (code: FormCLineCode): number =>
    lines.find((entry) => entry.line === code)?.amount || 0;

  // 4. Lines 115–130 detail: every Other-expenses account over $1,000.
  const otherLine = lines.find((entry) => entry.line === '110');
  const otherExpenseDetails: FormCOtherExpenseDetail[] = (
    otherLine?.accounts || []
  )
    .map((account) => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      amount: account.amount,
    }))
    .filter((detail) => detail.amount > 1000)
    .sort((a, b) => b.amount - a.amount);

  // 5. Method-specific depreciation cross-checks.
  const depreciationLine = lines.find((entry) => entry.line === '15');
  if (method === 'useful_life') {
    if (
      depreciationLine &&
      (depreciationSchedule.length > 0 || depreciationLine.fromBooks > 0) &&
      Math.abs(
        subtractMoney(depreciationLine.fromBooks, scheduleTotalDepreciation),
      ) > 1
    ) {
      warnings.push({
        code: 'depreciation_schedule_mismatch',
        glAmount: depreciationLine.fromBooks,
        scheduleAmount: roundMoney(scheduleTotalDepreciation),
      });
    }
  } else {
    const booksDepreciation = sumMoney(
      excluded
        .filter((entry) => entry.reason === 'books_depreciation_tax_method')
        .map((entry) => entry.amount),
    );
    if (booksDepreciation > 0) {
      warnings.push({
        code: 'books_depreciation_replaced',
        glAmount: booksDepreciation,
      });
    }
    // Proceeds from selling an already-expensed asset are assessable income
    // (the instructions' rule for 100%-amortised intangibles, same logic).
    for (const row of depreciationSchedule) {
      if ((row.disposalProceeds || 0) > 0) {
        warnings.push({
          code: 'expensed_disposal_proceeds',
          assetDescription: row.description,
          amount: row.disposalProceeds || 0,
        });
      }
    }
  }

  // 6. Sole traders cannot deduct payments to themselves (Q1 instructions).
  if (manual.entityType === 'sole_trader' && lineAmount('35') > 0) {
    warnings.push({ code: 'sole_trader_own_salary' });
  }

  // 7. Totals — instructions' loss mechanics, then Table A/B tax.
  const totalExpenses = sumMoney(
    EXPENSE_LINE_CODES.map((code) => lineAmount(code)),
  );
  const netIncome = subtractMoney(lineAmount('05'), totalExpenses);
  const lossCarriedForward = roundMoney(
    maxMoney(0, manual.lossCarriedForward),
  );
  const lossApplied =
    netIncome > 0 ? Math.min(lossCarriedForward, netIncome) : 0;
  const taxableIncome =
    netIncome > 0 ? subtractMoney(netIncome, lossApplied) : netIncome;
  const lossCarryForwardOut =
    netIncome >= 0
      ? subtractMoney(lossCarriedForward, lossApplied)
      : addMoney(lossCarriedForward, Math.abs(netIncome));

  const incomeSubjectToTax = maxMoney(0, taxableIncome);
  const tax = calculateFormCTax(incomeSubjectToTax, manual.entityType);

  const creditMoney = (value: number): number =>
    roundMoney(maxMoney(0, value || 0));
  const whtWhole = (entry: FormCWhtCreditEntry): FormCWhtCreditEntry => ({
    amount: creditMoney(entry.amount),
    payerTin: entry.payerTin.trim(),
  });
  const credits = {
    foreignTaxCredits: creditMoney(manual.foreignTaxCredits),
    installmentsPaid: creditMoney(manual.installmentsPaid),
    wht: {
      royalties: whtWhole(manual.whtCredits.royalties),
      rentalLandBuildings: whtWhole(manual.whtCredits.rentalLandBuildings),
      buildingConstruction: whtWhole(manual.whtCredits.buildingConstruction),
      constructionConsulting: whtWhole(manual.whtCredits.constructionConsulting),
      airSeaTransport: whtWhole(manual.whtCredits.airSeaTransport),
      mining: whtWhole(manual.whtCredits.mining),
    },
  };
  const totalCredits = sumMoney([
    credits.foreignTaxCredits,
    credits.installmentsPaid,
    ...Object.values(credits.wht).map((entry) => entry.amount),
  ]);
  const taxOwing = subtractMoney(tax, totalCredits);

  return {
    taxYear,
    entityType: manual.entityType,
    taxDepreciationMethod: method,
    lines,
    otherExpenseDetails,
    excluded,
    depreciationSchedule,
    scheduleTotalDepreciation: roundMoney(scheduleTotalDepreciation),
    credits,
    totals: {
      totalExpenses,
      netIncome,
      lossCarriedForward,
      lossApplied,
      taxableIncome,
      lossCarryForwardOut,
      incomeSubjectToTax,
      tax,
      totalCredits,
      taxOwing,
      overpaid: taxOwing < 0,
    },
    warnings,
  };
}

/** 31 March of the following year (§62.2: last day of month 3). */
export function formCDueDate(taxYear: number): string {
  return `${taxYear + 1}-03-31`;
}
