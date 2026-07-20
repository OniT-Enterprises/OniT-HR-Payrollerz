/**
 * Locale-prefixed URLs for the PUBLIC marketing pages only.
 *
 * English lives at the bare path (`/pricing`); Tetun and Portuguese live under
 * a path prefix (`/tet/pricing`, `/pt/pricing`) so crawlers can index each
 * language as its own URL (hreflang cluster). The authenticated app keeps the
 * single-URL locale switcher — these helpers must never be applied to app
 * routes.
 *
 * Note: Tetun has no ISO 639-1 code; `tet` (ISO 639-2/3) is used in paths and
 * hreflang. Google may ignore an hreflang code it doesn't recognize, but the
 * pages still index normally via the sitemap and internal links.
 */
export type PublicLocale = "en" | "tet" | "pt";

export const PREFIXED_PUBLIC_LOCALES = ["tet", "pt"] as const;

/** Marketing paths that exist in all three languages (bare, English form). */
export const LOCALIZED_PUBLIC_PATHS = [
  "/",
  "/how-it-works",
  "/pricing",
  "/accountants",
  "/engine",
  "/security",
] as const;

export function localeFromPath(pathname: string): PublicLocale {
  for (const locale of PREFIXED_PUBLIC_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return "en";
}

/** `/tet/pricing` → `/pricing`; `/pt` → `/`; `/pricing` → `/pricing`. */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of PREFIXED_PUBLIC_LOCALES) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }
  return pathname;
}

/** `("/pricing", "tet")` → `/tet/pricing`; `("/", "pt")` → `/pt`. */
export function withLocalePrefix(path: string, locale: PublicLocale): string {
  const bare = stripLocalePrefix(path);
  if (locale === "en") return bare;
  return bare === "/" ? `/${locale}` : `/${locale}${bare}`;
}

/** True when this pathname (bare form) is one of the localized marketing pages. */
export function isLocalizedPublicPath(pathname: string): boolean {
  const bare = stripLocalePrefix(pathname);
  return (LOCALIZED_PUBLIC_PATHS as readonly string[]).includes(bare);
}
