/**
 * Route prefixes that render WITHOUT the authenticated app chrome and without
 * needing auth/tenant resolution: marketing pages, auth screens, and public
 * token pages. Shared by AppLayout (skip sidebar/top bar) and TenantContext
 * (dismiss the HTML boot splash immediately — these pages must never wait on
 * session restore to paint).
 */
export const PUBLIC_PATHS = [
  "/auth/",
  "/landing",
  "/how-it-works",
  "/pricing",
  "/accountants",
  "/engine",
  "/features",
  "/unauthorized",
  "/apply/",
  "/i/",
  "/privacy",
  "/terms",
];

export function isPublicPath(pathname: string): boolean {
  // /tet/... and /pt/... serve the same marketing pages per-language
  // (client/lib/publicLocale.ts); "/tet" and "/pt" alone are the localized
  // landing pages.
  const bare = pathname.replace(/^\/(tet|pt)(?=\/|$)/, "") || "/";
  if (bare === "/" && pathname !== "/") return true; // /tet or /pt landing
  return PUBLIC_PATHS.some((p) => bare.startsWith(p));
}
