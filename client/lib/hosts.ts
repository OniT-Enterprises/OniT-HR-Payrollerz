/**
 * Host split (2026-07-21): the marketing site lives on xefe.tl, the
 * authenticated app on app.xefe.tl. One SPA build serves both hosts — nginx
 * redirects server-side hits, and HostGuard (client/App.tsx) corrects
 * client-side navigations that cross the boundary. Dev/localhost is exempt
 * from all of it.
 *
 * Public SHARE surfaces stay on the marketing apex forever: hosted invoice
 * pages (/i/:token) and job applications (/apply/...) are sent to customers
 * and must never break.
 */
import { isPublicPath } from "@/lib/publicPaths";
import {
  isLocalizedPublicPath,
  stripLocalePrefix,
} from "@/lib/publicLocale";

export const MARKETING_HOST = "xefe.tl";
export const APP_HOST = "app.xefe.tl";
export const MARKETING_ORIGIN = `https://${MARKETING_HOST}`;
export const APP_ORIGIN = `https://${APP_HOST}`;

export function isAppHost(): boolean {
  return typeof window !== "undefined" && window.location.hostname === APP_HOST;
}

export function isMarketingHost(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname === MARKETING_HOST
  );
}

/**
 * Paths that belong on app.xefe.tl. Auth screens are deliberately app-side:
 * signing in must happen on the origin that holds the session.
 *
 * "/" (and the /tet, /pt home pages) are NEVER app paths: the marketing home
 * lives there, and HomeRoute owns the app host's "/" itself. Without this
 * guard the two hosts bounce guests back and forth forever — "/" is not in
 * PUBLIC_PATHS because the SPA always served Landing through HomeRoute.
 */
export function pathBelongsToApp(pathname: string): boolean {
  if (pathname.startsWith("/auth/") || pathname === "/unauthorized") {
    return true;
  }
  if (stripLocalePrefix(pathname) === "/") return false;
  return !isPublicPath(pathname);
}

/**
 * Marketing pages that should bounce back to the apex when opened on the app
 * host — the localized marketing set plus the legal pages. Deliberately NOT
 * "/" (the app's home is the dashboard bounce), and NOT /i/ or /apply/
 * (harmless to serve anywhere; canonical links always use the apex).
 */
export function pathBelongsToMarketing(pathname: string): boolean {
  if (pathname === "/") return false;
  const bare = stripLocalePrefix(pathname);
  if (bare === "/privacy" || bare === "/terms") return true;
  if (bare === "/") return true; // /tet, /pt home pages
  return isLocalizedPublicPath(pathname);
}
