/**
 * /docs/:slug — shared renderer for the public documentation articles.
 * Content lives in client/content/docs/<slug>.ts (typed blocks, three
 * locales), listed in client/lib/docs/manifest.ts, lazy-loaded per article.
 * Marketing design language: lime accent, one accent per page.
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DocBlockRenderer } from "@/components/marketing/DocsBlocks";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { PublicNav } from "@/components/marketing/PublicNav";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { docsManifestBySlug } from "@/lib/docs/manifest";
import { DOC_LOADERS } from "@/lib/docs/registry";
import type { LocalizedDocArticle } from "@/lib/docs/types";
import { localeFromPath, withLocalePrefix } from "@/lib/publicLocale";

export default function DocsArticle() {
  const { t } = useI18n();
  const { slug = "" } = useParams();
  const { pathname } = useLocation();
  const locale = localeFromPath(pathname);
  const p = (path: string) => withLocalePrefix(path, locale);

  const entry = docsManifestBySlug(slug);
  const loader = DOC_LOADERS[slug];

  // Cache per slug: the current slug missing from the map IS the loading
  // state, so the effect never needs a synchronous reset.
  const [articles, setArticles] = useState<
    Record<string, LocalizedDocArticle>
  >({});
  const article = articles[slug];
  useEffect(() => {
    if (!loader) return;
    let cancelled = false;
    loader().then((mod) => {
      if (!cancelled) {
        setArticles((current) =>
          current[slug] ? current : { ...current, [slug]: mod.article },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loader, slug]);

  // Unknown slug (or a custom article that has its own component/route).
  if (!entry || entry.custom || !loader) {
    return <Navigate to={p("/docs")} replace />;
  }

  const content = article?.[locale] ?? article?.en;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <SEO {...entry.seo} type="article" />
      <PublicNav />

      <header className="mx-auto max-w-5xl px-6 pb-4 pt-16 sm:pt-20">
        <Link
          to={p("/docs")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("publicDocs.eyebrow")}
        </Link>
        <div>
          <SectionEyebrow accent="lime">
            {entry.hub[locale].tag}
          </SectionEyebrow>
        </div>
        {content ? (
          <>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              {content.titleTop}{" "}
              <span className="bg-gradient-to-r from-lime-300 to-lime-500 bg-clip-text text-transparent">
                {content.titleAccent}
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
              {content.lede}
            </p>
          </>
        ) : (
          <div className="mt-4 space-y-4" aria-hidden>
            <div className="h-12 w-2/3 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-white/[0.04]" />
          </div>
        )}
      </header>

      <article className="mx-auto max-w-5xl px-6 pb-16">
        {content ? (
          content.blocks.map((block, index) => (
            <DocBlockRenderer key={index} block={block} />
          ))
        ) : (
          <div className="mt-8 space-y-3" aria-hidden>
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="h-4 max-w-2xl animate-pulse rounded bg-white/[0.04]"
              />
            ))}
          </div>
        )}
      </article>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="flex flex-col items-start gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              {t("publicDocs.chain.cta.title")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              {t("publicDocs.chain.cta.body")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button
              asChild
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              <Link to={p("/engine")}>{t("publicDocs.chain.cta.engine")}</Link>
            </Button>
            <Button
              asChild
              className="bg-amber-400 font-semibold text-black hover:bg-amber-300"
            >
              <Link to="/auth/signup">
                {t("publicDocs.chain.cta.signup")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
