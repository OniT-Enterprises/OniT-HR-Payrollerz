/**
 * Public documentation content model — react-free so the manifest and
 * content files can be imported by build scripts (static heads) as well as
 * the renderer.
 *
 * Articles are per-locale data files under client/content/docs/, rendered by
 * client/pages/DocsArticle.tsx with the marketing design language (lime
 * accent). PUBLIC-SAFE rule (docs/PUBLIC_SITE.md): statutes, deadlines and
 * Xefe's own product behavior only — never data sourcing, internal file
 * paths, or sign-off status.
 */

export type DocBlock =
  /** One or more paragraphs, split on blank lines. */
  | { type: "prose"; body: string }
  /** Section heading — becomes an anchor + section-nav entry. */
  | { type: "heading"; id: string; text: string }
  /** Numbered how-to steps. */
  | { type: "steps"; items: { title: string; body: string }[] }
  /** Plain bullet list. */
  | { type: "list"; items: string[] }
  /** Emphasized note in a bordered panel. */
  | { type: "callout"; body: string }
  /** Statutory deadline cards (day, small caption, title, body). */
  | {
      type: "deadlines";
      items: { day: string; small: string; title: string; body: string }[];
    }
  /** Ledger-style journal card (classic credit indentation). */
  | {
      type: "ledger";
      title: string;
      when: string;
      foot: string;
      rows: { code: string; name: string; side: "dr" | "cr" }[];
    }
  /** Simple data table. */
  | { type: "table"; headers: string[]; rows: string[][] };

export interface DocArticleContent {
  /** Heading split so exactly one line carries the accent gradient. */
  titleTop: string;
  titleAccent: string;
  lede: string;
  blocks: DocBlock[];
}

export interface LocalizedDocArticle {
  en: DocArticleContent;
  pt: DocArticleContent;
  tet: DocArticleContent;
}

export interface DocsSeoAlternate {
  title: string;
  description: string;
}

export interface DocsManifestEntry {
  /** URL is /docs/<slug>. */
  slug: string;
  /** Hub grouping. */
  category: "guides" | "architecture";
  /** Rendered by the shared DocsArticle page unless custom (own component). */
  custom?: boolean;
  seo: {
    title: string;
    description: string;
    keywords?: string;
    /** Canonical bare path, e.g. "/docs/getting-started". */
    url: string;
    alternates: { tet: DocsSeoAlternate; pt: DocsSeoAlternate };
  };
  /** Hub card copy per locale. */
  hub: Record<
    "en" | "pt" | "tet",
    { tag: string; title: string; desc: string }
  >;
}
