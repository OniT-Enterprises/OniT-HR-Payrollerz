/**
 * VAT Calculations — Pure functions using Decimal.js
 *
 * All money math goes through Decimal.js to avoid floating-point errors.
 * These functions are framework-agnostic — used by both Kaixa and Meza.
 */
import Decimal from 'decimal.js';
import type { VATCategory, VATConfig } from './vat-config';

// ============================================
// Core VAT Math
// ============================================

export interface VATBreakdown {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

/**
 * Calculate VAT from a net (ex-VAT) amount.
 * Example: net $100 at 10% → vat $10, gross $110
 */
export function calculateVAT(netAmount: number, rate: number): VATBreakdown {
  const net = new Decimal(netAmount);
  const vatRate = new Decimal(rate).div(100);
  const vat = net.mul(vatRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const gross = net.plus(vat);

  return {
    netAmount: net.toNumber(),
    vatAmount: vat.toNumber(),
    grossAmount: gross.toNumber(),
  };
}

/**
 * Extract VAT from a gross (VAT-inclusive) amount.
 * Example: gross $110 at 10% → net $100, vat $10
 * Used when prices include VAT (common in retail).
 */
export function extractVAT(grossAmount: number, rate: number): VATBreakdown {
  const gross = new Decimal(grossAmount);
  const vatRate = new Decimal(rate).div(100);
  const net = gross.div(vatRate.plus(1)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vat = gross.minus(net);

  return {
    netAmount: net.toNumber(),
    vatAmount: vat.toNumber(),
    grossAmount: gross.toNumber(),
  };
}

/**
 * Get the applicable VAT rate for a category.
 * Returns 0 for exempt, zero-rated, or when VAT is disabled.
 */
export function getVATRate(
  category: string,
  vatCategory: VATCategory,
  config: VATConfig
): number {
  if (!config.enabled) return 0;

  switch (vatCategory) {
    case 'none':
    case 'exempt':
    case 'zero':
      return 0;

    case 'reduced': {
      const match = config.reducedRates.find((r) =>
        r.categories.includes(category)
      );
      return match?.rate ?? config.standardRate;
    }

    case 'standard':
    default:
      return config.standardRate;
  }
}

/**
 * Determine the VAT category for an item based on config.
 * Used for auto-categorization when user doesn't explicitly choose.
 */
export function inferVATCategory(
  category: string,
  config: VATConfig
): VATCategory {
  if (!config.enabled) return 'none';
  if (config.exemptCategories.includes(category)) return 'exempt';
  if (config.zeroRatedCategories.includes(category)) return 'zero';

  const isReduced = config.reducedRates.some((r) =>
    r.categories.includes(category)
  );
  if (isReduced) return 'reduced';

  return 'standard';
}

// ============================================
// Line Item VAT
// ============================================

export interface LineItemVAT {
  quantity: number;
  unitPrice: number;
  vatCategory: VATCategory;
  vatRate: number;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

/**
 * Calculate VAT for a line item.
 * If pricesIncludeVAT, unitPrice is treated as gross.
 */
export function calculateLineItemVAT(
  quantity: number,
  unitPrice: number,
  vatCategory: VATCategory,
  rate: number,
  pricesIncludeVAT: boolean
): LineItemVAT {
  const lineTotal = new Decimal(quantity)
    .mul(unitPrice)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();

  if (vatCategory === 'none' || vatCategory === 'exempt' || rate === 0) {
    return {
      quantity,
      unitPrice,
      vatCategory,
      vatRate: 0,
      netAmount: lineTotal,
      vatAmount: 0,
      grossAmount: lineTotal,
    };
  }

  const breakdown = pricesIncludeVAT
    ? extractVAT(lineTotal, rate)
    : calculateVAT(lineTotal, rate);

  return {
    quantity,
    unitPrice,
    vatCategory,
    vatRate: rate,
    ...breakdown,
  };
}

// ============================================
// VAT Return Calculation
// ============================================

export interface VATReturnSummary {
  /** Total output VAT (from sales) */
  outputVAT: number;
  /** Total input VAT (from purchases, claimable only) */
  inputVAT: number;
  /** Net amount due (positive = pay, negative = refund) */
  netDue: number;
  /** Breakdown by rate */
  outputByRate: { rate: number; net: number; vat: number }[];
  inputByRate: { rate: number; net: number; vat: number }[];
}

interface OutputTransaction {
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  vatCategory: VATCategory;
}

interface InputTransaction {
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  hasValidVATInvoice: boolean;
}

/**
 * Calculate a VAT return from output and input transactions.
 * Only input VAT with valid invoices is claimable.
 */
export function calculateVATReturn(
  outputs: OutputTransaction[],
  inputs: InputTransaction[]
): VATReturnSummary {
  // Output VAT (from sales)
  const outputByRate = new Map<number, { net: Decimal; vat: Decimal }>();
  let totalOutput = new Decimal(0);

  for (const tx of outputs) {
    if (tx.vatCategory === 'exempt' || tx.vatCategory === 'none') continue;

    const existing = outputByRate.get(tx.vatRate) ?? {
      net: new Decimal(0),
      vat: new Decimal(0),
    };
    existing.net = existing.net.plus(tx.netAmount);
    existing.vat = existing.vat.plus(tx.vatAmount);
    outputByRate.set(tx.vatRate, existing);

    totalOutput = totalOutput.plus(tx.vatAmount);
  }

  // Input VAT (from purchases — only claimable with valid invoice)
  const inputByRate = new Map<number, { net: Decimal; vat: Decimal }>();
  let totalInput = new Decimal(0);

  for (const tx of inputs) {
    if (!tx.hasValidVATInvoice) continue;

    const existing = inputByRate.get(tx.vatRate) ?? {
      net: new Decimal(0),
      vat: new Decimal(0),
    };
    existing.net = existing.net.plus(tx.netAmount);
    existing.vat = existing.vat.plus(tx.vatAmount);
    inputByRate.set(tx.vatRate, existing);

    totalInput = totalInput.plus(tx.vatAmount);
  }

  return {
    outputVAT: totalOutput.toDecimalPlaces(2).toNumber(),
    inputVAT: totalInput.toDecimalPlaces(2).toNumber(),
    netDue: totalOutput.minus(totalInput).toDecimalPlaces(2).toNumber(),
    outputByRate: Array.from(outputByRate.entries()).map(([rate, { net, vat }]) => ({
      rate,
      net: net.toDecimalPlaces(2).toNumber(),
      vat: vat.toDecimalPlaces(2).toNumber(),
    })),
    inputByRate: Array.from(inputByRate.entries()).map(([rate, { net, vat }]) => ({
      rate,
      net: net.toDecimalPlaces(2).toNumber(),
      vat: vat.toDecimalPlaces(2).toNumber(),
    })),
  };
}
