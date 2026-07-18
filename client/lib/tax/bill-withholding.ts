/**
 * Supplier-withholding workflow for Timor-Leste vendor bills.
 *
 * Vendor facts are validated before a bill instruction is created. The
 * instruction freezes the classification, statutory rate, collection method,
 * and legal basis so later settlements remain auditable if application
 * defaults change.
 */

import {
  calculateTLWithholding,
  type TLWithholdingCategory,
  type TLWithholdingCollectionMethod,
} from '@/lib/tax/withholding-tl';
import {
  addMoney,
  applyRate,
  compareMoney,
  roundMoney,
  subtractMoney,
  toDecimal,
} from '@/lib/currency';
import type { BusinessType } from '@/types/settings';

export type TLBillWithholdingCategory = Exclude<TLWithholdingCategory, 'dividend'>;

export const TL_BILL_WITHHOLDING_CATEGORIES: readonly TLBillWithholdingCategory[] = [
  'general_service',
  'construction',
  'construction_consulting',
  'air_or_sea_transport',
  'mining_or_mining_support',
  'royalty',
  'rent',
  'prize',
] as const;

export interface TLVendorTaxProfile {
  recipientResidence: 'resident' | 'non_resident';
  taxRegime: 'domestic' | 'petroleum';
  /** Required for a non-resident. Irrelevant and normalized to false for a resident. */
  recipientHasTimorLestePermanentEstablishment?: boolean;
  /** Percentage as entered by a user (for example, 5 means 5%). */
  treatyRatePercent?: number;
  /** Documented treaty/article or other evidence supporting the override. */
  treatyReference?: string;
}

export interface TLBillWithholdingInstruction {
  version: 1;
  category: TLBillWithholdingCategory;
  recipientName: string;
  recipientTin?: string;
  recipientResidence: TLVendorTaxProfile['recipientResidence'];
  recipientHasTimorLestePermanentEstablishment: boolean;
  taxRegime: TLVendorTaxProfile['taxRegime'];
  treatyRate?: number;
  treatyRatePercent?: number;
  treatyReference?: string;
  payerBusinessType: BusinessType;
  payerIsIndividual: boolean;
  rate: number;
  collectionMethod: TLWithholdingCollectionMethod;
  legalBasis: string;
}

export interface TLBillWithholdingSnapshot extends TLBillWithholdingInstruction {
  grossAmount: number;
  taxDue: number;
  withholdingTax: number;
  netPayment: number;
}

export interface TLBillSettlement {
  grossAmount: number;
  cashPaid: number;
  taxDue: number;
  withholdingTax: number;
  withholding?: TLBillWithholdingSnapshot;
}

export type TLBillWithholdingTotals = Record<
  TLBillWithholdingCategory,
  { payment: number; tax: number; rates: number[] }
>;

export class IncompleteTLWithholdingSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncompleteTLWithholdingSetupError';
  }
}

