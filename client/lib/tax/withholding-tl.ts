/**
 * Timor-Leste non-wage withholding tax calculations for domestic businesses.
 *
 * Legal basis: Taxes and Duties Act (Law 8/2008), Arts. 29(f), 53-60 and
 * Annex VIII. Petroleum-contractor taxation is intentionally outside this
 * module because it follows the separate regime in Part IX / Annex IX.
 */

import { applyRate, roundMoney, subtractMoney } from '@/lib/currency';

export type TLWithholdingCategory =
  | 'general_service'
  | 'construction'
  | 'construction_consulting'
  | 'air_or_sea_transport'
  | 'mining_or_mining_support'
  | 'royalty'
  | 'rent'
  | 'prize'
  | 'dividend';

export type TLWithholdingCollectionMethod =
  | 'payer_withholding'
  | 'recipient_self_withholding'
  | 'none';

export interface TLWithholdingConfig {
  nonResidentRate: number;
  royaltyRate: number;
  rentRate: number;
  prizeRate: number;
  specifiedServiceRates: Record<
    'construction' | 'construction_consulting' | 'air_or_sea_transport' | 'mining_or_mining_support',
    number
  >;
}

export const DEFAULT_TL_WITHHOLDING_CONFIG: TLWithholdingConfig = {
  nonResidentRate: 0.10,
  royaltyRate: 0.10,
  rentRate: 0.10,
  prizeRate: 0.10,
  specifiedServiceRates: {
    // All four rates are the printed Schedule VIII (PT: Anexo VIII) values of
    // Law 8/2008 Sec. 53.1: construction 2%, construction consulting 4%, air or
    // sea transport 2.64%, mining or mining support 4.5%. 2%/4% are additionally
    // corroborated by ATTL "Aviso de Avaliação" assessment notices (see
    // tests/client/attl-assessment-parity.test.ts); 2.64% is corroborated by a
    // real shipping-line self-assessment in the mail corpus. Verified against
    // the English full text of the Act (WTO accession docs) —
    // docs/TL_ACCOUNTING_EVIDENCE_MATRIX.md. NB: air/sea transport is
    // recipient-self-withheld (Sec. 53.3(b)) — handled below.
    construction: 0.02,
    construction_consulting: 0.04,
    air_or_sea_transport: 0.0264,
    mining_or_mining_support: 0.045,
  },
};

export interface TLWithholdingInput {
  grossAmount: number;
  category: TLWithholdingCategory;
  recipientResidence: 'resident' | 'non_resident';
  /** Art. 57 excludes income handled as a non-resident permanent establishment under Art. 52. */
  recipientHasTimorLestePermanentEstablishment: boolean;
  /** Art. 53(3) makes the recipient self-withhold specified-service tax for an individual payer. */
  payerIsIndividual: boolean;
  /** A documented treaty rate overrides the domestic rate for a non-resident recipient. */
  treatyRate?: number;
  taxRegime: 'domestic' | 'petroleum';
}

export interface TLWithholdingResult {
  grossAmount: number;
  rate: number;
  taxDue: number;
  withholdingTax: number;
  netPayment: number;
  collectionMethod: TLWithholdingCollectionMethod;
  legalBasis: string;
}

export class UnsupportedTLPetroleumTaxRegimeError extends Error {
  constructor() {
    // Petroleum is a wholly separate regime with its own rates, forms, filing
    // desk and payment rail — not a rate tweak on the domestic calculator:
    //  • Revised ToBUCA (Bayu-Undan / former JPDA): non-resident 18% flat, resident
    //    annual bands 10/15/30%.
    //  • TDA Art. 72.2 + Schedule IX (other petroleum): non-resident 20%, resident
    //    10% to $550/mo then 30%.
    // Filing goes to ATTL's petroleum-revenues directorate (DNRPM) by emailed
    // forms with payment to the TL Petroleum Fund — outside Xefe's domestic
    // e-Tax/INSS pipeline. See docs/MINED_SIGNOFF_ANSWERS_JUL2026.md §1.
    super(
      'Petroleum-sector tax is a separate regime (ToBUCA / TDA Schedule IX) filed to ' +
        "ATTL's petroleum-revenues directorate — it is outside Xefe's domestic withholding calculator.",
    );
    this.name = 'UnsupportedTLPetroleumTaxRegimeError';
  }
}

