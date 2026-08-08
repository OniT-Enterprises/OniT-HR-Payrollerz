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
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, MessageCircle, Search, ChevronRight } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/I18nProvider";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support";
import { articlesFor, searchHelp, type ArticleLocale } from "@/lib/help/content";

export default function HelpCenter() {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");

  const articles = useMemo(
    () => articlesFor(locale as ArticleLocale),
    [locale],
  );
  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed.length > 1 ? searchHelp(trimmed, locale as ArticleLocale) : []),
    [trimmed, locale],
  );
  const searching = trimmed.length > 1;

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
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

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("help.searchPlaceholder")}
          aria-label={t("help.searchLabel")}
          className="h-12 pl-9"
        />
      </div>

      {searching ? (
        <section aria-live="polite">
          <p className="mb-3 text-sm text-muted-foreground">
            {results.length === 0
              ? t("help.noResults", { query: trimmed })
              : t("help.resultCount", { count: String(results.length) })}
          </p>

          <div className="space-y-2">
            {results.map((hit) => (
              <Link
                key={`${hit.article.slug}-${hit.entry.id}`}
                to={`/help/${hit.article.slug}#${hit.entry.id}`}
                className="block rounded-xl border border-border/60 px-4 py-3 transition-colors hover:border-border hover:bg-muted/40"
              >
                <p className="text-sm font-medium">{hit.entry.heading}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {/* A guide step has no "today" line — its deadline, or
                      failing that its opening sentence, is the better hint. */}
                  {hit.entry.today ?? hit.entry.when ?? hit.entry.body[0]}
                </p>
                <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                  {hit.group.heading}
                </p>
              </Link>
            ))}
          </div>

          {results.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("help.noResultsHint")}
            </p>
          )}
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("help.articlesHeading")}
          </h2>
          <div className="space-y-3">
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
          </div>
        </section>
      )}
    </div>
  );
}
