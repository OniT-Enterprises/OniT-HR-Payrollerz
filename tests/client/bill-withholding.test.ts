import { describe, expect, it } from 'vitest';
import {
  IncompleteTLWithholdingSetupError,
  aggregateTLBillWithholdingPayments,
  buildTLBillWithholdingInstruction,
  calculateTLBillSettlement,
  mapTLBillWithholdingToATTL,
  normalizeTLVendorTaxProfile,
  type TLBillWithholdingCategory,
  type TLBillWithholdingSnapshot,
  type TLVendorTaxProfile,
} from '@/lib/tax/bill-withholding';
import { UnsupportedTLPetroleumTaxRegimeError } from '@/lib/tax/withholding-tl';
import { calculateBillPaymentPostingAmounts } from '@/lib/accounting/calculations';
import { getDefaultAccounts } from '@/lib/accounting/chart-of-accounts';

const residentProfile: TLVendorTaxProfile = {
  recipientResidence: 'resident',
  taxRegime: 'domestic',
};

const nonResidentProfile: TLVendorTaxProfile = {
  recipientResidence: 'non_resident',
  recipientHasTimorLestePermanentEstablishment: false,
  taxRegime: 'domestic',
};

function instruction(
  category: TLBillWithholdingCategory,
  profile: TLVendorTaxProfile = residentProfile,
  payerBusinessType: 'Lda' | 'ENIN' = 'Lda',
) {
  return buildTLBillWithholdingInstruction({
    category,
    recipientName: 'Synthetic Supplier',
    recipientTin: '0000000',
    vendorTaxProfile: profile,
    payerBusinessType,
    companyDetailsComplete: true,
  });
}

describe('strict vendor and payer facts', () => {
  it('requires a configured vendor profile and completed company details', () => {
    expect(() => buildTLBillWithholdingInstruction({
      category: 'rent',
      recipientName: 'Synthetic Supplier',
      payerBusinessType: 'Lda',
      companyDetailsComplete: true,
    })).toThrow(IncompleteTLWithholdingSetupError);

    expect(() => buildTLBillWithholdingInstruction({
      category: 'rent',
      recipientName: 'Synthetic Supplier',
      vendorTaxProfile: residentProfile,
      payerBusinessType: 'Lda',
      companyDetailsComplete: false,
    })).toThrow(/Complete Company Details/);

    expect(() => buildTLBillWithholdingInstruction({
      category: 'rent',
      recipientName: 'Synthetic Supplier',
      vendorTaxProfile: residentProfile,
      payerBusinessType: 'Other',
      companyDetailsComplete: true,
    })).toThrow(/specific Company Details business type/);
  });

  it('rejects a withholding category that is inapplicable to the saved vendor facts', () => {
    expect(() => instruction('general_service', residentProfile)).toThrow(/no supplier withholding/);
    expect(() => instruction('general_service', {
      ...nonResidentProfile,
      recipientHasTimorLestePermanentEstablishment: true,
    })).toThrow(/no supplier withholding/);
  });

  it('requires an explicit permanent-establishment answer for a non-resident', () => {
    expect(() => normalizeTLVendorTaxProfile({
      recipientResidence: 'non_resident',
      taxRegime: 'domestic',
    })).toThrow(/permanent establishment/);
  });

  it('requires treaty evidence and rejects inconsistent treaty facts', () => {
    expect(() => normalizeTLVendorTaxProfile({
      ...nonResidentProfile,
      treatyRatePercent: 5,
    })).toThrow(/treaty article or evidence/);

    expect(() => normalizeTLVendorTaxProfile({
      ...residentProfile,
      treatyRatePercent: 5,
      treatyReference: 'Synthetic treaty Art. 1',
    })).toThrow(/non-resident/);

    expect(() => normalizeTLVendorTaxProfile({
      ...nonResidentProfile,
      recipientHasTimorLestePermanentEstablishment: true,
      treatyRatePercent: 5,
      treatyReference: 'Synthetic treaty Art. 1',
    })).toThrow(/permanent establishment/);
  });

  it('fails closed for the separate petroleum regime', () => {
    expect(() => instruction('construction', {
      recipientResidence: 'resident',
      taxRegime: 'petroleum',
    })).toThrow(UnsupportedTLPetroleumTaxRegimeError);
  });
});

