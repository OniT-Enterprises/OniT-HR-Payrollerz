import { describe, expect, it } from 'vitest';
import { isSafeQueryCacheKey } from '../../client/lib/queryCachePolicy';

describe('browser query cache policy', () => {
  it('allows harmless reference data and UI preferences', () => {
    expect(isSafeQueryCacheKey('["preferences","theme"]')).toBe(true);
    expect(isSafeQueryCacheKey('["tenants","tenant-a","departments"]')).toBe(true);
    expect(isSafeQueryCacheKey('["countries"]')).toBe(true);
  });

  it('never persists employee, payroll, finance, or attendance records', () => {
    for (const key of [
      '["tenants","tenant-a","employees"]',
      '["tenants","tenant-a","payrollRuns"]',
      '["tenants","tenant-a","invoices"]',
      '["tenants","tenant-a","attendance"]',
      '["tenants","tenant-a","leaveRequests"]',
    ]) {
      expect(isSafeQueryCacheKey(key)).toBe(false);
    }
  });
});
