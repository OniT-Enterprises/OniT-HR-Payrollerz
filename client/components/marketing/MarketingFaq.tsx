/**
 * Marketing FAQ section — a small, high-intent Q&A block that answers the local
 * questions people actually search ("does it do WIT/INSS?", "which banks?",
 * "is it in Tetun?", "how much?"). Doubles as an AI-answer-engine surface.
 *
 * Emits FAQPage JSON-LD built from the exact same visible strings, so the
 * structured data can never drift from what the page shows. Copy lives under
 * `landing.simple.faq.*` (en / tet / pt).
 */
import { Helmet } from "react-helmet-async";
import { Plus } from "lucide-react";

import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { useI18n } from "@/i18n/I18nProvider";

const ITEM_COUNT = 6;

export function MarketingFaq() {
  const { t } = useI18n();

  const items = Array.from({ length: ITEM_COUNT }, (_, i) => {
    const n = i + 1;
    return {
      q: t(`landing.simple.faq.q${n}`),
      a: t(`landing.simple.faq.a${n}`),
    };
  }).filter((item) => item.q && item.a);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <section className="lp-defer border-t border-white/[0.06] py-20 lg:py-24">
      {items.length > 0 && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        </Helmet>
      )}
      <div
        data-reveal
        className="public-reveal mx-auto max-w-3xl px-5 sm:px-6 lg:px-8"
      >
        <div className="text-center">
          <SectionEyebrow>{t("landing.simple.faq.eyebrow")}</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white lg:text-[2.6rem]">
            {t("landing.simple.faq.title")}
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {items.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] transition-colors hover:border-white/[0.12] open:border-amber-400/25 open:bg-amber-400/[0.03]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left text-base font-semibold text-white [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus className="h-5 w-5 shrink-0 text-amber-300 transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-6 text-zinc-400">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
