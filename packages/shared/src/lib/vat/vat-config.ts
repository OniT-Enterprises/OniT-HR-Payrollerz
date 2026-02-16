/**
 * VAT Configuration — Types and Defaults
 *
 * Platform-level VAT config stored in Firestore (platform/vatConfig).
 * Tenant-level settings stored in tenants/{id}/settings/vat.
 * Default: VAT disabled, rate 0. Updated remotely when TL implements VAT.
 */

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

  /** Date VAT takes effect (ISO string, e.g. "2027-01-01") */
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
  effectiveDate: '2027-01-01',
  standardRate: 0,
  reducedRates: [],
  registrationThreshold: 0,
  filingFrequency: 'quarterly',
  exemptCategories: [],
  zeroRatedCategories: [],
  requiredInvoiceFields: [
    'supplierName',
    'supplierVatId',
    'receiptNumber',
    'date',
    'items',
    'vatBreakdown',
    'total',
  ],
  updatedAt: new Date(),
  updatedBy: 'system',
};

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
