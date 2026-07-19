import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Crescent } from "@/components/marketing/Crescent";
import { FoundingOffer } from "@/components/marketing/FoundingOffer";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PackagePicker } from "@/components/pricing/PackagePicker";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

export default function Pricing() {
  const { t } = useI18n();

  const trustItems = [
    t("landing.simple.hero.trust.noCard"),
    t("landing.simple.hero.trust.languages"),
    t("landing.simple.hero.trust.localSupport"),
  ];

  return (
    <div className="public-grain min-h-screen overflow-x-hidden text-white">
      <SEO {...seoConfig.pricing} />

      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-zinc-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("common.skipToContent")}
      </a>

      <PublicNav />

      <main id="main-content">
        <section className="relative overflow-hidden pb-4 pt-28 sm:pt-32 lg:pt-36">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.08),transparent_42%)]" />
          <Crescent className="pointer-events-none absolute -right-24 -top-28 hidden h-[520px] w-[520px] text-amber-400/[0.045] md:block" />
          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-6 lg:px-8">
            <SectionEyebrow>{t("landing.simple.pricing.eyebrow")}</SectionEyebrow>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              {t("landing.simple.pricing.title")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-zinc-400">
              {t("landing.simple.pricing.description")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 text-sm text-zinc-400 sm:flex-row sm:justify-center sm:gap-x-6">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto mt-4 max-w-4xl px-5 sm:px-6 lg:px-8">
          <FoundingOffer />
        </div>

        <PackagePicker showHeader={false} />

        <section className="border-t border-white/[0.06] py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {t("landing.simple.support.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">
              {t("landing.simple.support.description")}
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 bg-amber-400 px-7 text-base font-bold text-zinc-950 shadow-xl shadow-amber-500/20 hover:bg-amber-300"
              >
                <Link to="/auth/signup">
                  {t("landing.simple.hero.primary")}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 border-white/10 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <a href="https://wa.me/67073371307">
                  {t("landing.simple.support.whatsapp")}
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
