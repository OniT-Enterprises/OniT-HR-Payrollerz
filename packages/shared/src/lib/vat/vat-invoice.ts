/**
 * VAT Invoice Helpers — Receipt numbering, validation, formatting
 *
 * Used by both Kaixa (mobile receipts) and Meza (web invoices).
 */
import Decimal from 'decimal.js';
import type { VATCategory, VATConfig } from './vat-config';

// ============================================
// Receipt / Invoice Numbering
// ============================================

/**
 * Generate a sequential receipt number.
 * Format: {prefix}-{year}-{sequence zero-padded to 6 digits}
 * Example: "R-2027-000042"
 *
 * Note: The sequence itself must be incremented atomically
 * in Firestore (or reserved in blocks for offline).
 */
export function generateReceiptNumber(
  prefix: string,
  year: number,
  sequence: number
): string {
  const padded = String(sequence).padStart(6, '0');
  return `${prefix}-${year}-${padded}`;
}

/**
 * Parse a receipt number back into components.
 * Returns null if the format doesn't match.
 */
export function parseReceiptNumber(
  receiptNumber: string
): { prefix: string; year: number; sequence: number } | null {
  const match = receiptNumber.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
  if (!match) return null;

  return {
    prefix: match[1],
    year: parseInt(match[2], 10),
    sequence: parseInt(match[3], 10),
  };
}

// ============================================
// VAT Invoice Validation
// ============================================

export interface VATInvoiceInput {
  supplierName?: string;
  supplierVatId?: string;
  receiptNumber?: string;
  date?: string | Date;
  items: {
    description?: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    vatAmount: number;
    netAmount: number;
    grossAmount: number;
  }[];
  total: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that an invoice/receipt meets VAT compliance requirements.
 * Checks required fields and math correctness.
 */
export function validateVATInvoice(
  invoice: VATInvoiceInput,
  config: VATConfig
): ValidationResult {
  const errors: string[] = [];

  // Check required fields from config
  const fieldChecks: Record<string, () => boolean> = {
    supplierName: () => !!invoice.supplierName?.trim(),
    supplierVatId: () => !!invoice.supplierVatId?.trim(),
    receiptNumber: () => !!invoice.receiptNumber?.trim(),
    date: () => !!invoice.date,
    items: () => invoice.items.length > 0,
    total: () => invoice.total > 0,
  };

  for (const field of config.requiredInvoiceFields) {
    const check = fieldChecks[field];
    if (check && !check()) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate math on each line item
  for (let i = 0; i < invoice.items.length; i++) {
    const item = invoice.items[i];
    const lineLabel = `Line ${i + 1}`;

    if (item.quantity <= 0) {
      errors.push(`${lineLabel}: quantity must be positive`);
    }

    if (item.vatRate < 0 || item.vatRate > 100) {
      errors.push(`${lineLabel}: VAT rate must be between 0 and 100`);
    }

    // Check VAT math (net × rate = vat, with tolerance for rounding)
    if (item.vatRate > 0) {
      const expectedVAT = new Decimal(item.netAmount)
        .mul(item.vatRate)
        .div(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      if (Math.abs(expectedVAT - item.vatAmount) > 0.02) {
        errors.push(
          `${lineLabel}: VAT amount $${item.vatAmount} doesn't match rate ${item.vatRate}% on net $${item.netAmount} (expected $${expectedVAT})`
        );
      }
    }

    // Check gross = net + vat
    const expectedGross = new Decimal(item.netAmount)
      .plus(item.vatAmount)
      .toNumber();

    if (Math.abs(expectedGross - item.grossAmount) > 0.01) {
      errors.push(
        `${lineLabel}: gross $${item.grossAmount} != net $${item.netAmount} + VAT $${item.vatAmount}`
      );
    }
  }

  // Validate invoice total matches sum of line gross amounts
  const lineTotal = invoice.items.reduce(
    (sum, item) => new Decimal(sum).plus(item.grossAmount).toNumber(),
    0
  );

  if (Math.abs(lineTotal - invoice.total) > 0.01) {
    errors.push(
      `Invoice total $${invoice.total} doesn't match sum of lines $${lineTotal}`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// VAT Breakdown Formatting
// ============================================

export interface VATBreakdownLine {
  rate: number;
  category: VATCategory;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  lineCount: number;
}

/**
 * Aggregate line items into a VAT breakdown summary grouped by rate.
 * Used for invoice footers and VAT reporting.
 */
export function formatVATBreakdown(
  items: {
    vatRate: number;
    vatCategory: VATCategory;
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
  }[]
): VATBreakdownLine[] {
  const byRate = new Map<
    number,
    { category: VATCategory; net: Decimal; vat: Decimal; gross: Decimal; count: number }
  >();

  for (const item of items) {
    const existing = byRate.get(item.vatRate);
    if (existing) {
      existing.net = existing.net.plus(item.netAmount);
      existing.vat = existing.vat.plus(item.vatAmount);
      existing.gross = existing.gross.plus(item.grossAmount);
      existing.count += 1;
    } else {
      byRate.set(item.vatRate, {
        category: item.vatCategory,
        net: new Decimal(item.netAmount),
        vat: new Decimal(item.vatAmount),
        gross: new Decimal(item.grossAmount),
        count: 1,
      });
    }
  }

  return Array.from(byRate.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, { category, net, vat, gross, count }]) => ({
      rate,
      category,
      netAmount: net.toDecimalPlaces(2).toNumber(),
      vatAmount: vat.toDecimalPlaces(2).toNumber(),
      grossAmount: gross.toDecimalPlaces(2).toNumber(),
      lineCount: count,
    }));
}
