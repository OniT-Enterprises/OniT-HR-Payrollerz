import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { HelpSupportCard } from "@/components/help/HelpSupportCard";
import { InAppDocBlock } from "@/components/help/InAppDocBlocks";
import PageHeader from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/I18nProvider";
import type { DocBlock, LocalizedDocArticle } from "@/lib/docs/types";
import { loadProductGuide, productGuidesFor } from "@/lib/help/product-guides";
import type { ArticleLocale } from "@/lib/help/content";

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

  useEffect(() => {
    if (!content || !location.hash) return;
    requestAnimationFrame(() => {
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ block: "start" });
    });
  }, [content, location.hash]);

  if (!guide) return <Navigate to="/help" replace />;

  const headings =
    content?.blocks.filter(
      (block): block is Extract<DocBlock, { type: "heading" }> =>
        block.type === "heading",
    ) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
      <Link
        to="/help"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("help.backToHelp")}
      </Link>

      <div id="overview" className="scroll-mt-20">
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
              <InAppDocBlock key={index} block={block} />
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
