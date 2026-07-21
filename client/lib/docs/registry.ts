/**
 * Lazy loaders for docs article content — one dynamic import per article so
 * the marketing bundle stays slim and each article ships as its own chunk.
 * Slugs must match DOCS_MANIFEST (custom entries excluded — they have their
 * own page components).
 */
import type { LocalizedDocArticle } from "./types";

export const DOC_LOADERS: Record<
  string,
  () => Promise<{ article: LocalizedDocArticle }>
> = {
  "getting-started": () => import("@/content/docs/getting-started"),
  "running-payroll": () => import("@/content/docs/running-payroll"),
  "tax-and-filings": () => import("@/content/docs/tax-and-filings"),
  "invoices-and-money": () => import("@/content/docs/invoices-and-money"),
  "time-and-leave": () => import("@/content/docs/time-and-leave"),
};
