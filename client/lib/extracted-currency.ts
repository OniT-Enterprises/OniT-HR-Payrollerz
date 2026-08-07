/**
 * Currency classification for AI-extracted bill/receipt fields.
 *
 * Bills and expenses are booked in USD only (`Bill.currency: 'USD'` in
 * client/types/money.ts) — Timor-Leste uses the US dollar and Xefe holds no FX
 * rates. Document extraction, however, reads whatever the supplier printed, and
 * TL small businesses really do receive Indonesian, Australian and European
 * invoices. Copying such a face amount into a USD field would book a wrong
 * number silently, so the forms must classify the extracted currency before
 * they pre-fill the amount.
 *
 * Firebase-free on purpose: CI unit tests run without VITE_FIREBASE_* env.
 */

/** The only currency Xefe books bills and expenses in. */
export const BOOKING_CURRENCY = 'USD';

/**
 * How an extracted `currency` string relates to the booking currency:
 * - `usd`     — the document is in US dollars; pre-fill the amount as usual.
 * - `foreign` — a different currency; do NOT pre-fill a USD amount.
 * - `unknown` — nothing usable was extracted. Most TL documents omit the
 *   currency entirely because USD is assumed, so this is treated like `usd`
 *   for pre-filling; it is a distinct value so callers can tell "the document
 *   said USD" from "the document said nothing".
 */
export type ExtractedCurrencyClass = 'usd' | 'foreign' | 'unknown';

// Ways a US-dollar amount is written on TL/PT/ID/Tetun documents.
const USD_FORMS = new Set([
  'usd', 'us$', 'usd$', '$', 'u$', 'us', 'us dollar', 'us dollars',
  'usdollar', 'usdollars', 'dollar', 'dollars', 'dolar', 'dolares',
  'dólar', 'dólares', 'dolar amerikanu', 'dolar amerikano',
  'dolar as', 'american dollar', 'united states dollar',
]);

// Placeholders the model may emit instead of leaving the field null.
const NON_ANSWERS = new Set([
  '', '-', '--', '?', 'n/a', 'na', 'n.a.', 'nil', 'none', 'null',
  'unknown', 'unspecified', 'not specified', 'not stated', 'undefined',
]);

/**
 * Normalize an extracted currency string for comparison: lowercase, trimmed,
 * inner whitespace collapsed, surrounding punctuation and parentheses removed.
 */
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[()[\],.;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classify an extracted `currency` value against the booking currency. */
export function classifyExtractedCurrency(
  raw: string | null | undefined,
): ExtractedCurrencyClass {
  if (typeof raw !== 'string') return 'unknown';
  const value = normalize(raw);
  if (NON_ANSWERS.has(value)) return 'unknown';
  if (USD_FORMS.has(value)) return 'usd';
  // "1,250.00 USD" or "total in USD" — a USD mention with noise around it.
  if (/(^|\s)(usd|us\$)(\s|$)/.test(value)) return 'usd';
  return 'foreign';
}

/**
 * True when the document is in a currency Xefe cannot book. The amount must not
 * be pre-filled in that case — the user has to enter the USD equivalent.
 */
export function isForeignExtractedCurrency(raw: string | null | undefined): boolean {
  return classifyExtractedCurrency(raw) === 'foreign';
}

/**
 * A short label for the foreign currency to show the user, e.g. `IDR`, `Rp`,
 * `AUD`. Returns the extracted text trimmed and length-capped — never a guessed
 * ISO code, because the warning must reflect what the document actually said.
 */
export function foreignCurrencyLabel(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 24);
  // Bare codes read better uppercased ("idr" → "IDR", "a$" → "A$" for the
  // Australian dollar); leave worded values alone.
  return /^[a-z]{1,4}\$?$/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}
