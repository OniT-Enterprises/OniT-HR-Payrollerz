import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronRight,
  FileText,
  Landmark,
  Languages,
  Mail,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Crescent } from "@/components/marketing/Crescent";
import { FoundingOffer } from "@/components/marketing/FoundingOffer";
import { MarketingFaq } from "@/components/marketing/MarketingFaq";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { PayslipExample } from "@/components/marketing/PayslipExample";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicSectionNav } from "@/components/marketing/PublicSectionNav";
import { DEFAULT_PACKAGES_CONFIG } from "@/lib/packagePricing";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { PRIMOS_BOOT_PARTNER } from "@/lib/accountantPartners";



function OutcomeCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.035]">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10">
        <Icon className="h-5 w-5 text-amber-300" />
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
    </article>
  );
}

export default function Landing() {
  const { t, locale } = useI18n();
  useScrollReveal();

  const workflow = [
    {
      icon: UsersRound,
      title: t("landing.simple.workflow.steps.add.title"),
      description: t("landing.simple.workflow.steps.add.description"),
    },
    {
      icon: Calculator,
      title: t("landing.simple.workflow.steps.calculate.title"),
      description: t("landing.simple.workflow.steps.calculate.description"),
    },
    {
      icon: Landmark,
      title: t("landing.simple.workflow.steps.pay.title"),
      description: t("landing.simple.workflow.steps.pay.description"),
    },
  ];

  const outcomes = [
    {
      icon: UsersRound,
      title: t("landing.simple.features.people.title"),
      description: t("landing.simple.features.people.description"),
    },
    {
      icon: Calculator,
      title: t("landing.simple.features.payroll.title"),
      description: t("landing.simple.features.payroll.description"),
    },
    {
      icon: ReceiptText,
      title: t("landing.simple.features.invoices.title"),
      description: t("landing.simple.features.invoices.description"),
    },
  ];

  const localBenefits = [
    {
      icon: ShieldCheck,
      title: t("landing.simple.local.compliance.title"),
      description: t("landing.simple.local.compliance.description"),
    },
    {
      icon: Landmark,
      title: t("landing.simple.local.banks.title"),
      description: t("landing.simple.local.banks.description"),
    },
    {
      icon: Languages,
      title: t("landing.simple.local.languages.title"),
      description: t("landing.simple.local.languages.description"),
    },
  ];

  const trustItems = [
    t("landing.simple.hero.trust.noCard"),
    t("landing.simple.hero.trust.languages"),
    t("landing.simple.hero.trust.localSupport"),
  ];

  return (
    <div className="public-grain min-h-screen overflow-x-hidden text-white">
      <SEO {...seoConfig.landing} />

      <style>{`
        html { scroll-behavior: auto; }
        .lp-defer {
          content-visibility: auto;
          contain-intrinsic-size: 1px 800px;
        }
      `}</style>

      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-zinc-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("common.skipToContent")}
      </a>

      <PublicNav />
      <PublicSectionNav
        pageLabelKey="landing.nav.home"
        accent="amber"
        sections={[
          { id: "how-it-works", labelKey: "landing.simple.nav.howItWorks" },
          { id: "features", labelKey: "landing.nav.features" },
          { id: "pricing", labelKey: "landing.nav.pricing" },
        ]}
      />

      <main id="main-content">
        <section className="relative overflow-hidden pb-20 pt-40 sm:pb-24 sm:pt-44 lg:pb-28 lg:pt-52">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.09),transparent_36%),radial-gradient(circle_at_15%_75%,rgba(106,156,41,0.07),transparent_30%)]" />
          <Crescent className="pointer-events-none absolute -right-24 -top-28 hidden h-[520px] w-[520px] text-amber-400/[0.045] md:block" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8">
            <div>
              <div className="animate-public-rise stagger-1 mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3.5 py-2 text-sm text-amber-200">
                <Landmark className="h-4 w-4" />
                {t("landing.simple.hero.eyebrow")}
              </div>

              <h1 className="animate-public-rise stagger-2 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[4.1rem]">
                {t("landing.simple.hero.title")}
                <span className="mt-1 block bg-gradient-to-r from-amber-200 via-amber-400 to-lime-300 bg-clip-text text-transparent">
                  {t("landing.simple.hero.titleAccent")}
                </span>
              </h1>

              <p className="animate-public-rise stagger-3 mt-6 max-w-2xl text-lg leading-8 text-zinc-400 lg:text-xl">
                {t("landing.simple.hero.description")}
              </p>

              <div className="animate-public-rise stagger-4 mt-8 flex flex-col gap-3 sm:flex-row">
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
                  <a href="#how-it-works">
                    {t("landing.simple.hero.secondary")}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="animate-public-rise stagger-5 mt-8 flex flex-col gap-3 text-sm text-zinc-400 sm:flex-row sm:flex-wrap sm:gap-x-6">
                {trustItems.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="animate-public-rise stagger-3 relative mx-auto w-full max-w-md">
              <Crescent className="absolute -left-7 -top-14 h-16 w-16 -rotate-[25deg] text-amber-400/80 drop-shadow-[0_0_20px_rgba(251,191,36,0.25)]" />
              <div className="relative rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl shadow-black/50 sm:p-7">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                    {t("landing.tax.example.title")}
                  </p>
                  <span className="shrink-0 rounded-full bg-lime-400 px-2.5 py-1 text-[11px] font-bold text-zinc-950">
                    {t("landing.tax.example.badge")}
                  </span>
                </div>

                <div className="space-y-3 font-mono text-sm">
                  <CalculationRow
                    label={t("landing.tax.example.basicSalary")}
                    value="$1,200.00"
                  />
                  <CalculationRow
                    label={t("landing.tax.example.overtime")}
                    value="+$113.22"
                    positive
                  />
                  <CalculationRow
                    label={t("landing.tax.example.foodAllowance")}
                    value="+$100.00"
                    positive
                  />
                  <CalculationRow
                    label={t("landing.tax.example.gross")}
                    value="$1,413.22"
                    divider
                    strong
                  />
                  <CalculationRow
                    label={t("landing.tax.example.wit")}
                    value="−$91.32"
                    negative
                  />
                  <CalculationRow
                    label={t("landing.tax.example.inss")}
                    value="−$48.00"
                    negative
                  />
                  <CalculationRow
                    label={t("landing.tax.example.net")}
                    value="$1,273.90"
                    divider
                    total
                  />
                </div>

                <p className="mt-5 border-t border-white/[0.07] pt-4 text-xs leading-5 text-zinc-400">
                  {t("landing.simple.hero.calculationNote")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <FoundingOffer />
          </div>
        </section>

        <section
          id="how-it-works"
          className="lp-defer scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24"
        >
          <div data-reveal className="public-reveal mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>
                {t("landing.simple.workflow.eyebrow")}
              </SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white lg:text-[2.6rem]">
                {t("landing.simple.workflow.title")}
              </h2>
              <p className="mt-4 text-zinc-400">
                {t("landing.simple.workflow.description")}
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {workflow.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article
                    key={step.title}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.035]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-400/10">
                        <Icon className="h-5 w-5 text-lime-400" />
                      </div>
                      <span className="select-none font-mono text-5xl font-bold leading-none text-white/[0.06]">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {step.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="features"
          className="lp-defer scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24"
        >
          <div data-reveal className="public-reveal mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>
                {t("landing.simple.features.eyebrow")}
              </SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white lg:text-[2.6rem]">
                {t("landing.simple.features.title")}
              </h2>
              <p className="mt-4 text-zinc-400">
                {t("landing.simple.features.description")}
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {outcomes.map((outcome) => (
                <OutcomeCard key={outcome.title} {...outcome} />
              ))}
            </div>

            <div className="mt-8 text-center">
              <Button
                asChild
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/how-it-works">
                  {t("landing.simple.features.viewAll")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="lp-defer border-t border-white/[0.06] py-20 lg:py-24">
          <div data-reveal className="public-reveal mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>
                {t("landing.simple.local.eyebrow")}
              </SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white lg:text-[2.6rem]">
                {t("landing.simple.local.title")}
              </h2>
              <p className="mt-4 text-zinc-400">
                {t("landing.simple.local.description")}
              </p>
            </div>

            <div className="mt-12 grid items-start gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12">
              <div className="space-y-3">
                {localBenefits.map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <article
                      key={benefit.title}
                      className="flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5 transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.035]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                        <Icon className="h-5 w-5 text-amber-300" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">
                          {benefit.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-zinc-400">
                          {benefit.description}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div>
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                    <FileText className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">
                      {t("landing.simple.local.payslipTitle")}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      {t("landing.simple.local.payslipDescription")}
                    </p>
                  </div>
                </div>
                <PayslipExample locale={locale} />
              </div>
            </div>
          </div>
        </section>

        <section className="lp-defer border-t border-white/[0.06] py-16 lg:py-20">
          <div data-reveal className="public-reveal mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="grid items-center gap-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8 lg:grid-cols-[0.72fr_1.28fr] lg:p-10">
              {/* Partner identity withheld until the agreement is signed. */}
              <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-10">
                <Landmark className="h-9 w-9 text-amber-300" />
                <span className="text-lg font-bold text-white">
                  {PRIMOS_BOOT_PARTNER.name}
                </span>
              </div>
              <div>
                <SectionEyebrow>
                  {t("accountantPartners.landing.eyebrow")}
                </SectionEyebrow>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {t("accountantPartners.landing.title")}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                  {t("accountantPartners.landing.description")}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-6 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link to="/accountants">
                    {t("accountantPartners.landing.cta")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="lp-defer scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24"
        >
          <div data-reveal className="public-reveal mx-auto max-w-3xl px-5 text-center sm:px-6 lg:px-8">
            <SectionEyebrow>{t("landing.simple.pricing.eyebrow")}</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {t("landing.simple.pricing.title")}
            </h2>
            <p className="mt-6 text-5xl font-extrabold tabular-nums text-white">
              ${DEFAULT_PACKAGES_CONFIG.pricePerEmployee}
              <span className="mt-2 block text-base font-medium text-zinc-400 sm:ml-2 sm:mt-0 sm:inline">
                {t("landing.simple.pricing.perEmployeeMonth")}
              </span>
            </p>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              {t("landing.simple.pricing.description")}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 bg-amber-400 px-7 text-base font-bold text-zinc-950 shadow-xl shadow-amber-500/20 hover:bg-amber-300"
              >
                <Link to="/pricing">
                  {t("landing.simple.pricing.seeFull")}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 border-white/10 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/auth/signup">{t("landing.simple.pricing.cta")}</Link>
              </Button>
            </div>
          </div>
        </section>

        <MarketingFaq />

        <section className="lp-defer relative overflow-hidden border-t border-white/[0.06] py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08),transparent_48%)]" />
          <div data-reveal className="public-reveal relative mx-auto max-w-3xl px-5 text-center sm:px-6 lg:px-8">
            <SectionEyebrow>
              {t("landing.simple.support.eyebrow")}
            </SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {t("landing.simple.support.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-zinc-400">
              {t("landing.simple.support.description")}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 bg-amber-400 px-8 text-base font-bold text-zinc-950 hover:bg-amber-300"
              >
                <Link to="/auth/signup">
                  {t("landing.simple.support.primary")}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 border-white/10 bg-white/5 px-8 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <a
                  href="https://wa.me/67073371307"
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-5 w-5 text-lime-400" />
                  {t("landing.simple.support.whatsapp")}
                </a>
              </Button>
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 text-sm text-zinc-400 sm:flex-row sm:gap-6">
              <a
                href="https://wa.me/67073371307"
                className="flex items-center gap-2 hover:text-white"
              >
                <MessageCircle className="h-4 w-4 text-lime-400" />
                +670 7337 1307
              </a>
              <a
                href="mailto:suporte@onit.tl"
                className="flex items-center gap-2 hover:text-white"
              >
                <Mail className="h-4 w-4 text-amber-300" />
                suporte@onit.tl
              </a>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function CalculationRow({
  label,
  value,
  positive = false,
  negative = false,
  divider = false,
  strong = false,
  total = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  divider?: boolean;
  strong?: boolean;
  total?: boolean;
}) {
  const valueClass = total
    ? "text-xl font-bold text-amber-300"
    : positive
      ? "text-lime-400"
      : negative
        ? "text-red-300"
        : strong
          ? "font-bold text-white"
          : "text-white";

  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${divider ? "border-t border-white/10 pt-3" : ""}`}
    >
      <span
        className={
          total
            ? "font-sans font-semibold text-amber-300"
            : "font-sans text-zinc-400"
        }
      >
        {label}
      </span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