describe('supplier bill settlement', () => {
  it.each([
    ['construction', 0.02, 20],
    ['construction_consulting', 0.04, 40],
    ['mining_or_mining_support', 0.045, 45],
    ['royalty', 0.10, 100],
    ['rent', 0.10, 100],
    ['prize', 0.10, 100],
  ] as const)('applies the verified %s payer-withholding rate', (category, rate, tax) => {
    const billInstruction = instruction(category);
    const settlement = calculateTLBillSettlement(1_000, billInstruction);

    expect(billInstruction.rate).toBe(rate);
    expect(settlement.taxDue).toBe(tax);
    expect(settlement.withholdingTax).toBe(tax);
    expect(settlement.cashPaid).toBe(1_000 - tax);
    expect(settlement.cashPaid + settlement.withholdingTax).toBe(1_000);
  });

  it('withholds 10% for a non-resident general service without a TL PE', () => {
    const settlement = calculateTLBillSettlement(
      1_000,
      instruction('general_service', nonResidentProfile),
    );
    expect(settlement.withholdingTax).toBe(100);
    expect(settlement.cashPaid).toBe(900);
  });

  it('uses a documented treaty rate frozen on the bill', () => {
    const treatyInstruction = instruction('general_service', {
      ...nonResidentProfile,
      treatyRatePercent: 5,
      treatyReference: 'Synthetic treaty Art. 1',
    });
    const settlement = calculateTLBillSettlement(1_000, treatyInstruction);

    expect(treatyInstruction.rate).toBe(0.05);
    expect(treatyInstruction.treatyReference).toBe('Synthetic treaty Art. 1');
    expect(settlement.withholdingTax).toBe(50);
    expect(settlement.cashPaid).toBe(950);
  });

  it('does not reduce cash or create payer withholding for an ENIN self-withholding case', () => {
    const settlement = calculateTLBillSettlement(
      1_000,
      instruction('construction', residentProfile, 'ENIN'),
    );
    expect(settlement.withholding?.collectionMethod).toBe('recipient_self_withholding');
    expect(settlement.taxDue).toBe(20);
    expect(settlement.withholdingTax).toBe(0);
    expect(settlement.cashPaid).toBe(1_000);
  });

  it('treats air and sea transport as recipient self-withholding', () => {
    const settlement = calculateTLBillSettlement(
      1_000,
      instruction('air_or_sea_transport'),
    );
    expect(settlement.taxDue).toBe(26.40);
    expect(settlement.withholdingTax).toBe(0);
    expect(settlement.cashPaid).toBe(1_000);
  });

  it('keeps gross AP settlement separate from supplier cash on a partial payment', () => {
    const settlement = calculateTLBillSettlement(
      333.33,
      instruction('construction_consulting'),
    );
    expect(settlement.grossAmount).toBe(333.33);
    expect(settlement.withholdingTax).toBe(13.33);
    expect(settlement.cashPaid).toBe(320);
    expect(settlement.cashPaid + settlement.withholdingTax).toBe(333.33);
  });

  it('leaves an ordinary bill payment unchanged when withholding is not selected', () => {
    expect(calculateTLBillSettlement(123.45)).toEqual({
      grossAmount: 123.45,
      cashPaid: 123.45,
      taxDue: 0,
      withholdingTax: 0,
    });
  });

  it('rejects a malformed frozen instruction instead of guessing', () => {
    const malformed = { ...instruction('rent'), rate: Number.NaN };
    expect(() => calculateTLBillSettlement(100, malformed)).toThrow(/invalid/);
  });

  it('produces the balanced AP, cash, and tax amounts used by the journal', () => {
    const settlement = calculateTLBillSettlement(1_000, instruction('construction_consulting'));
    expect(calculateBillPaymentPostingAmounts(
      settlement.grossAmount,
      settlement.cashPaid,
      settlement.withholdingTax,
    )).toEqual({ grossAmount: 1_000, cashPaid: 960, withholdingTax: 40 });
    expect(() => calculateBillPaymentPostingAmounts(1_000, 950, 40)).toThrow(/must balance/);
  });

  it('ships a dedicated system liability account separate from payroll WIT', () => {
    const accounts = getDefaultAccounts();
    const supplierWht = accounts.find((account) => account.code === '2320');
    expect(supplierWht).toMatchObject({
      name: 'Supplier Withholding Tax Payable',
      type: 'liability',
      subType: 'tax_payable',
      isSystem: true,
    });
    expect(supplierWht?.code).not.toBe('2220');
  });
});

describe('ATTL monthly supplier-withholding aggregation', () => {
  it('aggregates payer withholding by statutory line and excludes recipient self-withholding', () => {
    const constructionOne = calculateTLBillSettlement(
      1_000,
      instruction('construction'),
    ).withholding!;
    const constructionTwo = calculateTLBillSettlement(
      250,
      instruction('construction'),
    ).withholding!;
    const supplierSelfWithholds = calculateTLBillSettlement(
      500,
      instruction('construction', residentProfile, 'ENIN'),
    ).withholding!;
    const treatyPayment = calculateTLBillSettlement(
      2_000,
      instruction('general_service', {
        ...nonResidentProfile,
        treatyRatePercent: 5,
        treatyReference: 'Synthetic treaty Art. 1',
      }),
    ).withholding!;

    const totals = aggregateTLBillWithholdingPayments([
      { withholding: constructionOne },
      { withholding: constructionTwo },
      { withholding: supplierSelfWithholds },
      { withholding: treatyPayment },
      {},
    ]);
    expect(totals.construction).toEqual({ payment: 1_250, tax: 25, rates: [0.02] });
    expect(totals.general_service).toEqual({ payment: 2_000, tax: 100, rates: [0.05] });

    const formData = mapTLBillWithholdingToATTL(totals);
    expect(formData.constructionActivities).toEqual({
      payment: 1_250,
      tax: 25,
      rateLabel: '2%',
    });
    expect(formData.nonResidentPayments).toEqual({
      payment: 2_000,
      tax: 100,
      rateLabel: '5%',
    });
  });

  it('refuses to collapse different rates into one official-form line', () => {
    const statutory = calculateTLBillSettlement(
      1_000,
      instruction('general_service', nonResidentProfile),
    ).withholding!;
    const treaty = calculateTLBillSettlement(
      1_000,
      instruction('general_service', {
        ...nonResidentProfile,
        treatyRatePercent: 5,
        treatyReference: 'Synthetic treaty Art. 1',
      }),
    ).withholding!;
    const totals = aggregateTLBillWithholdingPayments([
      { withholding: statutory },
      { withholding: treaty },
    ]);
    expect(() => mapTLBillWithholdingToATTL(totals)).toThrow(/different withholding rates/);
  });

  it('rejects malformed stored snapshots instead of silently omitting them', () => {
    const malformed = {
      ...calculateTLBillSettlement(100, instruction('rent')).withholding!,
      category: 'unknown',
    } as unknown as TLBillWithholdingSnapshot;
    expect(() => aggregateTLBillWithholdingPayments([{ withholding: malformed }])).toThrow(
      /invalid withholding snapshot/,
    );
  });
});