function isBusinessType(value: unknown): value is BusinessType {
  return [
    'SA',
    'Lda',
    'Unipessoal',
    'ENIN',
    'NGO',
    'Government',
    'Other',
  ].includes(String(value));
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function assertValidTLBillWithholdingInstruction(
  instruction: TLBillWithholdingInstruction,
): void {
  if (
    instruction.version !== 1
    || !TL_BILL_WITHHOLDING_CATEGORIES.includes(instruction.category)
    || !instruction.recipientName?.trim()
    || !['resident', 'non_resident'].includes(instruction.recipientResidence)
    || typeof instruction.recipientHasTimorLestePermanentEstablishment !== 'boolean'
    || instruction.taxRegime !== 'domestic'
    || !isBusinessType(instruction.payerBusinessType)
    || instruction.payerBusinessType === 'Other'
    || typeof instruction.payerIsIndividual !== 'boolean'
    || !Number.isFinite(instruction.rate)
    || instruction.rate < 0
    || instruction.rate > 1
    || !['payer_withholding', 'recipient_self_withholding'].includes(
      instruction.collectionMethod,
    )
    || !instruction.legalBasis?.trim()
  ) {
    throw new Error('The bill contains an invalid supplier-withholding instruction.');
  }
}

/** Validate and normalize facts entered on a vendor record. */
export function normalizeTLVendorTaxProfile(
  profile: TLVendorTaxProfile | null | undefined,
): TLVendorTaxProfile {
  if (!profile) {
    throw new IncompleteTLWithholdingSetupError(
      'Add the vendor\'s tax residence and tax regime before selecting supplier withholding.',
    );
  }
  if (!['resident', 'non_resident'].includes(profile.recipientResidence)) {
    throw new IncompleteTLWithholdingSetupError('Select the vendor\'s tax residence.');
  }
  if (!['domestic', 'petroleum'].includes(profile.taxRegime)) {
    throw new IncompleteTLWithholdingSetupError('Select the vendor\'s tax regime.');
  }
  if (
    profile.recipientResidence === 'non_resident'
    && typeof profile.recipientHasTimorLestePermanentEstablishment !== 'boolean'
  ) {
    throw new IncompleteTLWithholdingSetupError(
      'Confirm whether the non-resident vendor has a permanent establishment in Timor-Leste.',
    );
  }

  const treatyReference = optionalTrimmed(profile.treatyReference);
  const hasTreatyRate = profile.treatyRatePercent !== undefined;
  if (profile.taxRegime === 'petroleum' && (hasTreatyRate || treatyReference)) {
    throw new IncompleteTLWithholdingSetupError(
      'Treaty withholding overrides are not supported for the petroleum tax regime.',
    );
  }
  if (hasTreatyRate) {
    if (
      !Number.isFinite(profile.treatyRatePercent)
      || profile.treatyRatePercent! < 0
      || profile.treatyRatePercent! > 100
    ) {
      throw new IncompleteTLWithholdingSetupError('Treaty rate must be between 0% and 100%.');
    }
    if (profile.recipientResidence !== 'non_resident') {
      throw new IncompleteTLWithholdingSetupError(
        'A treaty rate can only be recorded for a non-resident vendor.',
      );
    }
    if (profile.recipientHasTimorLestePermanentEstablishment) {
      throw new IncompleteTLWithholdingSetupError(
        'Do not apply a treaty withholding rate to a vendor recorded with a Timor-Leste permanent establishment.',
      );
    }
    if (!treatyReference) {
      throw new IncompleteTLWithholdingSetupError(
        'Add the treaty article or evidence supporting the treaty rate.',
      );
    }
  } else if (treatyReference) {
    throw new IncompleteTLWithholdingSetupError('Add the treaty rate supported by the treaty reference.');
  }

  return {
    recipientResidence: profile.recipientResidence,
    taxRegime: profile.taxRegime,
    recipientHasTimorLestePermanentEstablishment:
      profile.recipientResidence === 'non_resident'
        ? profile.recipientHasTimorLestePermanentEstablishment
        : false,
    ...(hasTreatyRate ? { treatyRatePercent: profile.treatyRatePercent } : {}),
    ...(treatyReference ? { treatyReference } : {}),
  };
}

/** Create the immutable classification stored on a bill. */
export function buildTLBillWithholdingInstruction(input: {
  category: TLBillWithholdingCategory;
  recipientName: string;
  recipientTin?: string;
  vendorTaxProfile?: TLVendorTaxProfile | null;
  payerBusinessType?: BusinessType;
  companyDetailsComplete: boolean;
}): TLBillWithholdingInstruction {
  if (!TL_BILL_WITHHOLDING_CATEGORIES.includes(input.category)) {
    throw new IncompleteTLWithholdingSetupError('Select a supported supplier-withholding category.');
  }
  if (!input.recipientName.trim()) {
    throw new IncompleteTLWithholdingSetupError('Vendor name is required for supplier withholding.');
  }
  if (!input.companyDetailsComplete || !isBusinessType(input.payerBusinessType)) {
    throw new IncompleteTLWithholdingSetupError(
      'Complete Company Details, including business type, before using supplier withholding.',
    );
  }
  if (input.payerBusinessType === 'Other') {
    throw new IncompleteTLWithholdingSetupError(
      'Choose a specific Company Details business type so Xefe can determine who must withhold.',
    );
  }

  const profile = normalizeTLVendorTaxProfile(input.vendorTaxProfile);
  const payerIsIndividual = input.payerBusinessType === 'ENIN';
  const treatyRate = profile.treatyRatePercent === undefined
    ? undefined
    : toDecimal(profile.treatyRatePercent).dividedBy(100).toNumber();
  const classification = calculateTLWithholding({
    grossAmount: 0,
    category: input.category,
    recipientResidence: profile.recipientResidence,
    recipientHasTimorLestePermanentEstablishment:
      profile.recipientHasTimorLestePermanentEstablishment ?? false,
    payerIsIndividual,
    ...(treatyRate === undefined ? {} : { treatyRate }),
    taxRegime: profile.taxRegime,
  });
  if (classification.collectionMethod === 'none') {
    throw new IncompleteTLWithholdingSetupError(
      'The selected category has no supplier withholding for the saved residence and permanent-establishment facts. Choose Not applicable.',
    );
  }

  const recipientTin = optionalTrimmed(input.recipientTin);
  return {
    version: 1,
    category: input.category,
    recipientName: input.recipientName.trim(),
    ...(recipientTin ? { recipientTin } : {}),
    recipientResidence: profile.recipientResidence,
    recipientHasTimorLestePermanentEstablishment:
      profile.recipientHasTimorLestePermanentEstablishment ?? false,
    taxRegime: profile.taxRegime,
    ...(treatyRate === undefined ? {} : { treatyRate }),
    ...(profile.treatyRatePercent === undefined
      ? {}
      : { treatyRatePercent: profile.treatyRatePercent }),
    ...(profile.treatyReference ? { treatyReference: profile.treatyReference } : {}),
    payerBusinessType: input.payerBusinessType,
    payerIsIndividual,
    rate: classification.rate,
    collectionMethod: classification.collectionMethod,
    legalBasis: classification.legalBasis,
  };
}

/** Split gross AP cleared into supplier cash and tax, using the frozen bill instruction. */
export function calculateTLBillSettlement(
  grossApplied: number,
  instruction?: TLBillWithholdingInstruction | null,
): TLBillSettlement {
  if (!Number.isFinite(grossApplied) || grossApplied < 0) {
    throw new RangeError('Gross bill settlement must be a non-negative finite amount.');
  }
  const grossAmount = roundMoney(grossApplied);
  if (!instruction) {
    return {
      grossAmount,
      cashPaid: grossAmount,
      taxDue: 0,
      withholdingTax: 0,
    };
  }
  assertValidTLBillWithholdingInstruction(instruction);

  const taxDue = applyRate(grossAmount, instruction.rate);
  const withholdingTax = instruction.collectionMethod === 'payer_withholding' ? taxDue : 0;
  const cashPaid = subtractMoney(grossAmount, withholdingTax);
  if (compareMoney(addMoney(cashPaid, withholdingTax), grossAmount) !== 0) {
    throw new Error('Supplier settlement is not balanced.');
  }

  return {
    grossAmount,
    cashPaid,
    taxDue,
    withholdingTax,
    withholding: {
      ...instruction,
      grossAmount,
      taxDue,
      withholdingTax,
      netPayment: cashPaid,
    },
  };
}

/** Aggregate payer-withheld settlements for Section 2 of the ATTL monthly form. */
export function aggregateTLBillWithholdingPayments(
  payments: ReadonlyArray<{ withholding?: TLBillWithholdingSnapshot | null }>,
): TLBillWithholdingTotals {
  const totals: TLBillWithholdingTotals = {
    general_service: { payment: 0, tax: 0, rates: [] },
    construction: { payment: 0, tax: 0, rates: [] },
    construction_consulting: { payment: 0, tax: 0, rates: [] },
    air_or_sea_transport: { payment: 0, tax: 0, rates: [] },
    mining_or_mining_support: { payment: 0, tax: 0, rates: [] },
    royalty: { payment: 0, tax: 0, rates: [] },
    rent: { payment: 0, tax: 0, rates: [] },
    prize: { payment: 0, tax: 0, rates: [] },
  };

  for (const payment of payments) {
    const withholding = payment.withholding;
    if (!withholding) {
      continue;
    }
    try {
      assertValidTLBillWithholdingInstruction(withholding);
    } catch {
      throw new Error('A supplier payment contains an invalid withholding snapshot.');
    }
    if (
      !Number.isFinite(withholding.grossAmount)
      || !Number.isFinite(withholding.taxDue)
      || !Number.isFinite(withholding.withholdingTax)
      || !Number.isFinite(withholding.netPayment)
      || compareMoney(withholding.taxDue, applyRate(withholding.grossAmount, withholding.rate)) !== 0
      || compareMoney(
        withholding.withholdingTax,
        withholding.collectionMethod === 'payer_withholding' ? withholding.taxDue : 0,
      ) !== 0
      || compareMoney(
        addMoney(withholding.netPayment, withholding.withholdingTax),
        withholding.grossAmount,
      ) !== 0
    ) {
      throw new Error('A supplier payment contains an invalid withholding snapshot.');
    }
    if (
      withholding.collectionMethod !== 'payer_withholding'
      || compareMoney(withholding.withholdingTax, 0) <= 0
    ) continue;
    const categoryTotal = totals[withholding.category];
    categoryTotal.payment = addMoney(categoryTotal.payment, withholding.grossAmount);
    categoryTotal.tax = addMoney(categoryTotal.tax, withholding.withholdingTax);
    if (!categoryTotal.rates.includes(withholding.rate)) {
      categoryTotal.rates.push(withholding.rate);
    }
  }

  return totals;
}

/** Map supplier-payment totals onto the official consolidated monthly form fields. */
export function mapTLBillWithholdingToATTL(totals: TLBillWithholdingTotals) {
  const include = (value: { payment: number; tax: number; rates: number[] }) => {
    if (compareMoney(value.tax, 0) <= 0) return undefined;
    if (value.rates.length !== 1) {
      throw new Error(
        'The official monthly form cannot combine different withholding rates on one tax line.',
      );
    }
    const ratePercent = toDecimal(value.rates[0]).times(100).toDecimalPlaces(4).toString();
    return {
      payment: value.payment,
      tax: value.tax,
      rateLabel: `${ratePercent}%`,
    };
  };

  return {
    prizesLotteries: include(totals.prize),
    royalties: include(totals.royalty),
    rentLandBuildings: include(totals.rent),
    constructionActivities: include(totals.construction),
    constructionConsulting: include(totals.construction_consulting),
    miningServices: include(totals.mining_or_mining_support),
    airSeaTransport: include(totals.air_or_sea_transport),
    nonResidentPayments: include(totals.general_service),
  };
}
