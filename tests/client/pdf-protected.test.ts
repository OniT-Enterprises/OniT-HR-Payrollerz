/**
 * Detecting a password-protected PDF.
 *
 * From a held-out sample of real documents: an installment invoice that nothing
 * can read because the PDF is encrypted. The extractor correctly reported "not a
 * bill", but the form then said "XefeBot couldn't read this file", which the user
 * can do nothing with. These bytes are the difference between an unhelpful
 * message and "save an unprotected copy".
 */
import { describe, it, expect } from 'vitest';
import { looksLikePdf, pdfBytesLookProtected } from '@/lib/pdf-protected';

const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text);

/** Shape of the real encrypted invoice: PDF header, /Encrypt in the trailer. */
const PROTECTED_PDF = bytes(
  '%PDF-1.6\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Size 20/Encrypt 19 0 R/Root 1 0 R>>\n%%EOF',
);

const PLAIN_PDF = bytes(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Size 8/Root 1 0 R>>\n%%EOF',
);

describe('looksLikePdf', () => {
  it('accepts the PDF magic bytes and nothing else', () => {
    expect(looksLikePdf(PLAIN_PDF)).toBe(true);
    expect(looksLikePdf(bytes('<html><body>Invoice</body></html>'))).toBe(false);
    expect(looksLikePdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false); // PNG
    expect(looksLikePdf(new Uint8Array())).toBe(false);
    expect(looksLikePdf(bytes('%PD'))).toBe(false);
  });
});

describe('pdfBytesLookProtected', () => {
  it('detects the /Encrypt trailer entry', () => {
    expect(pdfBytesLookProtected(PROTECTED_PDF)).toBe(true);
  });

  it('does not flag an ordinary PDF', () => {
    expect(pdfBytesLookProtected(PLAIN_PDF)).toBe(false);
  });

  it('never flags a non-PDF, so a photo cannot produce a wrong hint', () => {
    // The word appears, but the file is not a PDF at all.
    expect(pdfBytesLookProtected(bytes('some text mentioning /Encrypt'))).toBe(false);
    expect(pdfBytesLookProtected(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x2f, 0x45]))).toBe(false);
  });

  it('finds the marker wherever it sits, including at the very end', () => {
    const trailing = new Uint8Array([...bytes('%PDF-1.7\n'), ...bytes('/Encrypt')]);
    expect(pdfBytesLookProtected(trailing)).toBe(true);
  });

  it('handles a truncated or empty file without throwing', () => {
    expect(() => pdfBytesLookProtected(new Uint8Array())).not.toThrow();
    expect(pdfBytesLookProtected(bytes('%PDF-'))).toBe(false);
  });
});
