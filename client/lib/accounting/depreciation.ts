/**
 * Fixed-asset depreciation — pure schedule math. Firebase-free and
 * unit-tested (tests/client/depreciation.test.ts).
 *
 * Policy (documented, deliberate):
 *  · Straight-line only in v1: (cost − residual) / usefulLifeMonths.
 *  · Full-month convention: depreciation starts in `depreciationStartPeriod`
 *    (default: the acquisition month) and charges a full month regardless of
 *    the acquisition day. This matches common TL practice and keeps the
 *    schedule auditable by hand.
 *  · Cent-exact final period: monthly charges are rounded to cents; the LAST
 *    period absorbs the rounding remainder so accumulated depreciation lands
 *    exactly on (cost − residual), never a cent over or under.
 *  · Asset classes carry default useful lives (editable per asset). Land
 *    never depreciates.
 */
import type { FixedAsset } from '@/types/accounting';
import {
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  maxMoney,
} from '@/lib/currency';

export interface AssetClassDefinition {
  key: string;
  accountCode: string;          // 1510–1550
  defaultLifeMonths: number;    // 0 = does not depreciate (land)
}

/**
 * Default classes map 1:1 to the built-in chart's fixed-asset accounts.
 * Lives follow common straight-line practice (buildings 20y, vehicles 5y,
 * equipment 5y, furniture 8y); every asset can override.
 */
export const ASSET_CLASSES: AssetClassDefinition[] = [
  { key: 'land', accountCode: '1510', defaultLifeMonths: 0 },
  { key: 'buildings', accountCode: '1520', defaultLifeMonths: 240 },
  { key: 'equipment', accountCode: '1530', defaultLifeMonths: 60 },
  { key: 'vehicles', accountCode: '1540', defaultLifeMonths: 60 },
  { key: 'furniture', accountCode: '1550', defaultLifeMonths: 96 },
];

export const ACCUMULATED_DEPRECIATION_CODE = '1590';
export const DEPRECIATION_EXPENSE_CODE = '5800';
export const DISPOSAL_GAIN_CODE = '4300';   // Other Income
export const DISPOSAL_LOSS_CODE = '5900';   // Other Expenses
export const CASH_BANK_CODE = '1120';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── period helpers ('YYYY-MM') ──────────────────────────────────────────────

export function periodOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function addPeriods(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Inclusive count of months from `from` to `to`; 0 when to < from. */
export function periodsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const diff = (ty * 12 + tm) - (fy * 12 + fm) + 1;
  return Math.max(0, diff);
}

// ── schedule math ───────────────────────────────────────────────────────────

export function depreciableAmount(asset: Pick<FixedAsset, 'acquisitionCost' | 'residualValue'>): number {
  return round2(Math.max(0, asset.acquisitionCost - (asset.residualValue || 0)));
}

/** Standard monthly charge (before the final-period true-up). */
export function monthlyCharge(asset: Pick<FixedAsset, 'acquisitionCost' | 'residualValue' | 'usefulLifeMonths'>): number {
  if (!asset.usefulLifeMonths || asset.usefulLifeMonths <= 0) return 0;
  return round2(depreciableAmount(asset) / asset.usefulLifeMonths);
}

/**
 * Charge for the Nth period of the schedule (1-based). The last period
 * absorbs rounding drift so the total is cent-exact.
 */
export function chargeForScheduleIndex(
  asset: Pick<FixedAsset, 'acquisitionCost' | 'residualValue' | 'usefulLifeMonths'>,
  index1: number,
): number {
  const life = asset.usefulLifeMonths;
  if (!life || life <= 0 || index1 < 1 || index1 > life) return 0;
  const total = depreciableAmount(asset);
  const standard = monthlyCharge(asset);
  if (index1 < life) return standard;
  return round2(total - standard * (life - 1));
}

export interface ScheduleRow {
  period: string;       // YYYY-MM
  charge: number;
  accumulated: number;
  netBookValue: number;
}

export function buildSchedule(
  asset: Pick<FixedAsset, 'acquisitionCost' | 'residualValue' | 'usefulLifeMonths' | 'depreciationStartPeriod'>,
): ScheduleRow[] {
  const life = asset.usefulLifeMonths;
  if (!life || life <= 0) return [];
  const rows: ScheduleRow[] = [];
  let accumulated = 0;
  for (let i = 1; i <= life; i++) {
    const charge = chargeForScheduleIndex(asset, i);
    accumulated = round2(accumulated + charge);
    rows.push({
      period: addPeriods(asset.depreciationStartPeriod, i - 1),
      charge,
      accumulated,
      netBookValue: round2(asset.acquisitionCost - accumulated),
    });
  }
  return rows;
}

/**
 * Total charge an asset is due for all unposted periods up to and including
 * `throughPeriod` (catch-up aware). Returns 0 for disposed/non-depreciating
 * assets or when nothing is due.
 */
export function chargeDueThroughPeriod(
  asset: Pick<
    FixedAsset,
    | 'acquisitionCost'
    | 'residualValue'
    | 'usefulLifeMonths'
    | 'depreciationStartPeriod'
    | 'depreciatedThroughPeriod'
    | 'status'
  >,
  throughPeriod: string,
): { charge: number; fromIndex: number; toIndex: number } {
  const none = { charge: 0, fromIndex: 0, toIndex: 0 };
  if (asset.status === 'disposed') return none;
  const life = asset.usefulLifeMonths;
  if (!life || life <= 0) return none;

  // Highest schedule index reachable by throughPeriod, capped at life.
  const reachable = Math.min(life, periodsBetween(asset.depreciationStartPeriod, throughPeriod));
  if (reachable <= 0) return none;

  const alreadyPosted = asset.depreciatedThroughPeriod
    ? Math.min(life, periodsBetween(asset.depreciationStartPeriod, asset.depreciatedThroughPeriod))
    : 0;
  if (reachable <= alreadyPosted) return none;

  let charge = 0;
  for (let i = alreadyPosted + 1; i <= reachable; i++) {
    charge = round2(charge + chargeForScheduleIndex(asset, i));
  }
  return { charge, fromIndex: alreadyPosted + 1, toIndex: reachable };
}

// ── disposal ────────────────────────────────────────────────────────────────

export interface DisposalResult {
  netBookValue: number;
  /** positive = gain (credit Other Income), negative = loss (debit Other Expenses) */
  gainOrLoss: number;
}

export function disposalResult(
  asset: Pick<FixedAsset, 'acquisitionCost' | 'accumulatedDepreciation'>,
  proceeds: number,
): DisposalResult {
  const nbv = round2(asset.acquisitionCost - (asset.accumulatedDepreciation || 0));
  return { netBookValue: nbv, gainOrLoss: round2((proceeds || 0) - nbv) };
}
