/**
 * Timor-Leste banking helpers.
 *
 * TL IBAN spec (BCTL, mandatory for interbank transfers since Jan 2015):
 * 23 characters — "TL" + 2 IBAN check digits + 3-digit bank code +
 * 14-digit account number + 2 national check digits.
 */

const TL_BANK_CODES: Record<string, string> = {
  '001': 'BCTL (Banco Central de Timor-Leste)',
  '002': 'BNU Timor (CGD)',
  '003': 'ANZ',
  '004': 'BNCTL',
  '005': 'Bank Mandiri',
  '006': 'BRI',
};

export interface TLIbanResult {
  valid: boolean;
  error?: string;
  /** Normalized, no spaces, uppercase. */
  iban?: string;
  /** Grouped in blocks of 4 for display. */
  formatted?: string;
  bankCode?: string;
  bankName?: string;
}

/** Standard IBAN mod-97 check (ISO 13616). */
function ibanMod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }
  return remainder;
}

export function validateTLIban(input: string): TLIbanResult {
  const iban = (input || '').replace(/\s+/g, '').toUpperCase();

  if (!iban) return { valid: false, error: 'IBAN is required' };
  if (!iban.startsWith('TL')) {
    return { valid: false, error: 'Timor-Leste IBANs start with TL' };
  }
  if (!/^TL\d{21}$/.test(iban)) {
    return {
      valid: false,
      error: 'A TL IBAN is 23 characters: TL + 21 digits',
    };
  }
  if (ibanMod97(iban) !== 1) {
    return { valid: false, error: 'IBAN check digits do not match — check for typos' };
  }

  const bankCode = iban.slice(4, 7);
  return {
    valid: true,
    iban,
    formatted: iban.replace(/(.{4})/g, '$1 ').trim(),
    bankCode,
    bankName: TL_BANK_CODES[bankCode],
  };
}

/**
 * ATTL domestic tax payment accounts (BNU) — published on
 * attl.gov.tl/how-to-pay-taxes/. EFT payment advice must be marked
 * "electronic payment"; monthly taxes are due by the 15th of the
 * following month.
 */
/**
 * INSS (Segurança Social) contribution collection account at BNU.
 * Verified against 200+ real monthly transfer confirmations (2024–2026,
 * de-identified corpus — docs/MINED_TL_ACCOUNTING_INTEL.md Appendix C):
 * beneficiary "SEGURANCA SOCIAL MSS". The bank credit description convention
 * is "Ref <employer NISS> Seg Soc <TIN> <MES> <ANO>".
 */
export const INSS_PAYMENT_ACCOUNT = {
  beneficiary: 'Segurança Social (MSS)',
  bank: 'Banco Nacional Ultramarino (BNU)',
  account: '01311876610001',
} as const;

export const ATTL_TAX_ACCOUNTS = {
  beneficiary: 'National Directorate of Domestic Revenue-Tax Authority',
  bank: 'Banco Nacional Ultramarino (BNU)',
  swift: 'CGDITLDI',
  accounts: {
    wageIncomeTax: 'TL38 0020 0028 6442 1000 162',
    specialWithholdingTax: 'TL38 0020 0028 6830 1000 162',
  },
} as const;
