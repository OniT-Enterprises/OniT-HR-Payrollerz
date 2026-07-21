/**
 * Audience split: the showAdvancedTax gate.
 *
 * Pins that accountant-only navigation entries stay hidden on the simple
 * flow (the default) and appear only with showAdvancedTax, and that the
 * statutory guard classifier flags exactly the strict-reader errors.
 */
import { describe, expect, it } from 'vitest';

import {
  accountingNavConfig,
  filterModuleNavConfigByPermissions,
  payrollNavConfig,
  type ModuleNavConfig,
} from '@/lib/moduleNav';
import {
  getStatutoryReviewFlag,
  MissingStatutoryPayrollDataError,
  MissingStatutorySourceDataError,
  requireStatutoryPayrollAmount,
} from '@/lib/tax/statutory-payroll-record';

const allModules = () => true;

function subPagePaths(config: ModuleNavConfig, sectionId: string): string[] {
  const section = config.sections.find((s) => s.id === sectionId);
  return (section?.subPages ?? []).map((p) => p.path);
}

describe('advancedTaxOnly navigation gating', () => {
  it('keeps the simple payroll flow focused on INSS', () => {
    const filtered = filterModuleNavConfigByPermissions(payrollNavConfig, allModules, true, true);
    const paths = subPagePaths(filtered, 'tax');
    expect(paths).not.toContain('/payroll/tax/monthly-wit');
    // INSS filings are every employer's obligation — must stay visible
    expect(paths).toContain('/payroll/tax/inss-monthly');
    expect(paths).toContain('/payroll/tax/inss-annual');
  });

  it('shows advanced payroll WIT without mixing in business tax', () => {
    const filtered = filterModuleNavConfigByPermissions(payrollNavConfig, allModules, true, true, true);
    const paths = subPagePaths(filtered, 'tax');
    expect(paths).toContain('/payroll/tax/monthly-wit');
    expect(paths).not.toContain('/payroll/tax/clearance');
    expect(paths).not.toContain('/payroll/tax/annual-income-tax');
  });

  it('puts annual business tax in Accounting and gates specialist filings', () => {
    const simple = filterModuleNavConfigByPermissions(accountingNavConfig, allModules, true, true);
    const simplePaths = subPagePaths(simple, 'business-tax');
    expect(simplePaths).toContain('/accounting/tax/annual-income-tax');
    expect(simplePaths).not.toContain('/accounting/tax/clearance');
    expect(simplePaths).not.toContain('/accounting/tax/vat-returns');

    const advanced = filterModuleNavConfigByPermissions(accountingNavConfig, allModules, true, true, true);
    const advancedPaths = subPagePaths(advanced, 'business-tax');
    expect(advancedPaths).toContain('/accounting/tax/annual-income-tax');
    expect(advancedPaths).toContain('/accounting/tax/clearance');
    expect(advancedPaths).toContain('/accounting/tax/vat-returns');
    expect(advancedPaths).toContain('/accounting/tax/vat-settings');
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
