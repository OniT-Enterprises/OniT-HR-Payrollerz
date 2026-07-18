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
  "/features",
  "/unauthorized",
  "/apply/",
  "/i/",
  "/privacy",
  "/terms",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}
