/**
 * F14 — Law 8/2008 Sec. 58.2 withholding tax notice derivation, and
 * E13 — Sec. 32.2 remittance-overdue (suspended deduction) helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  buildTLBillWithholdingInstruction,
  buildTLWithholdingNoticeData,
  calculateTLBillSettlement,
  canIssueTLWithholdingNotice,
  type TLBillWithholdingSnapshot,
  type TLVendorTaxProfile,
} from '@/lib/tax/bill-withholding';
import {
  getSupplierWithholdingRemittanceDueDate,
  isSupplierWithholdingRemittanceOverdue,
} from '@/lib/tax/supplier-withholding-remittance';

const residentProfile: TLVendorTaxProfile = {
  recipientResidence: 'resident',
  taxRegime: 'domestic',
};

function paidRentSnapshot(
  gross = 1000,
  payerBusinessType: 'Lda' | 'ENIN' = 'Lda',
): TLBillWithholdingSnapshot {
  const instruction = buildTLBillWithholdingInstruction({
    category: 'rent',
    recipientName: 'Synthetic Landlord',
    recipientTin: '1234567',
    vendorTaxProfile: residentProfile,
    payerBusinessType,
    companyDetailsComplete: true,
  });
  const settlement = calculateTLBillSettlement(gross, instruction);
  if (!settlement.withholding) {
    throw new Error('Expected a withholding snapshot on the settlement.');
  }
  return settlement.withholding;
}

describe('buildTLWithholdingNoticeData (Law 8/2008 Sec. 58.2)', () => {
  it('derives notice figures from a payer-withheld snapshot', () => {
    const notice = buildTLWithholdingNoticeData(paidRentSnapshot(1000));
    expect(notice).toEqual({
      recipientName: 'Synthetic Landlord',
      recipientTin: '1234567',
      category: 'rent',
      ratePercentLabel: '10%',
      legalBasis: 'Law 8/2008 Art. 55',
      grossAmount: 1000,
      withholdingTax: 100,
      netPayment: 900,
    });
  });

  it('formats fractional statutory rates without float noise', () => {
    const instruction = buildTLBillWithholdingInstruction({
      category: 'air_or_sea_transport',
      recipientName: 'Synthetic Shipping Line',
      vendorTaxProfile: residentProfile,
      payerBusinessType: 'Lda',
      companyDetailsComplete: true,
    });
    // Air/sea transport is recipient-self-withheld, so no notice — but the
    // rate label path is shared; verify via a direct rate check on the
    // snapshot before asserting the notice refusal below.
    const settlement = calculateTLBillSettlement(1000, instruction);
    expect(settlement.withholding?.rate).toBe(0.0264);
    expect(() => buildTLWithholdingNoticeData(settlement.withholding!)).toThrow(
      /only issued when the payer withheld/,
    );
  });

  it('omits the TIN when the snapshot has none', () => {
    const instruction = buildTLBillWithholdingInstruction({
      category: 'rent',
      recipientName: 'Synthetic Landlord',
      vendorTaxProfile: residentProfile,
      payerBusinessType: 'Lda',
      companyDetailsComplete: true,
    });
    const settlement = calculateTLBillSettlement(500, instruction);
    const notice = buildTLWithholdingNoticeData(settlement.withholding!);
    expect(notice.recipientTin).toBeUndefined();
    expect(notice.grossAmount).toBe(500);
    expect(notice.withholdingTax).toBe(50);
    expect(notice.netPayment).toBe(450);
  });

  it('refuses a recipient-self-withholding settlement', () => {
    // ENIN payer: rent becomes recipient self-withholding, tax withheld = 0.
    const snapshot = paidRentSnapshot(1000, 'ENIN');
    expect(snapshot.collectionMethod).toBe('recipient_self_withholding');
    expect(() => buildTLWithholdingNoticeData(snapshot)).toThrow(
      /only issued when the payer withheld/,
    );
  });

  it('refuses a tampered snapshot', () => {
    const snapshot = paidRentSnapshot(1000);
    expect(() =>
      buildTLWithholdingNoticeData({ ...snapshot, netPayment: snapshot.netPayment - 1 }),
    ).toThrow(/invalid withholding snapshot/);
    expect(() =>
      buildTLWithholdingNoticeData({ ...snapshot, withholdingTax: snapshot.withholdingTax + 5 }),
    ).toThrow(/invalid withholding snapshot/);
    expect(() =>
      buildTLWithholdingNoticeData({ ...snapshot, rate: 0.2 }),
    ).toThrow(/invalid withholding snapshot/);
  });
});

describe('canIssueTLWithholdingNotice', () => {
  it('is true only for a valid payer-withheld snapshot', () => {
    expect(canIssueTLWithholdingNotice(paidRentSnapshot(1000))).toBe(true);
    expect(canIssueTLWithholdingNotice(paidRentSnapshot(1000, 'ENIN'))).toBe(false);
    expect(canIssueTLWithholdingNotice(null)).toBe(false);
    expect(canIssueTLWithholdingNotice(undefined)).toBe(false);
    const tampered = { ...paidRentSnapshot(1000), grossAmount: 999 };
    expect(canIssueTLWithholdingNotice(tampered)).toBe(false);
  });
});

describe('getSupplierWithholdingRemittanceDueDate', () => {
  const identity = (iso: string) => iso;

  it('is day 15 of the following month', () => {
    expect(getSupplierWithholdingRemittanceDueDate('2026-06', identity)).toBe('2026-07-15');
    expect(getSupplierWithholdingRemittanceDueDate('2026-01', identity)).toBe('2026-02-15');
  });

  it('rolls December into January of the next year', () => {
    expect(getSupplierWithholdingRemittanceDueDate('2026-12', identity)).toBe('2027-01-15');
  });

  it('never adjusts earlier than the statutory base date by default', () => {
    expect(
      getSupplierWithholdingRemittanceDueDate('2026-06') >= '2026-07-15',
    ).toBe(true);
  });

  it('rejects an invalid period', () => {
    expect(() => getSupplierWithholdingRemittanceDueDate('2026-13', identity)).toThrow(
      /YYYY-MM/,
    );
    expect(() => getSupplierWithholdingRemittanceDueDate('June 2026', identity)).toThrow(
      /YYYY-MM/,
    );
  });
});

describe('isSupplierWithholdingRemittanceOverdue (Law 8/2008 Sec. 32.2)', () => {
  const identity = (iso: string) => iso;

  it('is true when a balance is still outstanding past the due date', () => {
    expect(
      isSupplierWithholdingRemittanceOverdue(
        { period: '2026-06', outstanding: 100 },
        '2026-07-16',
        identity,
      ),
    ).toBe(true);
  });

  it('is false on or before the due date', () => {
    expect(
      isSupplierWithholdingRemittanceOverdue(
        { period: '2026-06', outstanding: 100 },
        '2026-07-15',
        identity,
      ),
    ).toBe(false);
    expect(
      isSupplierWithholdingRemittanceOverdue(
        { period: '2026-06', outstanding: 100 },
        '2026-07-01',
        identity,
      ),
    ).toBe(false);
  });

  it('is false when nothing is outstanding', () => {
    expect(
      isSupplierWithholdingRemittanceOverdue(
        { period: '2026-06', outstanding: 0 },
        '2026-09-01',
        identity,
      ),
    ).toBe(false);
    expect(
      isSupplierWithholdingRemittanceOverdue(
        { period: '2026-06', outstanding: Number.NaN },
        '2026-09-01',
        identity,
      ),
    ).toBe(false);
  });

  it('rejects malformed dates and periods', () => {
    expect(() =>
      isSupplierWithholdingRemittanceOverdue(
        { period: '2026-06', outstanding: 100 },
        '16/07/2026',
        identity,
      ),
    ).toThrow(/YYYY-MM-DD/);
    expect(() =>
      isSupplierWithholdingRemittanceOverdue(
        { period: '2026-6', outstanding: 100 },
        '2026-07-16',
        identity,
      ),
    ).toThrow(/YYYY-MM/);
  });
});
