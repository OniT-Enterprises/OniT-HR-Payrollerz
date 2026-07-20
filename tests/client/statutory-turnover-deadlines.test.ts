import { describe, expect, it } from 'vitest';
import {
  getInstallmentTaxDueDateBase,
  getMonthlyServicesTaxDueDateBase,
  isQuarterEndMonth,
} from '@/lib/tax/compliance';
import {
  calculateTLServicesTax,
  isTLServicesTaxLiableSector,
  mapSectorReceiptsToDesignatedServices,
} from '@/lib/tax/services-tax-tl';

describe('Services-tax filing support (Law 8/2008 Secs. 5-9)', () => {
  it('treats only hotel and restaurant sectors as auto-derivable liable sectors', () => {
    expect(isTLServicesTaxLiableSector('hotel')).toBe(true);
    expect(isTLServicesTaxLiableSector('restaurant')).toBe(true);
    // Telecoms are designated in law but not Xefe's market — never auto-derived.
    expect(isTLServicesTaxLiableSector('technology')).toBe(false);
    expect(isTLServicesTaxLiableSector('trading')).toBe(false);
    expect(isTLServicesTaxLiableSector(undefined)).toBe(false);
    expect(isTLServicesTaxLiableSector(null)).toBe(false);
  });

  it('maps a hotel tenant’s monthly receipts to the hotel bucket', () => {
    const receipts = mapSectorReceiptsToDesignatedServices('hotel', 1200);
    expect(receipts).toEqual({
      hotelServices: 1200,
      restaurantBarServices: 0,
      telecommunicationsServices: 0,
    });
  });

  it('maps a restaurant tenant’s monthly receipts to the restaurant/bar bucket', () => {
    const receipts = mapSectorReceiptsToDesignatedServices('restaurant', 640.5);
    expect(receipts).toEqual({
      hotelServices: 0,
      restaurantBarServices: 640.5,
      telecommunicationsServices: 0,
    });
  });

  it('maps non-liable sectors to zero receipts (Section 3 stays empty)', () => {
    expect(mapSectorReceiptsToDesignatedServices('construction', 9999)).toEqual({
      hotelServices: 0,
      restaurantBarServices: 0,
      telecommunicationsServices: 0,
    });
  });

  it('feeds the 5%-at-$500 engine end to end: 0% below, 5% on the TOTAL at/above', () => {
    const below = calculateTLServicesTax(mapSectorReceiptsToDesignatedServices('restaurant', 499.99));
    expect(below.taxDue).toBe(0);

    const at = calculateTLServicesTax(mapSectorReceiptsToDesignatedServices('restaurant', 500));
    expect(at.taxDue).toBe(25); // 5% of the WHOLE $500, not just the excess

    const above = calculateTLServicesTax(mapSectorReceiptsToDesignatedServices('hotel', 2000));
    expect(above.taxDue).toBe(100);
  });

  it('rejects a negative receipts total instead of mapping it', () => {
    expect(() => mapSectorReceiptsToDesignatedServices('hotel', -1)).toThrow(RangeError);
  });

  it('puts the monthly form + payment deadline on day 15 of the following month', () => {
    expect(getMonthlyServicesTaxDueDateBase('2026-06')).toBe('2026-07-15');
    expect(getMonthlyServicesTaxDueDateBase('2026-12')).toBe('2027-01-15');
  });
});

describe('Income-tax installment deadline support (Law 8/2008 Art. 64)', () => {
  it('is due day 15 after the period ends', () => {
    expect(getInstallmentTaxDueDateBase('2026-03')).toBe('2026-04-15');
    expect(getInstallmentTaxDueDateBase('2026-12')).toBe('2027-01-15');
  });

  it('identifies quarter-end months for quarterly payers', () => {
    expect(isQuarterEndMonth('2026-03')).toBe(true);
    expect(isQuarterEndMonth('2026-06')).toBe(true);
    expect(isQuarterEndMonth('2026-09')).toBe(true);
    expect(isQuarterEndMonth('2026-12')).toBe(true);
    expect(isQuarterEndMonth('2026-01')).toBe(false);
    expect(isQuarterEndMonth('2026-11')).toBe(false);
  });
});
