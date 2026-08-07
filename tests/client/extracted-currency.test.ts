/**
 * AI-extracted currency classification.
 *
 * Bills and expenses are USD-only (`currency: 'USD'` in client/types/money.ts).
 * Extraction reads whatever the supplier printed, and the real TL document
 * corpus contains euro, rupiah and Australian-dollar invoices — a foreign face
 * value pre-filled into a USD field would be booked as dollars. These tests pin
 * the classification the Bill/Expense forms use to withhold that pre-fill.
 */
import { describe, it, expect } from 'vitest';
import {
  BOOKING_CURRENCY,
  classifyExtractedCurrency,
  foreignCurrencyLabel,
  isForeignExtractedCurrency,
} from '@/lib/extracted-currency';

describe('classifyExtractedCurrency', () => {
  it('treats every local way of writing US dollars as the booking currency', () => {
    for (const value of [
      'USD', 'usd', ' Usd ', 'US$', 'us$', '$', 'USD$',
      'US Dollar', 'us dollars', 'Dollar', 'dollars',
      'Dolar', 'Dólar', 'dólares', 'Dolar Amerikanu', 'Dolar Amerikano',
      'United States Dollar', '(USD)', 'USD.',
    ]) {
      expect(classifyExtractedCurrency(value), value).toBe('usd');
    }
  });

  it('classifies other currencies as foreign', () => {
    for (const value of ['EUR', '€', 'IDR', 'Rp', 'Rupiah', 'AUD', 'A$', 'SGD', 'JPY', 'BRL']) {
      expect(classifyExtractedCurrency(value), value).toBe('foreign');
    }
  });

  it('treats a missing currency as unknown, not foreign', () => {
    // Most TL documents omit the currency because USD is assumed — that must
    // not block the amount pre-fill.
    for (const value of [null, undefined, '', '   ', 'n/a', 'N/A', 'none', 'unknown', '-', '?']) {
      expect(classifyExtractedCurrency(value as string | null), String(value)).toBe('unknown');
    }
  });

  it('recognises USD mentioned inside surrounding noise', () => {
    expect(classifyExtractedCurrency('1,250.00 USD')).toBe('usd');
    expect(classifyExtractedCurrency('total in USD')).toBe('usd');
    expect(classifyExtractedCurrency('amount US$')).toBe('usd');
  });

  it('does not mistake a foreign currency for USD because a code contains "us"', () => {
    expect(classifyExtractedCurrency('AUS')).toBe('foreign');
    expect(classifyExtractedCurrency('Australian Dollar')).toBe('foreign');
  });
});

describe('isForeignExtractedCurrency', () => {
  it('withholds the pre-fill only for a genuinely foreign currency', () => {
    expect(isForeignExtractedCurrency('EUR')).toBe(true);
    expect(isForeignExtractedCurrency('IDR')).toBe(true);
    expect(isForeignExtractedCurrency('USD')).toBe(false);
    expect(isForeignExtractedCurrency(null)).toBe(false);
  });

  it('agrees with the booking currency constant', () => {
    expect(isForeignExtractedCurrency(BOOKING_CURRENCY)).toBe(false);
  });
});

describe('foreignCurrencyLabel', () => {
  it('uppercases bare codes and preserves worded values', () => {
    expect(foreignCurrencyLabel('eur')).toBe('EUR');
    expect(foreignCurrencyLabel('idr')).toBe('IDR');
    expect(foreignCurrencyLabel('a$')).toBe('A$');
    expect(foreignCurrencyLabel('Indonesian Rupiah')).toBe('Indonesian Rupiah');
  });

  it('never invents a code the document did not show', () => {
    expect(foreignCurrencyLabel('Rp')).toBe('RP');
    expect(foreignCurrencyLabel(null)).toBe('');
  });

  it('caps length and collapses whitespace so a long string cannot break the warning', () => {
    expect(foreignCurrencyLabel('  euro   currency  ')).toBe('euro currency');
    expect(foreignCurrencyLabel('x'.repeat(80))).toHaveLength(24);
  });
});
