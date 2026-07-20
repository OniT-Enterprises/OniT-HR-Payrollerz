/**
 * Unit tests for the pure Custom Reports row helpers
 * (client/lib/reports/customReportRows.ts — Firebase-free by design).
 */
import { describe, it, expect } from 'vitest';
import {
  filterEmployeeRows,
  getColumnValue,
} from '@/lib/reports/customReportRows';

describe('getColumnValue', () => {
  const row = {
    status: 'active',
    personalInfo: { firstName: 'Maria', lastName: 'Soares', email: null },
    compensation: { monthlySalary: 650 },
    jobDetails: { department: 'Kitchen' },
  };

  it('resolves top-level keys', () => {
    expect(getColumnValue(row, 'status')).toBe('active');
  });

  it('resolves nested dot-path keys', () => {
    expect(getColumnValue(row, 'personalInfo.firstName')).toBe('Maria');
    expect(getColumnValue(row, 'jobDetails.department')).toBe('Kitchen');
  });

  it('stringifies non-string values', () => {
    expect(getColumnValue(row, 'compensation.monthlySalary')).toBe('650');
  });

  it('renders "-" for missing, undefined, and null values', () => {
    expect(getColumnValue(row, 'doesNotExist')).toBe('-');
    expect(getColumnValue(row, 'personalInfo.middleName')).toBe('-');
    expect(getColumnValue(row, 'personalInfo.email')).toBe('-');
    // Traversing through a missing branch must not throw.
    expect(getColumnValue(row, 'bankDetails.accountNumber.iban')).toBe('-');
  });

  it('preserves falsy-but-present values instead of "-"', () => {
    expect(getColumnValue({ lateMinutes: 0 }, 'lateMinutes')).toBe('0');
    expect(getColumnValue({ name: '' }, 'name')).toBe('');
  });
});

describe('filterEmployeeRows', () => {
  const rows = [
    { status: 'active', jobDetails: { department: 'Kitchen' } },
    { status: 'active', jobDetails: { department: 'Front of House' } },
    { status: 'inactive', jobDetails: { department: 'Kitchen' } },
    { status: 'onboarding', jobDetails: {} },
  ];

  it('returns everything when no filters set', () => {
    expect(filterEmployeeRows(rows, {})).toHaveLength(4);
  });

  it('treats empty-string filters (the "all" choice) as match-all', () => {
    expect(
      filterEmployeeRows(rows, { status: '', department: '' }),
    ).toHaveLength(4);
  });

  it('filters by status', () => {
    expect(filterEmployeeRows(rows, { status: 'active' })).toHaveLength(2);
    expect(filterEmployeeRows(rows, { status: 'inactive' })).toHaveLength(1);
  });

  it('filters by department, dropping rows without one', () => {
    const kitchen = filterEmployeeRows(rows, { department: 'Kitchen' });
    expect(kitchen).toHaveLength(2);
    expect(kitchen.every((r) => r.jobDetails?.department === 'Kitchen')).toBe(
      true,
    );
  });

  it('combines status and department filters', () => {
    expect(
      filterEmployeeRows(rows, { status: 'active', department: 'Kitchen' }),
    ).toHaveLength(1);
  });

  it('ignores dateRange (attendance-only filter)', () => {
    expect(filterEmployeeRows(rows, { dateRange: '30' })).toHaveLength(4);
  });
});
