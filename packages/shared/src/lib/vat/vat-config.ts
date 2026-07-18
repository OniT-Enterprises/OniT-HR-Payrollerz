/**
 * VAT Configuration — Types and Defaults
 *
 * Platform-level VAT config stored in Firestore (platform/vatConfig).
 * Tenant-level settings stored in tenants/{id}/settings/vat.
 * Default: VAT disabled, rate 0. Updated remotely when TL implements VAT.
 */

import { getTodayTL } from '../dateUtils';

// ============================================
// VAT Categories
// ============================================

/**
 * VAT treatment for a line item or transaction:
 * - standard: normal VAT rate applies
 * - reduced: lower rate (if TL implements tiered rates)
 * - zero: 0% but input VAT is still claimable (exports, etc.)
 * - exempt: no VAT and no input credit (health, education, etc.)
 * - none: VAT system not active (pre-VAT state)
 */
export type VATCategory = 'standard' | 'reduced' | 'zero' | 'exempt' | 'none';

// ============================================
// Platform Config (Firestore: platform/vatConfig)
// ============================================

export interface VATRateEntry {
  rate: number;
  label: string;
  labelTL?: string;
  categories: string[];
}

export interface VATConfig {
  /** Global kill switch — false until TL implements VAT */
  enabled: boolean;

  /** A draft policy must never activate tax calculations. */
  legalStatus: 'draft' | 'enacted';

  /** Enacted VAT effective date (strict YYYY-MM-DD); blank while policy is draft. */
  effectiveDate: string;

  /** Standard VAT rate as percentage (e.g. 10 = 10%) */
  standardRate: number;

  /** Additional reduced rates (if TL implements tiered rates) */
  reducedRates: VATRateEntry[];

  /** Annual revenue threshold for mandatory VAT registration (USD) */
  registrationThreshold: number;

  /** How often businesses must file */
  filingFrequency: 'monthly' | 'quarterly';

  /** Categories exempt from VAT (no charge, no input credit) */
  exemptCategories: string[];

  /** Categories zero-rated (0% charge, input credit allowed) */
  zeroRatedCategories: string[];

  /** Fields required on a compliant tax invoice */
  requiredInvoiceFields: string[];

  updatedAt: Date;
  updatedBy: string;
}

/** Default config — VAT off, everything zeroed */
export const DEFAULT_VAT_CONFIG: VATConfig = {
  enabled: false,
  legalStatus: 'draft',
  effectiveDate: '',
  standardRate: 0,
  reducedRates: [],
  registrationThreshold: 0,
  filingFrequency: 'quarterly',
  exemptCategories: [],
  zeroRatedCategories: [],
  requiredInvoiceFields: ['supplierName', 'supplierVatId', 'receiptNumber', 'date', 'items', 'vatBreakdown', 'total'],
  updatedAt: new Date(),
  updatedBy: 'system',
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Fail-closed VAT activation check shared by web and mobile.
 *
 * A legacy boolean, a future policy date, or an incomplete draft configuration
 * is not enough to start collecting VAT. Activation requires an enacted law,
 * its effective date, and a complete operational ruleset.
 */
export function isVATConfigOperational(
  config: Partial<VATConfig> | null | undefined,
  asOfDate = getTodayTL()
): config is VATConfig {
  if (!config || config.enabled !== true || config.legalStatus !== 'enacted') {
    return false;
  }
  if (!isValidISODate(config.effectiveDate) || !isValidISODate(asOfDate)) {
    return false;
  }
  if (config.effectiveDate > asOfDate) {
    return false;
  }
  if (
    typeof config.standardRate !== 'number' ||
    !Number.isFinite(config.standardRate) ||
    config.standardRate <= 0 ||
    config.standardRate > 100
  ) {
    return false;
  }
  if (
    typeof config.registrationThreshold !== 'number' ||
    !Number.isFinite(config.registrationThreshold) ||
    config.registrationThreshold < 0
  ) {
    return false;
  }
  if (config.filingFrequency !== 'monthly' && config.filingFrequency !== 'quarterly') {
    return false;
  }
  if (
    !Array.isArray(config.reducedRates) ||
    !Array.isArray(config.exemptCategories) ||
    !Array.isArray(config.zeroRatedCategories) ||
    !Array.isArray(config.requiredInvoiceFields)
  )
    return false;

  return config.reducedRates.every(
    (entry) =>
      typeof entry?.rate === 'number' &&
      Number.isFinite(entry.rate) &&
      entry.rate >= 0 &&
      entry.rate <= 100 &&
      typeof entry.label === 'string' &&
      entry.label.trim().length > 0 &&
      Array.isArray(entry.categories)
  );
}

// ============================================
// Tenant VAT Settings (Firestore: tenants/{id}/settings/vat)
// ============================================

export interface TenantVATSettings {
  /** Per-tenant toggle (default: false until they activate) */
  vatEnabled: boolean;

  /** Is this business VAT-registered with the tax authority? */
  vatRegistered: boolean;

  /** VAT registration number / TIN */
  vatRegistrationNumber?: string;

  /** Date of VAT registration */
  vatRegistrationDate?: string;

  /** Default rate for new transactions (usually standardRate from config) */
  defaultVATRate: number;

  /** true = shelf prices already include VAT (common in retail) */
  pricesIncludeVAT: boolean;

  /** Filing frequency for this tenant */
  filingFrequency: 'monthly' | 'quarterly';

  /** Current filing period boundaries */
  currentPeriodStart: string;
  currentPeriodEnd: string;

  /** For monitoring registration threshold */
  annualRevenue?: number;

  updatedAt: Date;
}

export const DEFAULT_TENANT_VAT_SETTINGS: TenantVATSettings = {
  vatEnabled: false,
  vatRegistered: false,
  defaultVATRate: 0,
  pricesIncludeVAT: false,
  filingFrequency: 'quarterly',
  currentPeriodStart: '',
  currentPeriodEnd: '',
  updatedAt: new Date(),
};
