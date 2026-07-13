import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { SEO, seoConfig } from "@/components/SEO";
import { PackagePicker } from "@/components/pricing/PackagePicker";
import { PayslipExample } from "@/components/marketing/PayslipExample";
import {
  ArrowRight,
  BadgeCheck,
  Baby,
  Banknote,
  BarChart3,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  Calculator,
  Calendar,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  HardHat,
  Heart,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Printer,
  Scale,
  Shield,
  ShoppingBag,
  Smartphone,
  Target,
  UtensilsCrossed,
  Users,
  Wallet,
  WifiOff,
  Zap,
} from "lucide-react";

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

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.28em] text-amber-300">
      <Crescent className="h-3.5 w-3.5 text-amber-400" />
      {children}
    </p>
  );
}

export default function Landing() {
  const { t, locale } = useI18n();

  const tlFeatures = [
    {
      icon: Scale,
      index: "01",
      title: t("landing.tlFeatures.laborLaw.title"),
      subtitle: t("landing.tlFeatures.laborLaw.subtitle"),
      description: t("landing.tlFeatures.laborLaw.description"),
    },
    {
      icon: Calculator,
      index: "02",
      title: t("landing.tlFeatures.witInss.title"),
      subtitle: t("landing.tlFeatures.witInss.subtitle"),
      description: t("landing.tlFeatures.witInss.description"),
    },
    {
      icon: Banknote,
      index: "03",
      title: t("landing.tlFeatures.thirteenth.title"),
      subtitle: t("landing.tlFeatures.thirteenth.subtitle"),
      description: t("landing.tlFeatures.thirteenth.description"),
    },
  ];

  const laborLawFeatures = [
    { icon: Clock, title: t("landing.laborLaw.features.workWeek.title"), description: t("landing.laborLaw.features.workWeek.description") },
    { icon: DollarSign, title: t("landing.laborLaw.features.overtime.title"), description: t("landing.laborLaw.features.overtime.description") },
    { icon: Heart, title: t("landing.laborLaw.features.sick.title"), description: t("landing.laborLaw.features.sick.description") },
    { icon: Baby, title: t("landing.laborLaw.features.maternity.title"), description: t("landing.laborLaw.features.maternity.description") },
    { icon: Calendar, title: t("landing.laborLaw.features.annual.title"), description: t("landing.laborLaw.features.annual.description") },
    { icon: BadgeCheck, title: t("landing.laborLaw.features.severance.title"), description: t("landing.laborLaw.features.severance.description") },
  ];

  const publicHolidays = [
    t("landing.holidays.newYear"),
    t("landing.holidays.laborDay"),
    t("landing.holidays.restoration"),
    t("landing.holidays.popularConsultation"),
    t("landing.holidays.proclamation"),
    t("landing.holidays.heroesDay"),
    t("landing.holidays.christmas"),
  ];

  const banks = [
    { name: "BNU", format: t("landing.banks.bnu") },
    { name: "BNCTL", format: t("landing.banks.bnctl") },
    { name: "MANDIRI", format: t("landing.banks.mandiri") },
    { name: "ANZ", format: t("landing.banks.anz") },
  ];

  const segments = [
    { icon: Shield, label: t("landing.segments.security.label") },
    { icon: UtensilsCrossed, label: t("landing.segments.restaurants.label") },
    { icon: Heart, label: t("landing.segments.ngos.label") },
    { icon: Building2, label: t("landing.segments.hotels.label") },
    { icon: BriefcaseBusiness, label: t("landing.segments.consulting.label") },
    { icon: HardHat, label: t("landing.segments.construction.label") },
  ];

  const modules = [
    { icon: Users, name: t("landing.modules.people.name"), desc: t("landing.modules.people.desc") },
    { icon: Briefcase, name: t("landing.modules.hiring.name"), desc: t("landing.modules.hiring.desc") },
    { icon: Clock, name: t("landing.modules.time.name"), desc: t("landing.modules.time.desc") },
    { icon: Target, name: t("landing.modules.performance.name"), desc: t("landing.modules.performance.desc") },
    { icon: Calculator, name: t("landing.modules.payroll.name"), desc: t("landing.modules.payroll.desc") },
    { icon: Wallet, name: t("landing.modules.money.name"), desc: t("landing.modules.money.desc") },
    { icon: Landmark, name: t("landing.modules.accounting.name"), desc: t("landing.modules.accounting.desc") },
    { icon: BarChart3, name: t("landing.modules.reports.name"), desc: t("landing.modules.reports.desc") },
    { icon: Shield, name: t("landing.modules.compliance.name"), desc: t("landing.modules.compliance.desc") },
  ];

  const ekipaFeatures = [
    { icon: FileText, title: t("landing.ekipa.features.payslips.title"), desc: t("landing.ekipa.features.payslips.desc") },
    { icon: CalendarCheck, title: t("landing.ekipa.features.leave.title"), desc: t("landing.ekipa.features.leave.desc") },
    { icon: Camera, title: t("landing.ekipa.features.crewClock.title"), desc: t("landing.ekipa.features.crewClock.desc") },
    { icon: WifiOff, title: t("landing.ekipa.features.offline.title"), desc: t("landing.ekipa.features.offline.desc") },
  ];

  const kaixaFeatures = [
    { icon: DollarSign, title: t("landing.kaixa.features.tamasai.title"), desc: t("landing.kaixa.features.tamasai.desc") },
    { icon: ShoppingBag, title: t("landing.kaixa.features.pos.title"), desc: t("landing.kaixa.features.pos.desc") },
    { icon: Printer, title: t("landing.kaixa.features.bluetooth.title"), desc: t("landing.kaixa.features.bluetooth.desc") },
    { icon: Shield, title: t("landing.kaixa.features.vat.title"), desc: t("landing.kaixa.features.vat.desc") },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden">
      <SEO {...seoConfig.landing} />

      {/* Page-scoped styles: entrance animation + instant anchor jumps
          (global smooth-scroll feels broken over this page's length) */}
      <style>{`
        html { scroll-behavior: auto; }
        @keyframes lp-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lp-rise { animation: lp-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .lp-rise { animation: none; }
        }
      `}</style>

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none z-50"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      />

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/images/illustrations/xefe-logo-light.webp"
                alt="Xefe"
                className="h-9 w-auto"
              />
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#modules" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {t("landing.nav.features")}
              </a>
              <a href="#labor-law" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {t("landing.nav.laborLaw")}
              </a>
              <a href="#apps" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {t("landing.nav.apps")}
              </a>
              <a href="#pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {t("landing.nav.pricing")}
              </a>
            </div>

            <div className="flex items-center gap-3">
              <LocaleSwitcher className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white" />
              <Button variant="ghost" asChild className="text-zinc-300 hover:text-white hover:bg-white/5">
                <Link to="/auth/login">{t("auth.signIn")}</Link>
              </Button>
              <Button asChild className="bg-amber-400 text-zinc-950 hover:bg-amber-300 font-bold shadow-lg shadow-amber-500/20">
                <Link to="/auth/signup">
                  {t("landing.nav.getStarted")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28">
        {/* Background: gold crescent glow + brand green counter-glow + grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Crescent className="absolute -top-32 right-[-10%] w-[640px] h-[640px] text-amber-400/[0.07] blur-2xl" />
          <div className="absolute top-1/4 right-1/4 w-[480px] h-[480px] bg-amber-400/10 rounded-full blur-[140px]" />
          <div className="absolute bottom-0 left-[-5%] w-[420px] h-[420px] bg-lime-500/[0.08] rounded-full blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-14 lg:gap-12 items-center">
            {/* Copy */}
            <div>
              <div className="lp-rise inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/10 border border-amber-400/20 mb-8">
                <MapPin className="h-4 w-4 text-amber-300" />
                <span className="text-sm text-zinc-300">
                  {t("landing.hero.badge")}{" "}
                  <span className="text-amber-300 font-semibold">
                    {t("landing.hero.badgeHighlight")}
                  </span>
                </span>
              </div>

              <h1 className="lp-rise text-5xl sm:text-6xl lg:text-[4.25rem] font-extrabold tracking-tight leading-[1.05] mb-6" style={{ animationDelay: "80ms" }}>
                <span className="block text-white">{t("landing.hero.headline")}</span>
                <span className="block bg-gradient-to-r from-amber-200 via-amber-400 to-lime-300 bg-clip-text text-transparent">
                  {t("landing.hero.headlineAccent")}
                </span>
              </h1>

              <p className="lp-rise text-lg lg:text-xl text-zinc-400 max-w-xl mb-8 leading-relaxed" style={{ animationDelay: "160ms" }}>
                {t("landing.hero.subheadline.before")}
                <span className="text-white"> {t("landing.hero.subheadline.highlight1")}</span>
                {t("landing.hero.subheadline.middle")}
                <span className="text-white"> {t("landing.hero.subheadline.highlight2")}</span>
                {t("landing.hero.subheadline.after")}
              </p>

              <div className="lp-rise grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 max-w-xl text-sm text-zinc-300 mb-10" style={{ animationDelay: "240ms" }}>
                {[
                  t("landing.hero.points.labor"),
                  t("landing.hero.points.tax"),
                  t("landing.hero.points.languages"),
                  t("landing.hero.points.accounting"),
                ].map((point, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-lime-400 flex-shrink-0" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              <div className="lp-rise flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-10" style={{ animationDelay: "320ms" }}>
                <Button size="lg" asChild className="h-14 px-8 text-base bg-amber-400 text-zinc-950 hover:bg-amber-300 font-bold shadow-xl shadow-amber-500/25 hover:shadow-amber-400/40 transition-all">
                  <Link to="/auth/signup">
                    {t("landing.hero.ctaPrimary")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-14 px-8 text-base border-white/10 bg-white/5 hover:bg-white/10 text-white">
                  <a href="#modules">
                    {t("landing.nav.features")}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="lp-rise flex flex-wrap items-center gap-x-7 gap-y-3 text-zinc-400 text-sm" style={{ animationDelay: "400ms" }}>
                {[
                  t("landing.hero.trust.trial"),
                  t("landing.hero.trust.usd"),
                  t("landing.hero.trust.transfers"),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-lime-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live payslip calculation card */}
            <div className="lp-rise relative max-w-md w-full mx-auto lg:mx-0" style={{ animationDelay: "280ms" }}>
              <Crescent className="absolute -top-9 -left-7 w-20 h-20 -rotate-12 text-amber-400/80 drop-shadow-[0_0_24px_rgba(251,191,36,0.35)]" />
              <div className="relative p-6 lg:p-7 rounded-2xl bg-zinc-900/90 border border-white/10 shadow-2xl shadow-black/60 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">
                  {t("landing.tax.example.title")}
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{t("landing.tax.example.basicSalary")}</span>
                    <span className="text-white">$1,200.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{t("landing.tax.example.overtime")}</span>
                    <span className="text-lime-400">+$180.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{t("landing.tax.example.foodAllowance")}</span>
                    <span className="text-lime-400">+$100.00</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between">
                    <span className="text-zinc-300">{t("landing.tax.example.gross")}</span>
                    <span className="text-white font-bold">$1,480.00</span>
                  </div>
                  <div className="flex justify-between text-red-400/90">
                    <span>{t("landing.tax.example.wit")}</span>
                    <span>-$98.00</span>
                  </div>
                  <div className="flex justify-between text-red-400/90">
                    <span>{t("landing.tax.example.inss")}</span>
                    <span>-$55.20</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between items-baseline">
                    <span className="text-amber-300 font-semibold">{t("landing.tax.example.net")}</span>
                    <span className="text-amber-300 font-bold text-xl">$1,326.80</span>
                  </div>
                </div>
                <div className="absolute -top-3 -right-3 px-3 py-1 rounded-full bg-lime-400 text-zinc-950 text-xs font-bold shadow-lg shadow-lime-500/30">
                  {t("landing.tax.example.badge")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who uses Xefe ──────────────────────────────────────── */}
      <section className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-center text-xs uppercase tracking-[0.24em] text-zinc-500 mb-8">
            {t("landing.segments.subtitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {segments.map((segment, i) => {
              const Icon = segment.icon;
              return (
                <div key={i} className="flex items-center gap-2.5 text-zinc-400 hover:text-zinc-200 transition-colors">
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{segment.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Example payslip ────────────────────────────────────── */}
      <section className="py-24 lg:py-28 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-500/[0.05] rounded-full blur-[160px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <SectionEyebrow>{t("landing.payslip.eyebrow")}</SectionEyebrow>
            <h2 className="mt-4 text-3xl lg:text-[2.6rem] leading-tight font-extrabold tracking-tight text-white">
              {t("landing.payslip.title")}{" "}
              <span className="text-amber-300">{t("landing.payslip.titleAccent")}</span>
            </h2>
            <p className="mt-4 text-zinc-400">{t("landing.payslip.subtitle")}</p>
          </div>
          <PayslipExample locale={locale} />
        </div>
      </section>

      {/* ── Built for Timor-Leste ──────────────────────────────── */}
      <section id="labor-law" className="scroll-mt-16 py-24 lg:py-28 border-t border-white/5 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-amber-400/[0.04] rounded-full blur-[160px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <SectionEyebrow>{t("landing.features.badge")}</SectionEyebrow>
            <h2 className="mt-4 text-3xl lg:text-[2.6rem] leading-tight font-extrabold tracking-tight text-white">
              {t("landing.features.title")}
              <span className="block text-zinc-500 text-2xl lg:text-3xl mt-1.5">
                {t("landing.features.titleAccent")}
              </span>
            </h2>
            <p className="mt-4 text-zinc-400">{t("landing.features.description")}</p>
          </div>

          {/* Three pillars */}
          <div className="grid md:grid-cols-3 gap-5">
            {tlFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="group relative p-7 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-amber-400/25 hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/10">
                      <Icon className="h-6 w-6 text-amber-300" />
                    </div>
                    <span className="font-mono text-sm text-zinc-700 group-hover:text-amber-400/40 transition-colors">
                      {feature.index}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                  <p className="text-xs text-zinc-500 mb-3">{feature.subtitle}</p>
                  <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>

          {/* Labor-law rules, compact */}
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
            {laborLawFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-lime-400/10 flex-shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-lime-400" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">{feature.title}</span>
                    <span className="text-sm text-zinc-500"> — {feature.description}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Holidays */}
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-sm text-zinc-400 mr-2">
              <Calendar className="h-4 w-4 text-amber-300" />
              {t("landing.holidays.title")}
            </span>
            {publicHolidays.map((holiday, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-amber-400/[0.07] text-amber-200/90 text-xs border border-amber-400/15">
                {holiday}
              </span>
            ))}
            <span className="px-3 py-1.5 rounded-full bg-white/[0.03] text-zinc-500 text-xs border border-white/5">
              {t("landing.holidays.more")}
            </span>
          </div>

          {/* Banks + mobile money — one card */}
          <div className="mt-12 p-6 lg:p-8 rounded-2xl bg-gradient-to-r from-amber-400/[0.05] via-white/[0.02] to-lime-400/[0.04] border border-amber-400/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-amber-400/10">
                <Landmark className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">{t("landing.banks.title")}</h3>
                <p className="text-sm text-zinc-400">{t("landing.banks.subtitle")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {banks.map((bank, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-white/[0.04] border border-white/5">
                  <span className="font-bold text-white tracking-wide">{bank.name}</span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-200 text-[11px] font-medium border border-amber-400/15 text-center">
                    {bank.format}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-5 border-t border-white/5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="text-sm text-zinc-400">
                <span className="text-white font-semibold">{t("landing.mobilePay.title")}</span>
                {" · "}
                {t("landing.mobilePay.subtitle")}
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/5">
                  <img src="/images/tpay-logo-white.png" alt="T-PAY" className="h-5 w-5 rounded-full object-contain bg-black" />
                  <span className="text-xs font-semibold text-zinc-300">T-PAY</span>
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/5">
                  <span className="h-5 w-5 rounded-full bg-[#FF6600] flex items-center justify-center overflow-hidden">
                    <img src="/images/telemor-logo.svg" alt="Telemor" className="h-2.5 w-auto" />
                  </span>
                  <span className="text-xs font-semibold text-zinc-300">Mosan</span>
                </span>
              </div>
            </div>
            <p className="mt-5 text-sm text-amber-300/70 text-center font-medium">
              {t("landing.banks.tagline")}
            </p>
          </div>
        </div>
      </section>

      {/* ── Modules ────────────────────────────────────────────── */}
      <section id="modules" className="scroll-mt-16 py-24 lg:py-28 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <SectionEyebrow>{t("landing.modules.badge")}</SectionEyebrow>
            <h2 className="mt-4 text-3xl lg:text-[2.6rem] leading-tight font-extrabold tracking-tight text-white">
              {t("landing.modules.title")}
              <span className="block text-zinc-500 text-2xl lg:text-3xl mt-1.5">
                {t("landing.modules.titleAccent")}
              </span>
            </h2>
            <p className="mt-4 text-zinc-400">{t("landing.modules.description")}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module, i) => {
              const Icon = module.icon;
              return (
                <div key={i} className="group p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-400/20 hover:bg-white/[0.03] transition-all">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2 rounded-lg bg-white/5 group-hover:bg-amber-400/10 transition-colors">
                      <Icon className="h-5 w-5 text-zinc-300 group-hover:text-amber-300 transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{module.name}</h3>
                      <p className="text-xs text-zinc-500 leading-relaxed">{module.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Built for TL internet — slim strip */}
          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="p-2 rounded-lg bg-lime-400/10 flex-shrink-0">
              <Zap className="h-5 w-5 text-lime-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white">{t("landing.performance.title")}</span>
              <span className="text-sm text-zinc-500"> — {t("landing.performance.description")}</span>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button asChild variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
              <Link to="/features">
                {t("landing.modules.viewAll")}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <PackagePicker />

      {/* ── Mobile apps: Ekipa + Kaixa ─────────────────────────── */}
      <section id="apps" className="scroll-mt-16 py-24 lg:py-28 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-[15%] w-[400px] h-[400px] bg-teal-500/[0.05] rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-[15%] w-[400px] h-[400px] bg-orange-500/[0.05] rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <SectionEyebrow>{t("landing.apps.badge")}</SectionEyebrow>
            <h2 className="mt-4 text-3xl lg:text-[2.6rem] leading-tight font-extrabold tracking-tight text-white">
              {t("landing.apps.title")}
            </h2>
            <p className="mt-4 text-zinc-400">{t("landing.apps.description")}</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Ekipa */}
            <div className="p-7 lg:p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-teal-400/20 transition-colors flex flex-col">
              <div className="flex items-baseline gap-3 mb-1">
                <h3 className="text-2xl font-extrabold text-teal-300 tracking-tight">{t("landing.ekipa.title")}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-400/10 text-teal-300 border border-teal-400/20 font-semibold">
                  {t("landing.ekipa.badge")}
                </span>
              </div>
              <p className="text-sm text-zinc-500 italic mb-4">{t("landing.ekipa.tagline")}</p>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">{t("landing.ekipa.description")}</p>

              {/* Mini app screen */}
              <div className="mb-6 p-4 rounded-xl bg-[#101013] border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-teal-400 font-bold text-sm">Ekipa</span>
                  <span className="text-[10px] text-zinc-600">Bondia, Maria</span>
                </div>
                <div className="p-3 rounded-lg bg-teal-400/[0.08] border border-teal-400/15 mb-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-zinc-500">Next payday</span>
                    <span className="text-sm font-bold text-white">3 days</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-white/10 mt-2">
                    <div className="h-full w-[85%] rounded-full bg-teal-400" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { n: "12", label: "Annual" },
                    { n: "8", label: "Sick" },
                    { n: "2", label: "Personal" },
                  ].map((b, i) => (
                    <div key={i} className="py-2 rounded-lg bg-white/[0.03]">
                      <p className="text-sm font-bold text-teal-300">{b.n}</p>
                      <p className="text-[9px] text-zinc-600">{b.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {ekipaFeatures.map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-teal-400/10 flex-shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-teal-300" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{feature.title}</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-400/10 border border-teal-400/20 text-teal-300 font-semibold text-sm">
                  <Smartphone className="h-4 w-4" />
                  {t("landing.ekipa.cta")}
                </span>
                <span className="text-xs text-zinc-500">{t("landing.ekipa.ctaNote")}</span>
              </div>
            </div>

            {/* Kaixa */}
            <div className="p-7 lg:p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-orange-400/20 transition-colors flex flex-col">
              <div className="flex items-baseline gap-3 mb-1">
                <h3 className="text-2xl font-extrabold text-orange-300 tracking-tight">{t("landing.kaixa.title")}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-400/10 text-orange-300 border border-orange-400/20 font-semibold">
                  {t("landing.kaixa.badge")}
                </span>
              </div>
              <p className="text-sm text-zinc-500 italic mb-4">{t("landing.kaixa.tagline")}</p>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">{t("landing.kaixa.description")}</p>

              {/* Mini app screen */}
              <div className="mb-6 p-4 rounded-xl bg-[#101013] border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-orange-400 font-bold text-sm">Kaixa</span>
                  <span className="text-[10px] text-zinc-600">Ohin loron</span>
                </div>
                <div className="p-3 rounded-lg bg-orange-400/[0.08] border border-orange-400/15 mb-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-zinc-500">Balansu ohin</span>
                    <span className="text-sm font-bold text-white">$247.50</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="py-2 rounded-lg bg-lime-400/[0.07] border border-lime-400/10">
                    <p className="text-sm font-bold text-lime-300">+$385.00</p>
                    <p className="text-[9px] text-zinc-600">Tama · Money in</p>
                  </div>
                  <div className="py-2 rounded-lg bg-red-400/[0.07] border border-red-400/10">
                    <p className="text-sm font-bold text-red-300">&minus;$137.50</p>
                    <p className="text-[9px] text-zinc-600">Sai · Money out</p>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {kaixaFeatures.map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-orange-400/10 flex-shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-orange-300" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{feature.title}</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-400/10 border border-orange-400/20 text-orange-300 font-semibold text-sm">
                  <Smartphone className="h-4 w-4" />
                  {t("landing.kaixa.cta")}
                </span>
                <span className="text-xs text-zinc-500">{t("landing.kaixa.ctaNote")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA + local support ──────────────────────────── */}
      <section className="py-24 lg:py-32 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <Crescent className="absolute top-6 left-1/2 -translate-x-1/2 w-[520px] h-[520px] text-amber-400/[0.06] blur-xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] bg-gradient-to-r from-amber-400/15 to-lime-400/10 rounded-full blur-[130px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
            {t("landing.cta.title")}
            <span className="block bg-gradient-to-r from-amber-200 via-amber-400 to-lime-300 bg-clip-text text-transparent">
              {t("landing.cta.titleAccent")}
            </span>
          </h2>
          <p className="text-lg lg:text-xl text-zinc-400 mb-10">
            {t("landing.cta.description")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Button size="lg" asChild className="h-14 px-10 text-base bg-amber-400 text-zinc-950 hover:bg-amber-300 font-bold shadow-xl shadow-amber-500/30">
              <Link to="/auth/signup">
                {t("landing.cta.primary")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-14 px-10 text-base border-white/10 bg-white/5 hover:bg-white/10 text-white">
              <Link to="/auth/login">{t("auth.signIn")}</Link>
            </Button>
          </div>

          {/* Local support, compact */}
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-zinc-400 mb-8">
            {[
              t("landing.localSupport.items.whatsapp"),
              t("landing.localSupport.items.training"),
              t("landing.localSupport.items.bank"),
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-lime-400 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://wa.me/6707701234"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-lime-400/30 transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-lime-400" />
              <span className="text-sm text-zinc-200">+670 770 1234</span>
            </a>
            <a
              href="mailto:suporte@onit.tl"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-amber-400/30 transition-colors"
            >
              <Mail className="h-4 w-4 text-amber-300" />
              <span className="text-sm text-zinc-200">suporte@onit.tl</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12 bg-black/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src="/images/illustrations/xefe-logo-light.webp"
                alt="Xefe"
                className="h-7 w-auto"
              />
              <span className="text-zinc-400 text-sm">{t("landing.footer.location")}</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-zinc-400">
              <Link to="/privacy" className="hover:text-white transition-colors">
                {t("landing.footer.links.privacy")}
              </Link>
              <Link to="/terms" className="hover:text-white transition-colors">
                {t("landing.footer.links.terms")}
              </Link>
              <a href="https://wa.me/6707701234" className="hover:text-white transition-colors">
                {t("landing.footer.links.support")}
              </a>
              <a href="mailto:suporte@onit.tl" className="hover:text-white transition-colors">
                {t("landing.footer.links.contact")}
              </a>
            </div>
            <div className="text-sm text-zinc-400">{t("landing.footer.copyright")}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
