/**
 * /docs — public documentation home. Marketing design language: lime accent
 * (shared with the docs articles), crescent-only decoration, honest scope —
 * it lists what exists, never "coming soon" placeholders.
 */
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { PublicNav } from "@/components/marketing/PublicNav";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { localeFromPath, withLocalePrefix } from "@/lib/publicLocale";

export default function DocsIndex() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const locale = localeFromPath(pathname);
  const p = (path: string) => withLocalePrefix(path, locale);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <SEO {...seoConfig.docsIndex} />
      <PublicNav />

      <header className="mx-auto max-w-5xl px-6 pb-12 pt-16 sm:pt-24">
        <SectionEyebrow accent="lime">
          {t("publicDocs.eyebrow")}
        </SectionEyebrow>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
          {t("publicDocs.hub.titleTop")}{" "}
          <span className="bg-gradient-to-r from-lime-300 to-lime-500 bg-clip-text text-transparent">
            {t("publicDocs.hub.titleAccent")}
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
          {t("publicDocs.hub.lede")}
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <Link
          to={p("/docs/payroll-money-chain")}
          className="group block rounded-2xl border border-white/[0.07] bg-white/[0.025] p-7 transition-colors hover:border-lime-400/40"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-lime-300">
            {t("publicDocs.hub.article1Tag")}
          </p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
            {t("publicDocs.hub.article1Title")}
          </h2>
          <p className="mt-2 max-w-2xl leading-7 text-zinc-400">
            {t("publicDocs.hub.article1Desc")}
          </p>
          <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-lime-300">
            {t("publicDocs.hub.readArticle")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>

        <p className="mt-8 max-w-2xl text-sm leading-6 text-zinc-500">
          {t("publicDocs.hub.more")}{" "}
          <Link
            to={p("/engine")}
            className="font-semibold text-zinc-300 underline decoration-white/20 underline-offset-4 hover:text-white"
          >
            {t("publicDocs.hub.moreEngine")}
          </Link>
        </p>
      </section>

      <PublicFooter />
    </div>
  );
}
