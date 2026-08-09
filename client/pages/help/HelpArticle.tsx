/**
 * A single help article.
 *
 * Long-form on a phone is the hard case, so the shape is: a contents list you
 * can skip past, then entries as self-contained cards. Every entry states
 * "what Xefe does today" in the same place with the same emphasis — that is
 * the line a reader is actually looking for, and burying it inside prose is
 * how a disclosure becomes decoration.
 *
 * Bodies are English-only for now (see client/lib/help/content.ts for why),
 * and a reader in another language is told so rather than left to assume the
 * translation is missing by accident.
 */
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CalendarClock, Info } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { HelpSupportCard } from "@/components/help/HelpSupportCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import {
  getArticle,
  type ArticleLocale,
  type HelpEntry,
  type PositionStatus,
} from "@/lib/help/content";

const STATUS_STYLES: Record<PositionStatus, string> = {
  confirming:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  settled:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "asks-you": "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

const ARTICLE_ACTIONS: Record<string, { to: string; labelKey: string }> = {
  "your-month": { to: "/payroll/run", labelKey: "help.actions.openPayroll" },
  "when-someone-leaves": {
    to: "/people/offboarding",
    labelKey: "help.actions.openOffboarding",
  },
};

/**
 * Renders **bold** spans. The bodies are authored data, not user input, and
 * this is the only markup they use — a markdown dependency for one delimiter
 * would cost more than it earns.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

function EntryCard({
  entry,
  t,
}: {
  entry: HelpEntry;
  t: (k: string) => string;
}) {
  return (
    <Card id={entry.id} className="scroll-mt-20">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug">
            {entry.heading}
          </h3>
          {/* Guides have no side to be on — only positions carry a status. */}
          {entry.status && (
            <Badge
              variant="outline"
              className={`shrink-0 font-normal ${STATUS_STYLES[entry.status]}`}
            >
              {t(`help.status.${entry.status}`)}
            </Badge>
          )}
        </div>

        {entry.quote && (
          <blockquote className="border-l-2 border-border pl-3">
            <p className="text-sm italic text-muted-foreground">
              {entry.quote}
            </p>
            {entry.quoteCite && (
              <cite className="mt-1 block text-xs not-italic text-muted-foreground/80">
                {entry.quoteCite}
              </cite>
            )}
          </blockquote>
        )}

        <div className="space-y-2.5 text-sm text-muted-foreground">
          {entry.body.map((paragraph, i) => (
            <p key={i}>
              <RichText text={paragraph} />
            </p>
          ))}
        </div>

        {/* A deadline is the line people scan for, so it gets its own block
            with a date-shaped label rather than sitting inside a paragraph. */}
        {entry.when && (
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {t("help.whenLabel")}
              </p>
              <p className="mt-0.5 text-sm">{entry.when}</p>
            </div>
          </div>
        )}

        {entry.today && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("help.todayLabel")}
            </p>
            <p className="mt-1 text-sm">{entry.today}</p>
          </div>
        )}

        {entry.impact && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("help.impactLabel")}{" "}
            </span>
            {entry.impact}
          </p>
        )}

        {entry.open && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {t("help.openLabel")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{entry.open}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HelpArticlePage() {
  const { t, locale } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getArticle(slug, locale as ArticleLocale) : undefined;

  // Deep links from search carry #entry-id. React Router does not scroll to a
  // fragment on its own, and the content mounts after the route does.
  useEffect(() => {
    if (!article) return;
    const id = window.location.hash.slice(1);
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [article]);

  if (!article) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">{t("help.notFound")}</p>
        <Link
          to="/help"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("help.backToHelp")}
        </Link>
      </div>
    );
  }

  const articleAction = ARTICLE_ACTIONS[article.slug];

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
      <Link
        to="/help"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("help.backToHelp")}
      </Link>

      <PageHeader
        title={article.title}
        subtitle={t("help.updated", { date: article.updated })}
        icon={BookOpen}
        iconColor="text-primary"
      />

      {/* Only when THIS article fell back — a reader looking at the Tetun
          guide should not be told it is English-only. */}
      {locale !== "en" && article.locale === "en" && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("help.englishOnly")}
          </p>
        </div>
      )}

      <div className="mb-8 space-y-3 text-sm text-muted-foreground">
        {article.intro.map((paragraph, i) => (
          <p key={i}>
            <RichText text={paragraph} />
          </p>
        ))}
      </div>

      {/* Contents — long-form on a phone needs a way past it. */}
      <nav
        aria-label={t("help.contentsHeading")}
        className="mb-8 rounded-xl border border-border/60 p-4"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("help.contentsHeading")}
        </p>
        <ul className="space-y-1.5">
          {article.groups.map((group) => (
            <li key={group.id}>
              <a
                href={`#${group.id}`}
                className="text-sm text-primary hover:underline"
              >
                {group.heading}
              </a>
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({group.entries.length})
              </span>
              <ul className="ml-3 mt-1 border-l border-border/60 pl-3">
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      className="inline-flex min-h-8 items-center text-xs text-muted-foreground hover:text-primary hover:underline"
                    >
                      {entry.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-10">
        {article.groups.map((group) => (
          <section key={group.id} id={group.id} className="scroll-mt-20">
            <h2 className="text-lg font-semibold">{group.heading}</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              {group.blurb}
            </p>
            <div className="space-y-4">
              {group.entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <HelpSupportCard
        action={
          articleAction
            ? {
                to: articleAction.to,
                label: t(articleAction.labelKey),
              }
            : undefined
        }
      />
    </div>
  );
}
