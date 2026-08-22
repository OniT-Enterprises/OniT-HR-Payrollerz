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
 * INSS (Segurança Social) contribution collection account at BNU.
 * Verified against real transfer records during compliance research
 * (2024–2026; internal evidence notes, kept out of the repo): beneficiary
 * "SEGURANCA SOCIAL MSS". The bank credit description convention is
 * "Ref <employer NISS> Seg Soc <TIN> <MES> <ANO>".
 */
export const INSS_PAYMENT_ACCOUNT = {
  beneficiary: 'Segurança Social (MSS)',
  bank: 'Banco Nacional Ultramarino (BNU)',
  account: '01311876610001',
} as const;

/**
 * The four ATTL domestic-tax collection accounts at BNU.
 *
 * Every one of them is attested by real remittance evidence (2024–2026;
 * internal evidence notes, kept out of the repo) in two forms: the local
 * "A/C 286xxx.10.001" that accountants quote to clients, and the 14-digit
 * `bnu` number that BNUdireto's own transfer confirmations name as the
 * destination account. Where an IBAN was sighted alongside it, it follows the
 * same shape — TL38 + bank 002 + the 14-digit account + national check 62.
 *
 * NOTE ON `incomeTaxInstallment`: the same account takes BOTH the Sec. 64
 * instalments AND the annual income-tax settlement due 31 March. That is not
 * an assumption — the annual payments in evidence are addressed to it.
 *
 * All four IBANs are now confirmed against ATTL's own published payment page
 * (attl.gov.tl/how-to-pay-taxes/, read 2026-08-22), which also labels the
 * instalment account "Corporate Tax / Income Tax" — independent confirmation
 * that it takes the annual settlement as well. The services-tax IBAN sat as
 * `null` here until that reading, deliberately: it follows the same
 * TL38/002/…/62 shape as the other three, so a synthesised one would have
 * looked right and validated mod-97 while being unverified. Adopt what the
 * authority publishes; never derive bank details from a pattern.
 *
 * EFT payment advice must be marked "electronic payment", and payment is due
 * by the 15th of the month after the period (Sec. 64.3 for instalments).
 */
export interface ATTLTaxAccountDetail {
  /** The name the e-Tax portal gives this tax account. */
  portalName: string;
  /** Local "286xxx.10.001" form — what BNU branches and BNUdireto use. */
  local: string;
  /** The 14-digit account number a BNUdireto transfer names. */
  bnu: string;
  /**
   * Stays nullable on purpose. Every account ATTL publishes today has one, but
   * the fallback in attlBeneficiaryAccountLine() is the guard against a future
   * account being given a synthesised IBAN because the type demanded a string.
   */
  iban: string | null;
}

export const ATTL_TAX_ACCOUNT_DETAILS: Record<
  'wageIncomeTax' | 'specialWithholdingTax' | 'incomeTaxInstallment' | 'servicesTax',
  ATTLTaxAccountDetail
> = {
  wageIncomeTax: {
    portalName: 'Domestic Monthly Wages Income Tax',
    local: '286442.10.001',
    bnu: '00028644210001',
    iban: 'TL38 0020 0028 6442 1000 162',
  },
  specialWithholdingTax: {
    portalName: 'Domestic Withholding Tax',
    local: '286830.10.001',
    bnu: '00028683010001',
    iban: 'TL38 0020 0028 6830 1000 162',
  },
  incomeTaxInstallment: {
    portalName: 'Domestic Installment Tax',
    local: '286539.10.001',
    bnu: '00028653910001',
    iban: 'TL38 0020 0028 6539 1000 162',
  },
  servicesTax: {
    portalName: 'Domestic Services Tax',
    local: '286636.10.001',
    bnu: '00028663610001',
    iban: 'TL38 0020 0028 6636 1000 162',
  },
};

export type ATTLTaxAccountKey = keyof typeof ATTL_TAX_ACCOUNT_DETAILS;

/**
 * ATTL domestic tax payment accounts (BNU). `accounts` stays the IBAN map
 * existing payment orders were built against; prefer
 * `ATTL_TAX_ACCOUNT_DETAILS` for anything new, and
 * `attlBeneficiaryAccountLine()` to render whichever form actually exists.
 */
export const ATTL_TAX_ACCOUNTS = {
  beneficiary: 'National Directorate of Domestic Revenue-Tax Authority',
  bank: 'Banco Nacional Ultramarino (BNU)',
  swift: 'CGDITLDI',
  accounts: {
    wageIncomeTax: ATTL_TAX_ACCOUNT_DETAILS.wageIncomeTax.iban,
    specialWithholdingTax: ATTL_TAX_ACCOUNT_DETAILS.specialWithholdingTax.iban,
    incomeTaxInstallment: ATTL_TAX_ACCOUNT_DETAILS.incomeTaxInstallment.iban,
    servicesTax: ATTL_TAX_ACCOUNT_DETAILS.servicesTax.iban,
  },
} as const;

/**
 * How to name the beneficiary account on a payment order: the IBAN when one
 * has been sighted, otherwise the local A/C form the banks accept over the
 * counter and in BNUdireto.
 */
export function attlBeneficiaryAccountLine(key: ATTLTaxAccountKey): string {
  const account = ATTL_TAX_ACCOUNT_DETAILS[key];
  return account.iban ?? `A/C ${account.local}`;
}

/**
 * The credit description ("Descritivo movimento") on an ATTL transfer.
 *
 * ATTL reconciles a payment to a taxpayer by the TIN carried in this field,
 * and remittance evidence is overwhelmingly of the form `<TIN>_<SHORT NAME>`
 * — occasionally the bare TIN, occasionally free text naming the tax. BNU
 * truncates it, so the TIN goes FIRST and the whole string is capped: losing
 * the tail costs a period label, losing the head costs the taxpayer.
 */
export const ATTL_CREDIT_DESCRIPTION_MAX = 34;

export function formatAttlCreditDescription(input: {
  tin: string;
  /** Trading/short name, e.g. "RUSWIN". Omitted when unknown. */
  shortName?: string;
  /** Short tax label, e.g. "WIT", "AITI", "ST". */
  taxLabel?: string;
  /** Period reference already formatted for humans, e.g. "06/2026". */
  periodRef?: string;
}): string {
  const tin = (input.tin || '').trim() || '________';
  const shortName = (input.shortName || '').trim().replace(/\s+/g, ' ');
  const head = shortName ? `${tin}_${shortName}` : tin;
  const parts = [input.taxLabel, input.periodRef]
    .map((part) => (part || '').trim())
    .filter(Boolean);

  // Drop whole trailing parts rather than cutting one in half: a bank clerk
  // reading "AITI 0" learns less than nothing. Only the head is ever hard-cut,
  // and only when it alone is too long.
  for (let keep = parts.length; keep > 0; keep -= 1) {
    const candidate = `${head} ${parts.slice(0, keep).join(' ')}`;
    if (candidate.length <= ATTL_CREDIT_DESCRIPTION_MAX) return candidate;
  }
  return head.length <= ATTL_CREDIT_DESCRIPTION_MAX
    ? head
    : head.slice(0, ATTL_CREDIT_DESCRIPTION_MAX).trimEnd();
}
