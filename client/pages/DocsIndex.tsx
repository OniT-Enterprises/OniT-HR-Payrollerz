/**
 * /docs — public documentation home, driven by client/lib/docs/manifest.ts.
 * Marketing design language: lime accent, honest scope — it lists what
 * exists, never "coming soon" placeholders.
 */
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { PublicNav } from "@/components/marketing/PublicNav";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import { DOCS_MANIFEST } from "@/lib/docs/manifest";
import { localeFromPath, withLocalePrefix } from "@/lib/publicLocale";

export default function DocsIndex() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const locale = localeFromPath(pathname);
  const p = (path: string) => withLocalePrefix(path, locale);

  const groups = [
    { key: "guides" as const, label: t("publicDocs.hub.guides") },
    { key: "architecture" as const, label: t("publicDocs.hub.architecture") },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <SEO {...seoConfig.docsIndex} />
      <PublicNav />

      <header className="mx-auto max-w-5xl px-6 pb-12 pt-16 sm:pt-24">
        <SectionEyebrow accent="lime">{t("publicDocs.eyebrow")}</SectionEyebrow>
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
        {groups.map((group) => {
          const entries = DOCS_MANIFEST.filter(
            (entry) => entry.category === group.key,
          );
          if (entries.length === 0) return null;
          return (
            <div key={group.key} className="mt-10 first:mt-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500">
                {group.label}
              </p>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {entries.map((entry) => {
                  const card = entry.hub[locale];
                  return (
                    <Link
                      key={entry.slug}
                      to={p(`/docs/${entry.slug}`)}
                      className="group block rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition-colors hover:border-lime-400/40"
                    >
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-lime-300">
                        {card.tag}
                      </p>
                      <h2 className="mt-2.5 text-xl font-extrabold tracking-tight">
                        {card.title}
                      </h2>
                      <p className="mt-1.5 text-sm leading-6 text-zinc-400">
                        {card.desc}
                      </p>
                      <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-lime-300">
                        {t("publicDocs.hub.readArticle")}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        <p className="mt-12 max-w-2xl text-sm leading-6 text-zinc-500">
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
