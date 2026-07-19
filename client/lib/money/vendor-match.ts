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
