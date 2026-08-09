/**
 * Build the read-only documentation index used by XefeBot.
 *
 * The customer-facing Help content remains canonical. This script flattens
 * its typed blocks into a server-safe JSON artifact because xefe-api deploys
 * separately and does not have the Vite/TypeScript client tree at runtime.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type {
  DocArticleContent,
  DocBlock,
} from "../client/lib/docs/types";
import {
  articlesFor,
  normalizeHelpText,
  type ArticleLocale,
} from "../client/lib/help/content";
import {
  loadProductGuide,
  productGuidesFor,
  PRODUCT_GUIDE_SECTION_SEARCH_ALIASES,
} from "../client/lib/help/product-guides";

interface BotDocRecord {
  key: string;
  locale: ArticleLocale;
  kind: "guide" | "reference";
  slug: string;
  sectionId: string;
  title: string;
  heading: string;
  helpPath: string;
  text: string;
  searchText: string;
}

const LOCALES: ArticleLocale[] = ["en", "pt", "tet"];

function blockText(block: DocBlock): string {
  switch (block.type) {
    case "heading":
      return block.text;
    case "prose":
    case "callout":
      return block.body;
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "steps":
      return block.items
        .map((item, index) => `${index + 1}. ${item.title}: ${item.body}`)
        .join("\n");
    case "deadlines":
      return block.items
        .map(
          (item) =>
            `${item.day} ${item.small} — ${item.title}: ${item.body}`,
        )
        .join("\n");
    case "ledger":
      return [
        block.title,
        block.when,
        ...block.rows.map((row) => `${row.code} ${row.name}: ${row.side}`),
        block.foot,
      ].join("\n");
    case "table":
      return [
        block.headers.join(" | "),
        ...block.rows.map((row) => row.join(" | ")),
      ].join("\n");
  }
}

function productGuideRecords(
  slug: string,
  locale: ArticleLocale,
  content: DocArticleContent,
): BotDocRecord[] {
  const title = `${content.titleTop} ${content.titleAccent}`.trim();
  const records: BotDocRecord[] = [];
  let sectionId = "overview";
  let heading = title;
  let parts = [content.lede];

  const flush = () => {
    const text = parts.join("\n\n").trim();
    if (!text && sectionId !== "overview") return;
    const aliases =
      PRODUCT_GUIDE_SECTION_SEARCH_ALIASES[`${slug}#${sectionId}`] ?? [];
    records.push({
      key: `guide:${slug}:${locale}:${sectionId}`,
      locale,
      kind: "guide",
      slug,
      sectionId,
      title,
      heading,
      helpPath: `/help/guide/${slug}#${sectionId}`,
      text,
      searchText: normalizeHelpText(
        `${title} ${heading} ${text} ${aliases.join(" ")}`,
      ),
    });
  };

  for (const block of content.blocks) {
    if (block.type === "heading") {
      flush();
      sectionId = block.id;
      heading = block.text;
      parts = [];
    } else {
      parts.push(blockText(block));
    }
  }
  flush();
  return records;
}

function referenceRecords(): BotDocRecord[] {
  const records = new Map<string, BotDocRecord>();
  for (const requestedLocale of LOCALES) {
    for (const article of articlesFor(requestedLocale)) {
      for (const group of article.groups) {
        for (const entry of group.entries) {
          // English-only legal references are returned as a fallback by
          // articlesFor(pt/tet); store that source once rather than triplicate.
          const key = `reference:${article.slug}:${article.locale}:${entry.id}`;
          if (records.has(key)) continue;
          const text = [
            article.summary,
            group.heading,
            entry.heading,
            ...entry.body,
            entry.when ? `When: ${entry.when}` : "",
            entry.today ? `What Xefe does: ${entry.today}` : "",
            entry.impact ? `Impact: ${entry.impact}` : "",
            entry.open ? `Still being confirmed: ${entry.open}` : "",
            entry.quote ? `Source text: ${entry.quote}` : "",
            entry.quoteCite ? `Source: ${entry.quoteCite}` : "",
          ]
            .filter(Boolean)
            .join("\n\n");
          const synonyms = entry.synonyms ?? [];
          records.set(key, {
            key,
            locale: article.locale,
            kind: "reference",
            slug: article.slug,
            sectionId: entry.id,
            title: article.title,
            heading: entry.heading,
            helpPath: `/help/${article.slug}#${entry.id}`,
            text,
            searchText: normalizeHelpText(
              `${article.title} ${article.summary} ${article.keywords.join(" ")} ${group.heading} ${text} ${synonyms.join(" ")}`,
            ),
          });
        }
      }
    }
  }
  return [...records.values()];
}

export async function buildBotDocsIndex(): Promise<{
  version: 1;
  documents: BotDocRecord[];
}> {
  const documents: BotDocRecord[] = [];
  for (const guide of productGuidesFor("en")) {
    const article = await loadProductGuide(guide.slug);
    if (!article) {
      throw new Error(`Could not load product guide "${guide.slug}"`);
    }
    documents.push(
      ...LOCALES.flatMap((locale) =>
        productGuideRecords(guide.slug, locale, article[locale]),
      ),
    );
  }
  documents.push(...referenceRecords());
  documents.sort((left, right) => left.key.localeCompare(right.key));
  return { version: 1, documents };
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const outputPath = resolve(here, "../server/xefe-api/docs-index.json");
  const next = `${JSON.stringify(await buildBotDocsIndex(), null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== next) {
      throw new Error(
        "XefeBot documentation index is stale. Run pnpm docs:build-bot.",
      );
    }
    return;
  }
  await writeFile(outputPath, next, "utf8");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
