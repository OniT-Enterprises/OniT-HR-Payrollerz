import { DOCS_MANIFEST } from "@/lib/docs/manifest";
import { DOC_LOADERS } from "@/lib/docs/registry";
import type {
  DocArticleContent,
  DocBlock,
  LocalizedDocArticle,
} from "@/lib/docs/types";
import { normalizeHelpText, type ArticleLocale } from "./content";

const GUIDE_ACTIONS: Record<string, { to: string; labelKey: string }> = {
  "getting-started": { to: "/setup", labelKey: "help.actions.continueSetup" },
  "running-payroll": {
    to: "/payroll/run",
    labelKey: "help.actions.openPayroll",
  },
  "tax-and-filings": {
    to: "/payroll/tax",
    labelKey: "help.actions.openFilings",
  },
  "invoices-and-money": {
    to: "/money/invoices",
    labelKey: "help.actions.openInvoices",
  },
  "time-and-leave": {
    to: "/time-leave/attendance",
    labelKey: "help.actions.openAttendance",
  },
};

export interface ProductGuideSummary {
  slug: string;
  title: string;
  summary: string;
  keywords: string;
  action: { to: string; labelKey: string };
}

export function productGuidesFor(
  locale: ArticleLocale = "en",
): ProductGuideSummary[] {
  return DOCS_MANIFEST.filter(
    (entry) =>
      entry.category === "guides" && !entry.custom && DOC_LOADERS[entry.slug],
  ).map((entry) => ({
    slug: entry.slug,
    title: entry.hub[locale].title,
    summary: entry.hub[locale].desc,
    keywords: entry.seo.keywords ?? "",
    action: GUIDE_ACTIONS[entry.slug],
  }));
}

export async function loadProductGuide(
  slug: string,
): Promise<LocalizedDocArticle | undefined> {
  const loader = DOC_LOADERS[slug];
  if (!loader || !GUIDE_ACTIONS[slug]) return undefined;
  return (await loader()).article;
}

export interface ProductGuideSection {
  id: string;
  heading: string;
  preview: string;
  haystack: string;
  rank: number;
}

function blockText(block: DocBlock): string {
  switch (block.type) {
    case "heading":
      return block.text;
    case "prose":
    case "callout":
      return block.body;
    case "list":
      return block.items.join(" ");
    case "steps":
      return block.items.map((item) => `${item.title} ${item.body}`).join(" ");
    case "deadlines":
      return block.items
        .map((item) => `${item.day} ${item.small} ${item.title} ${item.body}`)
        .join(" ");
    case "ledger":
      return [
        block.title,
        block.when,
        block.foot,
        ...block.rows.map((row) => `${row.code} ${row.name} ${row.side}`),
      ].join(" ");
    case "table":
      return [...block.headers, ...block.rows.flat()].join(" ");
  }
}

/** Turn typed doc blocks into searchable, deep-linkable article sections. */
export function productGuideSections(
  guide: ProductGuideSummary,
  content: DocArticleContent,
): ProductGuideSection[] {
  const sections: ProductGuideSection[] = [];
  let current = {
    id: "overview",
    heading: guide.title,
    parts: [content.lede],
  };

  const flush = () => {
    const text = current.parts.join(" ").trim();
    if (!text && current.id !== "overview") return;
    sections.push({
      id: current.id,
      heading: current.heading,
      preview: text.slice(0, 220),
      haystack: normalizeHelpText(`${current.heading} ${text}`),
      rank: 0,
    });
  };

  for (const block of content.blocks) {
    if (block.type === "heading") {
      flush();
      current = { id: block.id, heading: block.text, parts: [] };
    } else {
      current.parts.push(blockText(block));
    }
  }
  flush();
  return sections;
}

export function productGuideMatchesMetadata(
  query: string,
  guide: ProductGuideSummary,
): boolean {
  const terms = normalizeHelpText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return false;
  const metadata = normalizeHelpText(
    `${guide.title} ${guide.summary} ${guide.keywords}`,
  );
  return terms.every((term) => metadata.includes(term));
}

export function searchProductGuide(
  query: string,
  guide: ProductGuideSummary,
  content: DocArticleContent,
): ProductGuideSection[] {
  const terms = normalizeHelpText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  return productGuideSections(guide, content)
    .filter((section) => terms.every((term) => section.haystack.includes(term)))
    .map((section) => {
      const heading = normalizeHelpText(section.heading);
      return {
        ...section,
        rank:
          terms.length - terms.filter((term) => heading.includes(term)).length,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}
