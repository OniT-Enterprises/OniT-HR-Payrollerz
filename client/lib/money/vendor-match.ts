/**
 * Vendor auto-match for AI-extracted bills (QuickBillDialog).
 *
 * Pure module so it can be unit-tested without the dialog's firebase import
 * chain, and so react-refresh sees the dialog file exporting only a component.
 *
 * Matching is tolerant of case, spacing and punctuation, so "Timor Telecom"
 * still matches "timortelecom", but a weak substring hit no longer misattaches
 * a bill to an unrelated vendor (the old code auto-selected on `.includes()`,
 * so "timortelecom".includes("ti") matched a 2-letter vendor "TI"). When there
 * is no confident match, returns null so the field is left unselected and the
 * user picks or adds the vendor.
 */
export function matchVendorByName<T extends { id: string; name: string }>(
  vendors: T[],
  aiVendorName: string,
): T | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(aiVendorName);
  if (!target) return null;
  return vendors.find((v) => norm(v.name) === target) ?? null;
}

/**
 * Words that say what kind of company something is, not which company it is.
 * A supplier writes "Primo's Boot" on one invoice and "Primos Boot Unipessoal
 * Lda" on the next; ignoring the legal form is what makes those the same name.
 */
const LEGAL_FORM_WORDS = new Set([
  'lda', 'ltda', 'unipessoal', 'unip', 'sa', 'sarl', 'ep', 'inc', 'llc', 'ltd',
  'limited', 'gmbh', 'bv', 'pty', 'pt', 'cv', 'co', 'company', 'the',
]);

/** Significant words in a vendor name, lowercased and stripped of punctuation. */
function nameTokens(value: string): string[] {
  return value
    .toLowerCase()
    // An apostrophe sits INSIDE a word — dropping it rather than splitting on it
    // is what makes "Primo's Boot" and "Primos Boot" the same two words.
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !LEGAL_FORM_WORDS.has(word));
}

/** Normalise a tax number for comparison: digits and letters only. */
function normalizeTaxId(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Match on the seller's tax number, which identifies the legal entity no matter
 * how the name is spelled on a given invoice. This is the strongest signal
 * available and should be preferred over any name comparison.
 *
 * A tax number shorter than 5 characters is treated as unusable — a stray "1"
 * read off a document must not collapse two vendors into one.
 */
export function matchVendorByTaxId<T extends { id: string; tin?: string }>(
  vendors: T[],
  taxId: string | null | undefined,
): T | null {
  const target = normalizeTaxId(taxId);
  if (target.length < 5) return null;
  return vendors.find((v) => normalizeTaxId(v.tin) === target) ?? null;
}

/**
 * Vendors that look like the same supplier under a different spelling, to OFFER
 * before a new one is created — never to select silently.
 *
 * The same supplier arriving as "Primo's Boot", "Primos Boot" and "Primos Boot
 * Unipessoal Lda" produced three vendor records, splitting AP history and the
 * withholding facts attached to them. Names are compared by their significant
 * words: every word of the shorter name must appear in the longer one, and at
 * least one of them must be substantial, so "TI" never matches "Timor Telecom".
 */
export function findSimilarVendors<T extends { id: string; name: string }>(
  vendors: T[],
  candidateName: string,
): T[] {
  const candidate = nameTokens(candidateName);
  if (candidate.length === 0) return [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidateNormalized = norm(candidateName);

  return vendors.filter((vendor) => {
    // An exact match is handled by matchVendorByName; do not offer it again.
    if (norm(vendor.name) === candidateNormalized) return false;

    const existing = nameTokens(vendor.name);
    if (existing.length === 0) return false;

    const [shorter, longer] = candidate.length <= existing.length
      ? [candidate, existing]
      : [existing, candidate];
    const longerSet = new Set(longer);
    if (!shorter.every((word) => longerSet.has(word))) return false;

    // At least one shared word long enough to mean something: two suppliers
    // both called "de" are not the same supplier.
    return shorter.some((word) => word.length >= 4);
  });
}
