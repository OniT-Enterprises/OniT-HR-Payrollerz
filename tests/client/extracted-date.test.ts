/**
 * Document-date sanity for AI-extracted bill/receipt fields.
 *
 * Anchored on a real defect: a supplier invoice printing `06/11/2024`, emailed
 * 18 June 2024 and billing "Maio e Junho 2024", was extracted as 2024-11-06 —
 * day and month swapped, five months into the future. A bill date drives AP
 * aging, the period the bill lands in, and the withholding remittance month, so
 * the forms must refuse to pre-fill a date that cannot be right.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyExtractedDocumentDate,
  isImplausibleDocumentDate,
} from '@/lib/extracted-date';

const TODAY = '2024-06-18'; // the day the real invoice was emailed

describe('classifyExtractedDocumentDate', () => {
  it('accepts today and any past date', () => {
    for (const value of ['2024-06-18', '2024-06-17', '2024-01-01', '2018-01-22']) {
      expect(classifyExtractedDocumentDate(value, TODAY), value).toBe('usable');
    }
  });

  it('rejects the real day/month swap that pushed a bill into the future', () => {
    // Printed 06/11/2024 = 11 June 2024; extracted as 6 November 2024.
    expect(classifyExtractedDocumentDate('2024-11-06', TODAY)).toBe('future');
    expect(classifyExtractedDocumentDate('2024-06-11', TODAY)).toBe('usable');
  });

  it('allows one day of slack for the Dili/UTC boundary', () => {
    // The extractor resolves "today" in UTC while the form uses TL time (UTC+9),
    // so a document issued today in Dili must not be called future-dated.
    expect(classifyExtractedDocumentDate('2024-06-19', TODAY)).toBe('usable');
    expect(classifyExtractedDocumentDate('2024-06-20', TODAY)).toBe('future');
  });

  it('reports a missing or malformed date as missing, not future', () => {
    for (const value of [null, undefined, '', 'June 2024', '18/06/2024', '2024-6-18']) {
      expect(classifyExtractedDocumentDate(value as string | null, TODAY), String(value)).toBe('missing');
    }
  });

  it('rejects a well-formed string that is not a real calendar date', () => {
    expect(classifyExtractedDocumentDate('2024-02-31', TODAY)).toBe('missing');
    expect(classifyExtractedDocumentDate('2024-13-01', TODAY)).toBe('missing');
    expect(classifyExtractedDocumentDate('2024-02-29', TODAY)).toBe('usable'); // 2024 is a leap year
  });

  it('does not block the pre-fill when the reference date is unusable', () => {
    expect(classifyExtractedDocumentDate('2030-01-01', 'not-a-date')).toBe('usable');
  });
});

describe('isImplausibleDocumentDate', () => {
  it('is true only for a future date', () => {
    expect(isImplausibleDocumentDate('2024-11-06', TODAY)).toBe(true);
    expect(isImplausibleDocumentDate('2024-06-11', TODAY)).toBe(false);
  });

  it('treats an old document as plausible — the corpus showed those are genuine', () => {
    // Every document in the audit dated over a year before its email was a real
    // old document sent on later, which is normal catch-up paperwork.
    expect(isImplausibleDocumentDate('2018-01-22', TODAY)).toBe(false);
  });

  it('is false when there is no date to pre-fill', () => {
    expect(isImplausibleDocumentDate(null, TODAY)).toBe(false);
    expect(isImplausibleDocumentDate('', TODAY)).toBe(false);
  });
});
