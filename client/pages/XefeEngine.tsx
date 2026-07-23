/**
 * /engine — the public "under the hood" page. Marketing design language
 * (docs/DESIGN_MARKETING.md): amber accent, crescent-only decoration, a real
 * calculation artifact as the hero, still page (no scroll animation).
 *
 * The proof section deliberately speaks in general terms about how the engine
 * is validated (statute tests, real-world practice, official assessments) —
 * no sourcing details.
 */
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  Cog,
  Landmark,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Crescent } from "@/components/marketing/Crescent";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicSectionNav } from "@/components/marketing/PublicSectionNav";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { localeFromPath, withLocalePrefix } from "@/lib/publicLocale";
import { cn } from "@/lib/utils";

function TraceRow({
  label,
  cite,
  value,
  variant,
}: {
  label: string;
  cite?: string;
  value: string;
  variant?: "sub" | "total";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-3 py-1.5",
        variant === "total" &&
          "mt-2 border-t border-white/15 pt-3 font-bold",
      )}
    >
      <span
        className={cn(
          "min-w-0",
          variant === "sub" ? "text-xs text-zinc-400" : "text-zinc-300",
          variant === "total" && "text-white",
        )}
      >
        {label}
        {cite && (
          <span className="ml-2 whitespace-nowrap font-mono text-[10px] tracking-tight text-zinc-600">
            {cite}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="mx-1 hidden flex-1 -translate-y-1 border-b border-dotted border-white/15 sm:block"
      />
      <span
        className={cn(
          "ml-auto shrink-0 font-mono tabular-nums sm:ml-0",
          variant === "sub" ? "text-xs text-zinc-400" : "text-zinc-100",
          variant === "total" && "text-lg text-amber-300",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function XefeEngine() {
  const { t } = useI18n();
  const location = useLocation();
  const locale = localeFromPath(location.pathname);
  const to = (path: string) => withLocalePrefix(path, locale);

  const stats = [
    { value: "600+", labelKey: "enginePage.hero.statTests" },
    { value: "5", labelKey: "enginePage.hero.statStatutes" },
    { value: "77", labelKey: "enginePage.hero.statAccounts" },
    { value: "3", labelKey: "enginePage.hero.statLanguages" },
  ];

  const lawCards = [
    {
      title: "Lei do Trabalho — Lei 4/2012",
      subKey: "enginePage.law.labourSub",
      items: [
        { key: "enginePage.law.labour.hours", art: "Art. 25" },
        { key: "enginePage.law.labour.ot", art: "Art. 27" },
        { key: "enginePage.law.labour.otCap", art: "Art. 27" },
        { key: "enginePage.law.labour.sick", art: "Art. 42" },
        { key: "enginePage.law.labour.cap", art: "Art. 42(3)" },
        { key: "enginePage.law.labour.thirteenth", art: "Art. 44" },
        { key: "enginePage.law.labour.severance", art: "Art. 56" },
      ],
    },
    {
      title: "Lei Tributária — Lei 8/2008",
      subKey: "enginePage.law.taxSub",
      items: [
        { key: "enginePage.law.tax.resident", art: "Anexo V" },
        { key: "enginePage.law.tax.nonResident", art: "Art. 20–22" },
        { key: "enginePage.law.tax.periods", art: "" },
        { key: "enginePage.law.tax.wht", art: "Art. 53–60" },
        { key: "enginePage.law.tax.refuse", art: "" },
      ],
    },
    {
      title: "INSS — DL 20/2017 + DL 30/2021",
      subKey: "enginePage.law.inssSub",
      items: [
        { key: "enginePage.law.inss.rates", art: "Art. 10" },
        { key: "enginePage.law.inss.exclude", art: "Art. 9" },
        { key: "enginePage.law.inss.include", art: "Art. 8" },
        { key: "enginePage.law.inss.bonus", art: "Art. 8–9" },
      ],
    },
  ];

  const tiers = [
    { name: "enginePage.proof.tier1Name", text: "enginePage.proof.tier1" },
    { name: "enginePage.proof.tier2Name", text: "enginePage.proof.tier2" },
    { name: "enginePage.proof.tier3Name", text: "enginePage.proof.tier3", top: true },
  ];

  const rates: Array<{ key: string; rate: string; confirmed: boolean }> = [
    { key: "rent", rate: "10%", confirmed: true },
    { key: "construction", rate: "2%", confirmed: true },
    { key: "consulting", rate: "4%", confirmed: true },
    { key: "nonresWages", rate: "10%", confirmed: true },
    { key: "resWages", rate: "10% > $500", confirmed: true },
    { key: "royalty", rate: "10%", confirmed: false },
    { key: "transport", rate: "2.64%", confirmed: false },
    { key: "mining", rate: "4.5%", confirmed: false },
  ];

  const steps = ["compile", "guard", "post", "deliver", "file", "pay"];

  const trustCards = [{ key: "scale", icon: Cog }];

  return (
    <div className="public-grain min-h-screen overflow-x-hidden text-white">
      <SEO {...seoConfig.engine} />

      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-zinc-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("common.skipToContent")}
      </a>

      <PublicNav />
      <PublicSectionNav
        pageLabelKey="landing.nav.engine"
        accent="amber"
        sections={[
          { id: "law", labelKey: "enginePage.nav.law" },
          { id: "proof", labelKey: "enginePage.nav.proof" },
          { id: "pipeline", labelKey: "enginePage.nav.pipeline" },
          { id: "trust", labelKey: "enginePage.nav.trust" },
        ]}
      />

      <main id="main-content">
        {/* ── hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pb-16 pt-40 sm:pt-44 lg:pb-20 lg:pt-52">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(251,191,36,0.09),transparent_40%)]" />
          <Crescent className="pointer-events-none absolute -right-24 -top-28 hidden h-[520px] w-[520px] text-amber-400/[0.05] md:block" />
          <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="grid items-start gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3.5 py-2 text-sm text-amber-200">
                  <Cog className="h-4 w-4" />
                  {t("enginePage.hero.eyebrow")}
                </div>
                <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.6rem]">
                  {t("enginePage.hero.title")}
                  <span className="mt-1 block bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
                    {t("enginePage.hero.titleAccent")}
                  </span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
                  {t("enginePage.hero.description")}
                </p>
                <div className="mt-10 grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 border-t border-white/[0.07] pt-8 sm:grid-cols-4">
                  {stats.map((stat) => (
                    <div key={stat.labelKey}>
                      <div className="font-mono text-[1.7rem] font-light tabular-nums leading-none text-white">
                        {stat.value}
                      </div>
                      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        {t(stat.labelKey)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* the calculation artifact is the hero */}
              <div className="relative">
                <Crescent className="absolute -left-7 -top-14 h-16 w-16 -rotate-[25deg] text-amber-400/80 drop-shadow-[0_0_20px_rgba(251,191,36,0.25)]" />
                <div className="relative rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl shadow-black/50 sm:p-7">
                  <div className="mb-4 flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                      {t("enginePage.trace.heading")}
                    </p>
                    <span className="hidden shrink-0 text-[11px] text-zinc-400 sm:block">
                      {t("enginePage.trace.profile")}
                    </span>
                  </div>
                  <div className="text-sm">
                    <TraceRow
                      label={t("landing.tax.example.basicSalary")}
                      value="$1,200.00"
                    />
                    <TraceRow
                      variant="sub"
                      label={`${t("enginePage.trace.hourlyRate")} · 1,200 × 12 ÷ (44 × 52)`}
                      cite="Art. 25 · Lei 4/2012"
                      value="$6.29"
                    />
                    <TraceRow
                      label={`${t("landing.tax.example.overtime")} · 12 h`}
                      cite="Art. 27 · Lei 4/2012"
                      value="+$113.22"
                    />
                    <TraceRow
                      label={t("landing.tax.example.foodAllowance")}
                      value="+$100.00"
                    />
                    <TraceRow
                      label={t("landing.tax.example.gross")}
                      value="$1,413.22"
                    />
                    <TraceRow
                      label={t("landing.tax.example.wit")}
                      cite="Lei 8/2008 · Anexo V"
                      value="−$91.32"
                    />
                    <TraceRow
                      label={t("landing.tax.example.inss")}
                      cite="Art. 10 · DL 20/2017"
                      value="−$48.00"
                    />
                    <TraceRow
                      variant="sub"
                      label={t("enginePage.trace.inssNote")}
                      cite="Art. 9 · DL 20/2017"
                      value=""
                    />
                    <TraceRow
                      variant="total"
                      label={t("landing.tax.example.net")}
                      value="$1,273.90"
                    />
                    <TraceRow
                      variant="sub"
                      label={t("enginePage.trace.employerInss")}
                      value="+$72.00"
                    />
                    <TraceRow
                      variant="sub"
                      label={t("enginePage.trace.thirteenth")}
                      cite="Art. 44 · Lei 4/2012"
                      value={`$100.00${t("enginePage.trace.perMonth")}`}
                    />
                  </div>
                  <p className="mt-4 border-t border-white/[0.07] pt-4 text-xs leading-5 text-zinc-400">
                    {t("enginePage.trace.footCeiling")}{" "}
                    {t("enginePage.trace.footPrecision")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── the law ──────────────────────────────────────────── */}
        <section id="law" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("enginePage.law.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("enginePage.law.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("enginePage.law.description")}</p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {lawCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10">
                    <Scale className="h-5 w-5 text-amber-300" />
                  </div>
                  <h3 className="mt-5 font-bold">{card.title}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {t(card.subKey)}
                  </p>
                  <ul className="mt-4 divide-y divide-white/[0.06]">
                    {card.items.map((item) => (
                      <li
                        key={item.key}
                        className="flex items-baseline justify-between gap-3 py-2.5 text-sm leading-6 text-zinc-300"
                      >
                        <span>{t(item.key)}</span>
                        {item.art && (
                          <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-zinc-600">
                            {item.art}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="mx-auto mt-4 max-w-7xl rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-6">
              <h3 className="font-bold text-amber-200">
                {t("enginePage.law.configTitle")}
              </h3>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-300">
                {t("enginePage.law.configDescription")}
              </p>
            </div>
          </div>
        </section>

        {/* ── proof ────────────────────────────────────────────── */}
        <section id="proof" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("enginePage.proof.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("enginePage.proof.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("enginePage.proof.description")}</p>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-4">
              {tiers.map((tier, index) => (
                <article
                  key={tier.name}
                  className={cn(
                    "grid gap-5 rounded-2xl border p-6 sm:grid-cols-[160px_1fr] sm:p-7",
                    tier.top
                      ? "border-amber-400/25 bg-amber-400/[0.05]"
                      : "border-white/[0.07] bg-white/[0.025]",
                  )}
                >
                  <div>
                    <p
                      className={cn(
                        "font-mono text-[11px] font-bold uppercase tracking-[0.2em]",
                        tier.top ? "text-amber-300" : "text-zinc-500",
                      )}
                    >
                      {t("enginePage.proof.tierLabel")} {index + 1}
                    </p>
                    <h3 className="mt-2 text-[15px] font-bold leading-5">
                      {t(tier.name)}
                    </h3>
                  </div>
                  <p className="text-sm leading-7 text-zinc-300">{t(tier.text)}</p>
                </article>
              ))}
            </div>

            <div className="mx-auto mt-10 max-w-5xl">
              <h3 className="font-bold">{t("enginePage.proof.ratesTitle")}</h3>
              <p className="mt-1 text-sm text-zinc-400">
                {t("enginePage.proof.ratesNote")}
              </p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                <table className="w-full min-w-[540px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      <th className="px-5 py-3">{t("enginePage.proof.rateCategory")}</th>
                      <th className="px-5 py-3 text-right">{t("enginePage.proof.rateRate")}</th>
                      <th className="px-5 py-3">{t("enginePage.proof.rateBasis")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((row) => (
                      <tr key={row.key} className="border-b border-white/[0.05] last:border-b-0">
                        <td className="px-5 py-2.5 text-zinc-300">
                          {t(`enginePage.proof.rates.${row.key}`)}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono tabular-nums text-white">
                          {row.rate}
                        </td>
                        <td className="px-5 py-2.5">
                          <span
                            className={cn(
                              "inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              row.confirmed
                                ? "border-lime-400/30 text-lime-300"
                                : "border-white/15 text-zinc-500",
                            )}
                          >
                            {t(
                              row.confirmed
                                ? "enginePage.proof.basisConfirmed"
                                : "enginePage.proof.basisStatute",
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── pipeline ─────────────────────────────────────────── */}
        <section id="pipeline" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("enginePage.pipeline.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("enginePage.pipeline.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("enginePage.pipeline.description")}</p>
            </div>

            <div className="mx-auto mt-12 max-w-4xl">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="grid grid-cols-[64px_1fr] gap-5 border-t border-white/[0.06] py-7 first:border-t-0 sm:grid-cols-[96px_1fr] sm:gap-8"
                >
                  <span className="select-none font-mono text-5xl font-bold leading-none text-white/[0.06] sm:text-6xl">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold">
                      {t(`enginePage.pipeline.steps.${step}.title`)}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-400">
                      {t(`enginePage.pipeline.steps.${step}.description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── trust ────────────────────────────────────────────── */}
        <section id="trust" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("enginePage.trust.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("enginePage.trust.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("enginePage.trust.description")}</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {trustCards.map(({ key, icon: Icon }) => (
                <article
                  key={key}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10">
                    <Icon className="h-5 w-5 text-amber-300" />
                  </div>
                  <h3 className="mt-5 font-bold">
                    {t(`enginePage.trust.cards.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {t(`enginePage.trust.cards.${key}.description`)}
                  </p>
                </article>
              ))}
              <Link
                to={to("/security")}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition-colors hover:border-white/[0.14]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10">
                  <ShieldCheck className="h-5 w-5 text-amber-300" />
                </div>
                <h3 className="mt-5 font-bold">
                  {t("enginePage.trust.securityLink.title")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {t("enginePage.trust.securityLink.description")}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300">
                  {t("enginePage.trust.securityLink.cta")}
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── cta ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-white/[0.06] py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08),transparent_52%)]" />
          <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-6">
            <Landmark className="mx-auto h-8 w-8 text-amber-400" />
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight">
              {t("enginePage.cta.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              {t("enginePage.cta.description")}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 bg-amber-400 px-8 font-bold text-zinc-950 hover:bg-amber-300"
              >
                <Link to="/auth/signup">
                  {t("landing.nav.getStarted")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 border-white/10 bg-white/5 px-7 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to={to("/pricing")}>
                  {t("enginePage.cta.secondary")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="mx-auto mt-8 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <BookOpenCheck className="h-4 w-4" />
              {t("enginePage.cta.footnote")}
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
