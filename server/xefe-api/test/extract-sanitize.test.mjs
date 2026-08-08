/**
 * Hostile-output boundary for AI document extraction.
 *
 * The document being read is attacker-controlled — it is whatever a "supplier"
 * emailed or a customer photographed — so the model's reply is untrusted input,
 * not a trusted result. sanitizeFields() and parseJsonReply() are the only thing
 * standing between that reply and a saved bill, and from there a journal line, a
 * statutory export and a CSV an accountant opens in Excel.
 *
 * No emulator, no network, no model: pure functions only.
 *
 *   node --test test/extract-sanitize.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sanitizeFields, parseJsonReply } = require('../extract.js');

const EXPECTED_KEYS = [
  'documentType', 'vendorName', 'vendorTaxId', 'billNumber', 'billDate',
  'dueDate', 'amount', 'currency', 'description', 'category',
  'containsMultipleDocuments', 'confidence',
];

describe('sanitizeFields — shape', () => {
  it('always returns exactly the documented field set', () => {
    const out = sanitizeFields({});
    assert.deepEqual(Object.keys(out).sort(), [...EXPECTED_KEYS].sort());
  });

  it('drops any extra field the model invents', () => {
    const out = sanitizeFields({ evilField: 'x', bankAccount: '123', __proto__: { polluted: true } });
    assert.equal('evilField' in out, false);
    assert.equal('bankAccount' in out, false);
    assert.equal({}.polluted, undefined, 'Object.prototype must not be polluted');
  });

  it('never throws, whatever the model returns', () => {
    for (const raw of [{}, { documentType: null }, { amount: {} }, { vendorName: [] },
      { confidence: 'high' }, { billDate: 12345 }, { category: ['rent'] }]) {
      assert.doesNotThrow(() => sanitizeFields(raw), JSON.stringify(raw));
    }
  });
});

describe('sanitizeFields — documentType and category are closed sets', () => {
  it('accepts only the known document types', () => {
    // credit_memo matters as much as the others: a credit note REDUCES what is
    // owed, so booking one as a bill pays out money the business is owed back.
    for (const type of ['bill', 'receipt', 'payment_proof', 'credit_memo']) {
      assert.equal(sanitizeFields({ documentType: type }).documentType, type);
    }
    for (const type of ['invoice', 'BILL', 'payment', 'credit note', '', null, 42, ['bill']]) {
      assert.equal(sanitizeFields({ documentType: type }).documentType, 'other',
        `unknown type ${JSON.stringify(type)} must fall back to other`);
    }
  });

  it('treats containsMultipleDocuments as true ONLY when explicitly true', () => {
    // A file holding several invoices makes the amount and number ambiguous, and
    // the forms withhold both. A fuzzy value must not make every ordinary
    // single-invoice upload look ambiguous and stop pre-filling money.
    assert.equal(sanitizeFields({ containsMultipleDocuments: true }).containsMultipleDocuments, true);
    for (const value of ['true', 'yes', 1, {}, [], null, undefined, false, 'no']) {
      assert.equal(sanitizeFields({ containsMultipleDocuments: value }).containsMultipleDocuments,
        false, `value ${JSON.stringify(value)} must not count as multiple`);
    }
    assert.equal(sanitizeFields({}).containsMultipleDocuments, false);
  });

  it('falls back to the "other" category rather than inventing one', () => {
    assert.equal(sanitizeFields({ category: 'rent' }).category, 'rent');
    for (const category of ['bribes', 'RENT', '', null, 7]) {
      assert.equal(sanitizeFields({ category }).category, 'other');
    }
  });
});

describe('sanitizeFields — money', () => {
  it('rejects negative, non-finite and non-numeric amounts', () => {
    for (const amount of [-1, -0.01, NaN, Infinity, -Infinity, '450', null, {}, []]) {
      assert.equal(sanitizeFields({ amount }).amount, null, `amount ${String(amount)}`);
    }
  });

  it('rounds to cents rather than carrying float noise into the books', () => {
    assert.equal(sanitizeFields({ amount: 450.005 }).amount, 450.01);
    assert.equal(sanitizeFields({ amount: 0.1 + 0.2 }).amount, 0.3);
    assert.equal(sanitizeFields({ amount: 8496.5949 }).amount, 8496.59);
  });

  it('keeps a huge but finite amount as a number for the human to reject', () => {
    // Not silently zeroed: the form shows it and the user sees it is wrong.
        assert.equal(sanitizeFields({ amount: 1e15 }).amount, 1e15);
  });

  it('does not carry taxAmount at all', () => {
    // Removed deliberately: TL has no VAT, and a document's tax line may be
    // Indonesian PPN, Portuguese IVA, TL services tax or withholding. Nothing
    // read it, and a field nobody reads looks like one somebody forgot to wire.
    assert.equal('taxAmount' in sanitizeFields({ taxAmount: 12.34 }), false);
  });
});

describe('sanitizeFields — dates', () => {
  it('accepts only strict YYYY-MM-DD', () => {
    assert.equal(sanitizeFields({ billDate: '2026-08-07' }).billDate, '2026-08-07');
    for (const value of ['07/08/2026', '2026-8-7', '2026-08-07T00:00:00Z', 'August 2026', 20260807, null]) {
      assert.equal(sanitizeFields({ billDate: value }).billDate, null, String(value));
    }
  });
});

describe('sanitizeFields — strings are export-safe', () => {
  it('strips control characters that would break a CSV row apart', () => {
    const out = sanitizeFields({
      vendorName: 'Primos\u0000 Boot\r\nUnip\tLda',
      description: 'line one\r\nline two',
    });
    assert.equal(out.vendorName, 'Primos Boot Unip Lda');
    assert.equal(out.description, 'line one line two');
    for (const value of [out.vendorName, out.description]) {
      assert.ok(!/[\u0000-\u001F\u007F]/.test(value), 'no control characters survive');
    }
  });

  it('caps length so one document cannot flood a record', () => {
    const out = sanitizeFields({ description: 'x'.repeat(5000) });
    assert.equal(out.description.length, 300);
  });

  it('turns a whitespace-only value into null instead of an empty string', () => {
    assert.equal(sanitizeFields({ vendorName: '   \t\r\n  ' }).vendorName, null);
  });

  it('passes a formula payload through as text — the CSV layer neutralises it', () => {
    // Deliberate: the value is kept faithful to the document, and
    // client/lib/csvExport.ts sanitizeCsvCell() prefixes it on export. Stripping
    // it here would hide from the user what the document actually said.
    const out = sanitizeFields({ vendorName: '=HYPERLINK("http://evil.example","x")' });
    assert.equal(out.vendorName, '=HYPERLINK("http://evil.example","x")');
  });
});

describe('sanitizeFields — vendorTaxId', () => {
  it('keeps a real tax number', () => {
    assert.equal(sanitizeFields({ vendorTaxId: '1005236481' }).vendorTaxId, '1005236481');
    assert.equal(sanitizeFields({ vendorTaxId: 'NPWP 01.234.567.8-901.000' }).vendorTaxId,
      'NPWP 01.234.567.8-901.000');
  });

  it('rejects a value with no digits — that is a misread, not a tax number', () => {
    for (const value of ['not available', 'N/A', 'NIF', '', null]) {
      assert.equal(sanitizeFields({ vendorTaxId: value }).vendorTaxId, null, String(value));
    }
  });

  it('caps length and drops characters a tax number never contains', () => {
    const out = sanitizeFields({ vendorTaxId: '12<script>alert(1)</script>34' });
    assert.ok(!out.vendorTaxId.includes('<'), out.vendorTaxId);
    assert.ok(out.vendorTaxId.length <= 40);
  });
});

describe('sanitizeFields — confidence', () => {
  it('clamps to 0..1 and treats a non-number as no confidence', () => {
    assert.equal(sanitizeFields({ confidence: 1.7 }).confidence, 1);
    assert.equal(sanitizeFields({ confidence: -3 }).confidence, 0);
    assert.equal(sanitizeFields({ confidence: 0.85 }).confidence, 0.85);
    // NaN is the dangerous one: it is `typeof 'number'`, and every
    // `confidence < threshold` check in the forms is false for NaN, so a NaN
    // confidence would prefill as though the read were certain.
    for (const value of ['0.9', null, undefined, {}, NaN, Infinity, -Infinity]) {
      const out = sanitizeFields({ confidence: value });
      assert.ok(Number.isFinite(out.confidence), `confidence must stay finite for ${String(value)}`);
      assert.ok(out.confidence >= 0 && out.confidence <= 1);
    }
    // A malformed value means NO confidence, not total confidence: the forms
    // then say "couldn't read this file" instead of trusting garbage.
    assert.equal(sanitizeFields({ confidence: NaN }).confidence, 0);
    assert.equal(sanitizeFields({ confidence: Infinity }).confidence, 0);
  });
});

describe('parseJsonReply', () => {
  it('reads a bare object, a fenced object and an object wrapped in prose', () => {
    assert.equal(parseJsonReply('{"amount":10}').amount, 10);
    assert.equal(parseJsonReply('```json\n{"amount":10}\n```').amount, 10);
    assert.equal(parseJsonReply('Here you go:\n{"amount":10}\nHope that helps!').amount, 10);
  });

  it('throws rather than guessing when there is no object', () => {
    for (const text of ['', 'no json here', '[]', null, undefined, '{{{']) {
      assert.throws(() => parseJsonReply(text), undefined, JSON.stringify(text));
    }
  });

  it('does not let a second object silently replace the first field set', () => {
    // Spans from the first { to the last } — malformed middles must throw, not
    // yield a half-parsed record that looks legitimate.
    assert.throws(() => parseJsonReply('{"amount":10} some prose {"amount":99}'));
  });
});
