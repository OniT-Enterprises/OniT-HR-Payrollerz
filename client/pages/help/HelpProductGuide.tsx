import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { HelpSupportCard } from "@/components/help/HelpSupportCard";
import { InAppDocBlock } from "@/components/help/InAppDocBlocks";
import PageHeader from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useHelpSearchTarget } from "@/hooks/useHelpSearchTarget";
import { useI18n } from "@/i18n/I18nProvider";
import type { DocBlock, LocalizedDocArticle } from "@/lib/docs/types";
import { loadProductGuide, productGuidesFor } from "@/lib/help/product-guides";
import type { ArticleLocale } from "@/lib/help/content";
import { helpCenterPath, helpSearchQuery } from "@/lib/help/navigation";
import { cn } from "@/lib/utils";

export default function HelpProductGuide() {
  const { t, locale } = useI18n();
  const { slug = "" } = useParams();
  const location = useLocation();
  const guide = productGuidesFor(locale as ArticleLocale).find(
    (candidate) => candidate.slug === slug,
  );
  const [articles, setArticles] = useState<Record<string, LocalizedDocArticle>>(
    {},
  );
  const [failedSlugs, setFailedSlugs] = useState<Set<string>>(new Set());
  const article = articles[slug];
  const content = article?.[locale as ArticleLocale] ?? article?.en;
  const highlightedTarget = useHelpSearchTarget(Boolean(content));
  const backToHelp = helpCenterPath(helpSearchQuery(location.search));

  useEffect(() => {
    if (!guide || article || failedSlugs.has(slug)) return;
    let cancelled = false;
    loadProductGuide(slug)
      .then((loaded) => {
        if (!cancelled && loaded) {
          setArticles((current) => ({ ...current, [slug]: loaded }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailedSlugs((current) => new Set(current).add(slug));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [article, failedSlugs, guide, slug]);

  if (!guide) return <Navigate to="/help" replace />;

  const headings =
    content?.blocks.filter(
      (block): block is Extract<DocBlock, { type: "heading" }> =>
        block.type === "heading",
    ) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
      <Link
        to={backToHelp}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("help.backToHelp")}
      </Link>

      <div
        id="overview"
        tabIndex={-1}
        data-search-highlight={
          highlightedTarget === "overview" ? "true" : undefined
        }
        className={cn(
          "scroll-mt-20 rounded-xl transition-[background-color,box-shadow] duration-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          highlightedTarget === "overview" &&
            "bg-primary/10 ring-2 ring-primary/30 ring-offset-4 ring-offset-background",
        )}
      >
        <PageHeader
          title={
            content ? `${content.titleTop} ${content.titleAccent}` : guide.title
          }
          subtitle={content?.lede ?? guide.summary}
          icon={BookOpen}
          iconColor="text-primary"
        />
      </div>

      {failedSlugs.has(slug) ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {t("help.guideLoadFailed")}
          </p>
        </div>
      ) : !content ? (
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : (
        <>
          {headings.length > 0 && (
            <nav
              aria-label={t("help.contentsHeading")}
              className="mb-8 rounded-xl border border-border/60 p-4"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("help.contentsHeading")}
              </p>
              <ul className="space-y-1.5">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a
                      href={`#${heading.id}`}
                      className="inline-flex min-h-9 items-center text-sm text-primary hover:underline"
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <article>
            {content.blocks.map((block, index) => (
              <InAppDocBlock
                key={index}
                block={block}
                highlighted={
                  block.type === "heading" &&
                  block.id === highlightedTarget
                }
              />
            ))}
          </article>

          <HelpSupportCard
            action={{
              to: guide.action.to,
              label: t(guide.action.labelKey),
            }}
          />
        </>
      )}
    </div>
  );
}
