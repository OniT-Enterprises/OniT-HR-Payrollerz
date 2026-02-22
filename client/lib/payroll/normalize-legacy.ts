/**
 * Legacy Firestore Record Normalizer
 *
 * Old payroll records stored US-style deduction type strings (federal_tax, social_security, etc.)
 * because a mapping shim converted TL types before save. This module normalizes those strings
 * on read so the rest of the app only sees TL-native types.
 *
 * No Firestore migration needed — old records get normalized transparently.
 */

import type { DocumentData } from 'firebase/firestore';
import type { DeductionType } from '@/types/payroll';

/** Map legacy US deduction type strings to TL-native equivalents */
const LEGACY_DEDUCTION_MAP: Record<string, DeductionType> = {
  federal_tax: 'income_tax',
  state_tax: 'income_tax',    // TL has no state tax; collapse into income_tax
  local_tax: 'income_tax',    // same
  social_security: 'inss_employee',
  medicare: 'inss_employee',  // TL has no medicare; collapse into INSS
  '401k': 'other',
  hsa: 'other',
  fsa: 'other',
  dental_insurance: 'health_insurance',
  vision_insurance: 'health_insurance',
  garnishment: 'court_order',
  advance: 'advance_repayment',
};

/** Map legacy US employer tax type strings to TL-native equivalents */
const LEGACY_EMPLOYER_TAX_MAP: Record<string, string> = {
  social_security: 'inss_employer',
  medicare: 'inss_employer',
  futa: 'inss_employer',
  suta: 'inss_employer',
};

/**
 * Normalize a single deduction type string.
 * Returns the input unchanged if it's already a TL-native type.
 */
export function normalizeLegacyDeductionType(type: string): DeductionType {
  return (LEGACY_DEDUCTION_MAP[type] as DeductionType) ?? (type as DeductionType);
}

/**
 * Normalize a single employer tax type string.
 */
export function normalizeLegacyEmployerTaxType(type: string): string {
  return LEGACY_EMPLOYER_TAX_MAP[type] ?? type;
}

/**
 * Normalize a raw Firestore payroll record document in place.
 * Handles:
 * - deduction[].type  (US → TL)
 * - employerTaxes[].type  (US → TL)
 * - YTD field renames (ytdFederalTax → ytdIncomeTax, etc.)
 */
export function normalizeLegacyRecord(raw: DocumentData): DocumentData {
  // Normalize deduction types
  if (Array.isArray(raw.deductions)) {
    raw.deductions = raw.deductions.map((d: { type?: string }) => ({
      ...d,
      type: d.type ? normalizeLegacyDeductionType(d.type) : d.type,
    }));
  }

  // Normalize employer tax types
  if (Array.isArray(raw.employerTaxes)) {
    raw.employerTaxes = raw.employerTaxes.map((t: { type?: string }) => ({
      ...t,
      type: t.type ? normalizeLegacyEmployerTaxType(t.type) : t.type,
    }));
  }

  // Rename YTD fields (keep old field as fallback for records that already have TL names)
  if ('ytdFederalTax' in raw && !('ytdIncomeTax' in raw)) {
    raw.ytdIncomeTax = raw.ytdFederalTax;
  }
  if ('ytdSocialSecurity' in raw && !('ytdINSSEmployee' in raw)) {
    raw.ytdINSSEmployee = raw.ytdSocialSecurity;
  }

  // Clean up old field names so they don't linger
  delete raw.ytdFederalTax;
  delete raw.ytdStateTax;
  delete raw.ytdSocialSecurity;
  delete raw.ytdMedicare;

  return raw;
}
