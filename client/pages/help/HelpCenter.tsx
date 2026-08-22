/**
 * Help & documentation — the in-app index.
 *
 * The sidebar's "Get help" points here. It used to open WhatsApp directly, and
 * that escape hatch is the FIRST thing on this page rather than a footnote:
 * our users are first-time software users on a phone, and when they are stuck
 * a human is still the fastest way out. Reading beats messaging only when the
 * answer is already written down.
 *
 * Search runs across every entry of every article, not just titles, because
 * what a reader knows is usually the word on their payslip ("severance",
 * "INSS") rather than the name of the document that explains it.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  MessageCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useI18n } from "@/i18n/I18nProvider";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support";
import {
  articlesFor,
  searchHelp,
  searchHelpArticles,
  type ArticleLocale,
} from "@/lib/help/content";
import type { LocalizedDocArticle } from "@/lib/docs/types";
import {
  loadProductGuide,
  productGuideMatchesMetadata,
  productGuidesFor,
  searchProductGuide,
} from "@/lib/help/product-guides";
import { helpResultPath } from "@/lib/help/navigation";

const SEARCH_SUGGESTIONS = ["nightShifts", "runPayroll", "inss"] as const;

export default function HelpCenter() {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [loadedGuides, setLoadedGuides] = useState<
    Record<string, LocalizedDocArticle>
  >({});
  const [failedGuides, setFailedGuides] = useState<Set<string>>(new Set());

  const articles = useMemo(
    () => articlesFor(locale as ArticleLocale),
    [locale],
  );
  const productGuides = useMemo(
    () => productGuidesFor(locale as ArticleLocale),
    [locale],
  );
  const trimmed = query.trim();
  const entryResults = useMemo(
    () =>
      trimmed.length > 1 ? searchHelp(trimmed, locale as ArticleLocale) : [],
    [trimmed, locale],
  );
  const articleResults = useMemo(
    () =>
      trimmed.length > 1
        ? searchHelpArticles(trimmed, locale as ArticleLocale).filter(
            (article) =>
              !entryResults.some((hit) => hit.article.slug === article.slug),
          )
        : [],
    [entryResults, locale, trimmed],
  );
  const searching = trimmed.length > 1;
  const guideSearchLoading =
    searching &&
    productGuides.some(
      (guide) => !loadedGuides[guide.slug] && !failedGuides.has(guide.slug),
    );

  useEffect(() => {
    if (!searching) return;
    const missing = productGuides.filter(
      (guide) => !loadedGuides[guide.slug] && !failedGuides.has(guide.slug),
    );
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map(async (guide) => ({
        slug: guide.slug,
        article: await loadProductGuide(guide.slug).catch(() => undefined),
      })),
    ).then((loaded) => {
      if (cancelled) return;
      setLoadedGuides((current) => {
        const next = { ...current };
        for (const item of loaded) {
          if (item.article) next[item.slug] = item.article;
        }
        return next;
      });
      const failures = loaded.filter((item) => !item.article);
      if (failures.length > 0) {
        setFailedGuides((current) => {
          const next = new Set(current);
          for (const item of failures) next.add(item.slug);
          return next;
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [failedGuides, loadedGuides, productGuides, searching]);

  const productSectionResults = useMemo(
    () =>
      searching
        ? productGuides.flatMap((guide) => {
            const article = loadedGuides[guide.slug];
            const content = article?.[locale as ArticleLocale] ?? article?.en;
            if (!content) return [];
            return searchProductGuide(trimmed, guide, content).map(
              (section) => ({
                guide,
                section,
              }),
            );
          })
        : [],
    [loadedGuides, locale, productGuides, searching, trimmed],
  );
  const productMetadataResults = useMemo(
    () =>
      searching
        ? productGuides.filter(
            (guide) =>
              productGuideMatchesMetadata(trimmed, guide) &&
              !productSectionResults.some(
                (hit) => hit.guide.slug === guide.slug,
              ),
          )
        : [],
    [productGuides, productSectionResults, searching, trimmed],
  );
  const resultCount =
    productSectionResults.length +
    productMetadataResults.length +
    entryResults.length +
    articleResults.length;

  const updateQuery = (nextQuery: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextQuery) next.set("q", nextQuery);
    else next.delete("q");
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6 [&>*]:max-w-4xl">
      <PageHeader
        title={t("help.title")}
        subtitle={t("help.subtitle")}
        icon={BookOpen}
        iconColor="text-primary"
      />

      {/* The rescue path, first. A person beats a document when you are stuck. */}
      <a
        href={SUPPORT_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 flex min-h-14 items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5 transition-colors hover:border-primary/50 hover:bg-primary/10"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("help.talkToUsTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {t("help.talkToUsBody")}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </a>

      <div className="mb-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder={t("help.searchPlaceholder")}
            aria-label={t("help.searchLabel")}
            className="h-12 pl-9"
          />
        </div>
        {!searching && (
          <div
            role="group"
            className="mt-2.5 flex flex-wrap items-center gap-2"
            aria-label={t("help.suggestionsLabel")}
          >
            <span className="text-xs text-muted-foreground">
              {t("help.trySearching")}
            </span>
            {SEARCH_SUGGESTIONS.map((suggestion) => {
              const label = t(`help.suggestions.${suggestion}`);
              return (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => updateQuery(label)}
                  className="inline-flex min-h-9 items-center rounded-full border border-border/70 bg-muted/20 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {searching ? (
        <section aria-live="polite">
          <p className="mb-3 text-sm text-muted-foreground">
            {resultCount === 0 && guideSearchLoading
              ? t("help.searchingGuides")
              : resultCount === 0
                ? t("help.noResults", { query: trimmed })
                : t("help.resultCount", { count: String(resultCount) })}
          </p>

          <div className="space-y-2">
            {productSectionResults.map(({ guide, section }) => (
              <Link
                key={`${guide.slug}-${section.id}`}
                to={helpResultPath(
                  `/help/guide/${guide.slug}`,
                  trimmed,
                  section.id,
                )}
                className="block rounded-xl border border-border/60 px-4 py-3 transition-colors hover:border-border hover:bg-muted/40"
              >
                <p className="text-sm font-medium">{section.heading}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {section.preview}
                </p>
                <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  {guide.title}
                </p>
              </Link>
            ))}
            {productMetadataResults.map((guide) => (
              <Link
                key={guide.slug}
                to={helpResultPath(`/help/guide/${guide.slug}`, trimmed)}
                className="block rounded-xl border border-border/60 px-4 py-3 transition-colors hover:border-border hover:bg-muted/40"
              >
                <p className="text-sm font-medium">{guide.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {guide.summary}
                </p>
                <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  {t("help.guideTag")}
                </p>
              </Link>
            ))}
            {entryResults.map((hit) => (
              <Link
                key={`${hit.article.slug}-${hit.entry.id}`}
                to={helpResultPath(
                  `/help/${hit.article.slug}`,
                  trimmed,
                  hit.entry.id,
                )}
                className="block rounded-xl border border-border/60 px-4 py-3 transition-colors hover:border-border hover:bg-muted/40"
              >
                <p className="text-sm font-medium">{hit.entry.heading}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {/* A guide step has no "today" line — its deadline, or
                      failing that its opening sentence, is the better hint. */}
                  {hit.entry.today ?? hit.entry.when ?? hit.entry.body[0]}
                </p>
                <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  {hit.article.title} · {hit.group.heading}
                </p>
              </Link>
            ))}
            {articleResults.map((article) => (
              <Link
                key={article.slug}
                to={helpResultPath(`/help/${article.slug}`, trimmed)}
                className="block rounded-xl border border-border/60 px-4 py-3 transition-colors hover:border-border hover:bg-muted/40"
              >
                <p className="text-sm font-medium">{article.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {article.summary}
                </p>
                <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  {t("help.referenceTag")}
                </p>
              </Link>
            ))}
          </div>

          {guideSearchLoading && resultCount > 0 && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("help.searchingGuides")}
            </p>
          )}

          {resultCount === 0 && !guideSearchLoading && (
            <aside
              className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-4"
              data-testid="help-no-results"
            >
              <p className="text-sm text-muted-foreground">
                {t("help.noResultsHint")}
              </p>
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <MessageCircle className="h-4 w-4" />
                {t("help.talkToUsShort")}
                <ChevronRight className="h-4 w-4" />
              </a>
            </aside>
          )}
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("help.commonTasksHeading")}
          </h2>
          <div className="space-y-3">
            {productGuides.map((guide) => (
              <Card key={guide.slug} className="overflow-hidden">
                <CardContent className="p-0">
                  <Link
                    to={`/help/guide/${guide.slug}`}
                    className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{guide.title}</p>
                        <Badge variant="secondary" className="font-normal">
                          {t("help.guideTag")}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {guide.summary}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          <Collapsible
            open={referenceOpen}
            onOpenChange={setReferenceOpen}
            className="mt-6"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {t("help.referenceHeading")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("help.referenceSummary", {
                      count: String(articles.length),
                    })}
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${referenceOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              {articles.map((article) => (
                <Card key={article.slug} className="overflow-hidden">
                  <CardContent className="p-0">
                    <Link
                      to={`/help/${article.slug}`}
                      className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{article.title}</p>
                          <Badge variant="secondary" className="font-normal">
                            {t("help.updated", { date: article.updated })}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          {article.summary}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </section>
      )}
    </div>
  );
}
