import type { ReactNode } from "react";
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
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { PayslipExample } from "@/components/marketing/PayslipExample";
import { PackagePicker } from "@/components/pricing/PackagePicker";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

/** Gold crescent — echoes the mark above the "x" in the Xefe logo. */
function Crescent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d="M12 62 A46 46 0 0 1 88 40 A60 60 0 0 0 12 62 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">
      <Crescent className="h-3.5 w-3.5 text-amber-400" />
      {children}
    </p>
  );
}

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
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
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
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0b] text-white">
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

      <nav
        aria-label={t("common.mainNavigation")}
        className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0b]/95 md:bg-[#0a0a0b]/85 md:backdrop-blur-lg"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Xefe" className="shrink-0">
            <img
              src="/images/illustrations/xefe-logo-light.webp"
              alt="Xefe"
              width="109"
              height="54"
              className="h-8 w-auto sm:h-9"
            />
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <a
              href="#how-it-works"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              {t("landing.simple.nav.howItWorks")}
            </a>
            <a
              href="#features"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              {t("landing.nav.features")}
            </a>
            <a
              href="#pricing"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              {t("landing.nav.pricing")}
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher className="h-11 w-11 gap-0 border-white/10 bg-white/5 px-0 text-zinc-200 hover:bg-white/10 hover:text-white [&>span]:hidden [&>svg:last-child]:hidden sm:h-9 sm:w-auto sm:gap-2 sm:px-3 sm:[&>span]:inline sm:[&>svg:last-child]:block" />
            <Button
              variant="ghost"
              asChild
              className="hidden text-zinc-300 hover:bg-white/5 hover:text-white sm:inline-flex"
            >
              <Link to="/auth/login">{t("auth.signIn")}</Link>
            </Button>
            <Button
              asChild
              className="h-10 bg-amber-400 px-3 font-bold text-zinc-950 shadow-lg shadow-amber-500/15 hover:bg-amber-300 sm:px-4"
            >
              <Link to="/auth/signup">
                {t("landing.nav.getStarted")}
                <ArrowRight className="hidden h-4 w-4 sm:block" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <main id="main-content">
        <section className="relative overflow-hidden pb-20 pt-28 sm:pb-24 sm:pt-32 lg:pb-28 lg:pt-40">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.09),transparent_36%),radial-gradient(circle_at_15%_75%,rgba(106,156,41,0.07),transparent_30%)]" />
          <Crescent className="pointer-events-none absolute -right-24 -top-28 hidden h-[520px] w-[520px] text-amber-400/[0.045] md:block" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3.5 py-2 text-sm text-amber-200">
                <Landmark className="h-4 w-4" />
                {t("landing.simple.hero.eyebrow")}
              </div>

              <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[4.1rem]">
                {t("landing.simple.hero.title")}
                <span className="mt-1 block bg-gradient-to-r from-amber-200 via-amber-400 to-lime-300 bg-clip-text text-transparent">
                  {t("landing.simple.hero.titleAccent")}
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400 lg:text-xl">
                {t("landing.simple.hero.description")}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

              <div className="mt-8 flex flex-col gap-3 text-sm text-zinc-400 sm:flex-row sm:flex-wrap sm:gap-x-6">
                {trustItems.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <Crescent className="absolute -left-5 -top-8 h-16 w-16 -rotate-12 text-amber-400/80 drop-shadow-[0_0_20px_rgba(251,191,36,0.25)]" />
              <div className="relative rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl shadow-black/50 sm:p-7">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
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
                    value="+$180.00"
                    positive
                  />
                  <CalculationRow
                    label={t("landing.tax.example.foodAllowance")}
                    value="+$100.00"
                    positive
                  />
                  <CalculationRow
                    label={t("landing.tax.example.gross")}
                    value="$1,480.00"
                    divider
                    strong
                  />
                  <CalculationRow
                    label={t("landing.tax.example.wit")}
                    value="−$98.00"
                    negative
                  />
                  <CalculationRow
                    label={t("landing.tax.example.inss")}
                    value="−$55.20"
                    negative
                  />
                  <CalculationRow
                    label={t("landing.tax.example.net")}
                    value="$1,326.80"
                    divider
                    total
                  />
                </div>

                <p className="mt-5 border-t border-white/[0.07] pt-4 text-xs leading-5 text-zinc-500">
                  {t("landing.simple.hero.calculationNote")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="lp-defer scroll-mt-16 border-t border-white/[0.06] py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
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
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-400/10">
                        <Icon className="h-5 w-5 text-lime-400" />
                      </div>
                      <span className="font-mono text-sm text-zinc-700">
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
          className="lp-defer scroll-mt-16 border-t border-white/[0.06] py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
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
                <Link to="/features">
                  {t("landing.simple.features.viewAll")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="lp-defer border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
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
                      className="flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-5"
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-400/10">
                    <FileText className="h-5 w-5 text-blue-300" />
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

        <PackagePicker />

        <section className="lp-defer relative overflow-hidden border-t border-white/[0.06] py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08),transparent_48%)]" />
          <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-6 lg:px-8">
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
                  href="https://wa.me/6707701234"
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
                href="https://wa.me/6707701234"
                className="flex items-center gap-2 hover:text-white"
              >
                <MessageCircle className="h-4 w-4 text-lime-400" />
                +670 770 1234
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

      <footer className="border-t border-white/[0.06] bg-black/40 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/images/illustrations/xefe-logo-light.webp"
              alt="Xefe"
              width="85"
              height="42"
              className="h-7 w-auto"
              loading="lazy"
            />
            <span className="text-sm text-zinc-500">
              {t("landing.footer.location")}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-zinc-400">
            <Link to="/privacy" className="transition-colors hover:text-white">
              {t("landing.footer.links.privacy")}
            </Link>
            <Link to="/terms" className="transition-colors hover:text-white">
              {t("landing.footer.links.terms")}
            </Link>
            <a
              href="https://wa.me/6707701234"
              className="transition-colors hover:text-white"
            >
              {t("landing.footer.links.support")}
            </a>
            <a
              href="mailto:suporte@onit.tl"
              className="transition-colors hover:text-white"
            >
              {t("landing.footer.links.contact")}
            </a>
          </div>
          <div className="text-sm text-zinc-500">
            {t("landing.footer.copyright")}
          </div>
        </div>
      </footer>
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
