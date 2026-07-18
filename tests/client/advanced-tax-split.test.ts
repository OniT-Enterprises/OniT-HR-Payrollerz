/**
 * Audience split: the showAdvancedTax gate.
 *
 * Pins that accountant-only navigation entries stay hidden on the simple
 * flow (the default) and appear only with showAdvancedTax, and that the
 * statutory guard classifier flags exactly the strict-reader errors.
 */
import { describe, expect, it } from 'vitest';

import {
  filterModuleNavConfigByPermissions,
  payrollNavConfig,
  moneyNavConfig,
} from '@/lib/moduleNav';
import {
  getStatutoryReviewFlag,
  MissingStatutoryPayrollDataError,
  MissingStatutorySourceDataError,
  requireStatutoryPayrollAmount,
} from '@/lib/tax/statutory-payroll-record';

const allModules = () => true;

function subPagePaths(config: typeof payrollNavConfig, sectionId: string): string[] {
  const section = config.sections.find((s) => s.id === sectionId);
  return (section?.subPages ?? []).map((p) => p.path);
}

describe('advancedTaxOnly navigation gating', () => {
  it('hides Monthly WIT and Tax Clearance on the simple flow (default)', () => {
    const filtered = filterModuleNavConfigByPermissions(payrollNavConfig, allModules, true, true);
    const paths = subPagePaths(filtered, 'tax');
    expect(paths).not.toContain('/payroll/tax/monthly-wit');
    expect(paths).not.toContain('/payroll/tax/clearance');
    // INSS filings are every employer's obligation — must stay visible
    expect(paths).toContain('/payroll/tax/inss-monthly');
    expect(paths).toContain('/payroll/tax/inss-annual');
  });

  it('shows the accountant entries when showAdvancedTax is true', () => {
    const filtered = filterModuleNavConfigByPermissions(payrollNavConfig, allModules, true, true, true);
    const paths = subPagePaths(filtered, 'tax');
    expect(paths).toContain('/payroll/tax/monthly-wit');
    expect(paths).toContain('/payroll/tax/clearance');
  });

  it('gates VAT Returns in the money financial reports', () => {
    const simple = filterModuleNavConfigByPermissions(moneyNavConfig, allModules, true, true);
    expect(subPagePaths(simple, 'financial-reports')).not.toContain('/money/financials/vat-returns');

    const advanced = filterModuleNavConfigByPermissions(moneyNavConfig, allModules, true, true, true);
    expect(subPagePaths(advanced, 'financial-reports')).toContain('/money/financials/vat-returns');
  });
});

describe('getStatutoryReviewFlag', () => {
  it('classifies both strict-reader error types by field', () => {
    expect(getStatutoryReviewFlag(new MissingStatutoryPayrollDataError('wagesPaid')))
      .toEqual({ field: 'wagesPaid' });
    expect(getStatutoryReviewFlag(new MissingStatutorySourceDataError('employer NIF/TIN')))
      .toEqual({ field: 'employer NIF/TIN' });
  });

  it('classifies errors thrown by the readers themselves', () => {
    let thrown: unknown;
    try {
      requireStatutoryPayrollAmount({}, 'inssBase');
    } catch (error) {
      thrown = error;
    }
    expect(getStatutoryReviewFlag(thrown)).toEqual({ field: 'inssBase' });
  });

  it('returns null for anything else', () => {
    expect(getStatutoryReviewFlag(new RangeError('nope'))).toBeNull();
    expect(getStatutoryReviewFlag(new Error('generic'))).toBeNull();
    expect(getStatutoryReviewFlag(undefined)).toBeNull();
  });
});