const specifiedServiceCategories = new Set<TLWithholdingCategory>([
  'construction',
  'construction_consulting',
  'air_or_sea_transport',
  'mining_or_mining_support',
]);

function assertRate(name: string, rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError(`${name} must be between 0 and 1.`);
  }
}

function validateConfig(config: TLWithholdingConfig): void {
  assertRate('Non-resident withholding rate', config.nonResidentRate);
  assertRate('Royalty withholding rate', config.royaltyRate);
  assertRate('Rent withholding rate', config.rentRate);
  assertRate('Prize withholding rate', config.prizeRate);
  for (const [category, rate] of Object.entries(config.specifiedServiceRates)) {
    assertRate(`${category} withholding rate`, rate);
  }
}

/**
 * Calculate the tax liability and the amount withheld from a supplier payment.
 * `taxDue` remains populated for Art. 53 recipient-self-withholding cases while
 * `withholdingTax` is zero, preventing Xefe from incorrectly reducing the payment.
 */
export function calculateTLWithholding(
  input: TLWithholdingInput,
  config: TLWithholdingConfig = DEFAULT_TL_WITHHOLDING_CONFIG,
): TLWithholdingResult {
  if (input.taxRegime === 'petroleum') {
    throw new UnsupportedTLPetroleumTaxRegimeError();
  }
  if (!Number.isFinite(input.grossAmount) || input.grossAmount < 0) {
    throw new RangeError('Gross payment must be a non-negative finite amount.');
  }
  validateConfig(config);
  if (input.treatyRate !== undefined) {
    assertRate('Treaty rate', input.treatyRate);
    if (input.recipientResidence !== 'non_resident') {
      throw new RangeError('A treaty rate can only be used for a non-resident recipient.');
    }
  }

  const grossAmount = roundMoney(input.grossAmount);
  let domesticRate = 0;
  let collectionMethod: TLWithholdingCollectionMethod = 'none';
  let legalBasis = 'Law 8/2008 Art. 60(1)';

  if (input.category === 'dividend') {
    // Dividends are exempt income under Art. 29(f), so the withholding section
    // does not apply by virtue of Art. 60(1).
    legalBasis = 'Law 8/2008 Arts. 29(f) and 60(1)';
  } else if (specifiedServiceCategories.has(input.category)) {
    const category = input.category as keyof TLWithholdingConfig['specifiedServiceRates'];
    domesticRate = config.specifiedServiceRates[category];
    collectionMethod =
      input.payerIsIndividual || input.category === 'air_or_sea_transport'
        ? 'recipient_self_withholding'
        : 'payer_withholding';
    legalBasis = 'Law 8/2008 Art. 53 and Annex VIII';
  } else if (input.category === 'royalty') {
    domesticRate = config.royaltyRate;
    collectionMethod = input.payerIsIndividual
      ? 'recipient_self_withholding'
      : 'payer_withholding';
    legalBasis = 'Law 8/2008 Art. 54';
  } else if (input.category === 'rent') {
    domesticRate = config.rentRate;
    collectionMethod = input.payerIsIndividual
      ? 'recipient_self_withholding'
      : 'payer_withholding';
    legalBasis = 'Law 8/2008 Art. 55';
  } else if (input.category === 'prize') {
    domesticRate = config.prizeRate;
    collectionMethod = 'payer_withholding';
    legalBasis = 'Law 8/2008 Art. 56';
  } else if (
    input.recipientResidence === 'non_resident' &&
    !input.recipientHasTimorLestePermanentEstablishment
  ) {
    domesticRate = config.nonResidentRate;
    collectionMethod = 'payer_withholding';
    legalBasis = 'Law 8/2008 Art. 57';
  } else if (
    input.recipientResidence === 'non_resident' &&
    input.recipientHasTimorLestePermanentEstablishment
  ) {
    legalBasis = 'Law 8/2008 Arts. 52 and 57';
  }

  const rate = input.treatyRate ?? domesticRate;
  const taxDue = applyRate(grossAmount, rate);
  const withholdingTax = collectionMethod === 'payer_withholding' ? taxDue : 0;

  return {
    grossAmount,
    rate,
    taxDue,
    withholdingTax,
    netPayment: subtractMoney(grossAmount, withholdingTax),
    collectionMethod,
    legalBasis,
  };
}
