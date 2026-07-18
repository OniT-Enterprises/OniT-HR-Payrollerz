import { describe, expect, it } from 'vitest';
import {
  getTaxClearanceDisplayStatus,
  needsTaxClearanceOneMonthCoordination,
  validateTaxClearanceIssued,
  validateTaxClearanceRequest,
} from '@/lib/tax/tax-clearance-tl';

describe('ATTL tax-clearance tracking', () => {
  it('accepts only the four official domestic certificate purposes', () => {
    expect(validateTaxClearanceRequest({
      purpose: 'commercial_3_months',
      requestedDate: '2026-07-17',
      notes: '  tender evidence  ',
    })).toEqual({
      purpose: 'commercial_3_months',
      requestedDate: '2026-07-17',
      notes: 'tender evidence',
    });
    expect(() => validateTaxClearanceRequest({
      purpose: 'unknown' as 'commercial_3_months',
      requestedDate: '2026-07-17',
    })).toThrow(/official ATTL/i);
  });

  it('flags the one-month variants for required ATTL coordination', () => {
    expect(needsTaxClearanceOneMonthCoordination('commercial_1_month')).toBe(true);
    expect(needsTaxClearanceOneMonthCoordination('visa_1_month')).toBe(true);
    expect(needsTaxClearanceOneMonthCoordination('commercial_3_months')).toBe(false);
  });

  it('requires explicit issue, expiry, and official PDF evidence', () => {
    const result = validateTaxClearanceIssued(
      { requestedDate: '2026-07-01' },
      {
        issuedDate: '2026-07-02',
        expiryDate: '2026-10-02',
        certificateNumber: ' CD-100 ',
        certificateUrl: ' https://storage.example/certificate.pdf ',
      },
    );
    expect(result).toEqual({
      issuedDate: '2026-07-02',
      expiryDate: '2026-10-02',
      certificateNumber: 'CD-100',
      certificateUrl: 'https://storage.example/certificate.pdf',
    });
    expect(() => validateTaxClearanceIssued(
      { requestedDate: '2026-07-01' },
      { issuedDate: '2026-07-02', expiryDate: '2026-10-02', certificateUrl: '' },
    )).toThrow(/upload/i);
  });

  it('rejects guessed or impossible certificate dates', () => {
    expect(() => validateTaxClearanceIssued(
      { requestedDate: '2026-07-10' },
      { issuedDate: '2026-07-09', expiryDate: '2026-10-09', certificateUrl: 'proof' },
    )).toThrow(/before the request/i);
    expect(() => validateTaxClearanceIssued(
      { requestedDate: '2026-07-10' },
      { issuedDate: '2026-07-10', expiryDate: '2026-07-10', certificateUrl: 'proof' },
    )).toThrow(/after the issue/i);
  });

  it('derives expiry without mutating the stored issued evidence', () => {
    expect(getTaxClearanceDisplayStatus(
      { status: 'issued', expiryDate: '2026-08-01' },
      '2026-08-01',
    )).toBe('issued');
    expect(getTaxClearanceDisplayStatus(
      { status: 'issued', expiryDate: '2026-08-01' },
      '2026-08-02',
    )).toBe('expired');
  });
});
