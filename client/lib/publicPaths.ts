/**
 * Route prefixes that render WITHOUT the authenticated app chrome and without
 * needing auth/tenant resolution: marketing pages, auth screens, and public
 * token pages. Shared by AppLayout (skip sidebar/top bar) and TenantContext
 * (dismiss the HTML boot splash immediately — these pages must never wait on
 * session restore to paint).
 */
import { stripLocalePrefix } from "@/lib/publicLocale";

export const PUBLIC_PATHS = [
  "/auth/",
  "/landing",
  "/how-it-works",
  "/pricing",
  "/accountants",
  "/engine",
  "/security",
  "/docs",
  "/features",
  "/unauthorized",
  "/apply/",
  "/i/",
  "/privacy",
  "/terms",
];

export function isPublicPath(pathname: string): boolean {
  // Locale-prefixed URLs serve the same marketing pages per language, and the
  // bare prefix ("/tet", "/pt", "/id") is that language's landing page.
  //
  // The prefix list MUST come from publicLocale.ts, never a literal here. This
  // held a hardcoded /^\/(tet|pt)/ until 2026-08-18, so when Indonesian was
  // added /id/pricing was not recognised as a marketing path — isAppPath()
  // returned true and HostGuard bounced every /id/* page from xefe.tl over to
  // app.xefe.tl, where it is not a route. The page 200s and even carries the
  // right pre-rendered <title>, so only loading it in a browser shows the bug.
  const bare = stripLocalePrefix(pathname);
  if (bare === "/" && pathname !== "/") return true; // localized landing page
  return PUBLIC_PATHS.some((p) => bare.startsWith(p));
}
