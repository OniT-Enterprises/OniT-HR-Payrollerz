import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import {
  Users,
  Calculator,
  Clock,
  BarChart3,
  Shield,
  CheckCircle2,
  ArrowRight,
  Building2,
  Globe,
  Sparkles,
  ChevronRight,
  Play,
  FileText,
  Calendar,
  DollarSign,
  BadgeCheck,
  Scale,
  Landmark,
  BriefcaseBusiness,
  Heart,
  Baby,
  Banknote,
  Languages,
  MapPin,
  GraduationCap,
  ChevronDown,
} from "lucide-react";

export default function Landing() {
  const { t, locale, setLocale, localeLabels } = useI18n();
  const [langOpen, setLangOpen] = useState(false);
  const tlFeatures = [
    {
      icon: Scale,
      title: t("landing.tlFeatures.laborLaw.title"),
      subtitle: t("landing.tlFeatures.laborLaw.subtitle"),
      description: t("landing.tlFeatures.laborLaw.description"),
      color: "from-emerald-500 to-teal-500",
    },
    {
      icon: Calculator,
      title: t("landing.tlFeatures.witInss.title"),
      subtitle: t("landing.tlFeatures.witInss.subtitle"),
      description: t("landing.tlFeatures.witInss.description"),
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Banknote,
      title: t("landing.tlFeatures.thirteenth.title"),
      subtitle: t("landing.tlFeatures.thirteenth.subtitle"),
      description: t("landing.tlFeatures.thirteenth.description"),
      color: "from-amber-500 to-orange-500",
    },
    {
      icon: FileText,
      title: t("landing.tlFeatures.sefope.title"),
      subtitle: t("landing.tlFeatures.sefope.subtitle"),
      description: t("landing.tlFeatures.sefope.description"),
      color: "from-violet-500 to-purple-500",
    },
  ];

  const laborLawFeatures = [
    {
      icon: Clock,
      title: t("landing.laborLaw.features.workWeek.title"),
      description: t("landing.laborLaw.features.workWeek.description"),
    },
    {
      icon: DollarSign,
      title: t("landing.laborLaw.features.overtime.title"),
      description: t("landing.laborLaw.features.overtime.description"),
    },
    {
      icon: Heart,
      title: t("landing.laborLaw.features.sick.title"),
      description: t("landing.laborLaw.features.sick.description"),
    },
    {
      icon: Baby,
      title: t("landing.laborLaw.features.maternity.title"),
      description: t("landing.laborLaw.features.maternity.description"),
    },
    {
      icon: Calendar,
      title: t("landing.laborLaw.features.annual.title"),
      description: t("landing.laborLaw.features.annual.description"),
    },
    {
      icon: BadgeCheck,
      title: t("landing.laborLaw.features.severance.title"),
      description: t("landing.laborLaw.features.severance.description"),
    },
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
    { name: "BNU", full: "Banco Nacional Ultramarino" },
    { name: "MANDIRI", full: "Bank Mandiri Timor-Leste" },
    { name: "ANZ", full: "ANZ Bank" },
    { name: "BNCTL", full: "Banco Nacional de Comercio" },
  ];

  const plans = [
    {
      name: t("landing.pricing.plans.starter.name"),
      price: "$29",
      period: t("landing.pricing.perMonth"),
      description: t("landing.pricing.plans.starter.description"),
      features: [
        t("landing.pricing.plans.starter.features.employees"),
        t("landing.pricing.plans.starter.features.calculations"),
        t("landing.pricing.plans.starter.features.payroll"),
        t("landing.pricing.plans.starter.features.languages"),
      ],
      popular: false,
    },
    {
      name: t("landing.pricing.plans.professional.name"),
      price: "$79",
      period: t("landing.pricing.perMonth"),
      description: t("landing.pricing.plans.professional.description"),
      features: [
        t("landing.pricing.plans.professional.features.employees"),
        t("landing.pricing.plans.professional.features.compliance"),
        t("landing.pricing.plans.professional.features.thirteenth"),
        t("landing.pricing.plans.professional.features.sefope"),
        t("landing.pricing.plans.professional.features.transfers"),
      ],
      popular: true,
    },
    {
      name: t("landing.pricing.plans.enterprise.name"),
      price: t("landing.pricing.plans.enterprise.price"),
      period: "",
      description: t("landing.pricing.plans.enterprise.description"),
      features: [
        t("landing.pricing.plans.enterprise.features.employees"),
        t("landing.pricing.plans.enterprise.features.locations"),
        t("landing.pricing.plans.enterprise.features.api"),
        t("landing.pricing.plans.enterprise.features.support"),
        t("landing.pricing.plans.enterprise.features.integrations"),
      ],
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden">
      <SEO {...seoConfig.landing} />
      {/* Noise texture overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none z-50"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 via-amber-500 to-black flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:shadow-red-500/30 transition-shadow border border-amber-500/20">
                <span className="text-white text-sm font-black tracking-tight">TL</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight leading-none">
                  Oni<span className="text-red-500">T</span>
                </span>
                <span className="text-[10px] text-zinc-500 tracking-wider">TIMOR-LESTE</span>
              </div>
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {t("landing.nav.features")}
              </Link>
              <a href="#labor-law" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {t("landing.nav.laborLaw")}
              </a>
              <a href="#pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {t("landing.nav.pricing")}
              </a>
            </div>

            {/* Language & Auth */}
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <Languages className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs text-zinc-300 font-medium uppercase">{locale}</span>
                  <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                </button>
                {langOpen && (
                  <div className="absolute top-full right-0 mt-2 py-1 rounded-lg bg-zinc-900 border border-white/10 shadow-xl z-50 min-w-[140px]">
                    {(Object.keys(localeLabels) as Array<keyof typeof localeLabels>).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setLocale(lang);
                          setLangOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors ${
                          locale === lang ? 'text-amber-400' : 'text-zinc-300'
                        }`}
                      >
                        {localeLabels[lang]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="ghost" asChild className="text-zinc-300 hover:text-white hover:bg-white/5">
                <Link to="/auth/login">{t("auth.signIn")}</Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-semibold shadow-lg shadow-red-500/25">
                <Link to="/auth/signup">
                  {t("landing.nav.getStarted")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32">
        {/* Background Effects - Timor flag colors */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-black/20 to-transparent rounded-full blur-[120px]" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-8">
              <MapPin className="h-4 w-4 text-red-400" />
              <span className="text-sm text-zinc-300">
                {t("landing.hero.badge")}{" "}
                <span className="text-red-400 font-medium">
                  {t("landing.hero.badgeHighlight")}
                </span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6">
              <span className="block text-white">{t("landing.hero.headline")}</span>
              <span className="block bg-gradient-to-r from-red-400 via-amber-400 to-yellow-300 bg-clip-text text-transparent">
                {t("landing.hero.headlineAccent")}
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-6 leading-relaxed">
              {t("landing.hero.subheadline.before")}
              <span className="text-white"> {t("landing.hero.subheadline.labor")}</span>
              {t("landing.hero.subheadline.middle")}
              <span className="text-white"> {t("landing.hero.subheadline.annual")}</span>
              {t("landing.hero.subheadline.after")}
            </p>

            {/* Key differentiators */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500 mb-10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{t("landing.hero.points.labor")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span>{t("landing.hero.points.tax")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span>{t("landing.hero.points.languages")}</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Button size="lg" asChild className="h-14 px-8 text-base bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-semibold shadow-xl shadow-red-500/25 hover:shadow-red-500/40 transition-all">
                <Link to="/auth/signup">
                  {t("landing.hero.ctaPrimary")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base border-white/10 bg-white/5 hover:bg-white/10 text-white">
                <Play className="mr-2 h-5 w-5" />
                {t("landing.hero.ctaSecondary")}
              </Button>
            </div>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-zinc-500 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>{t("landing.hero.trust.trial")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>{t("landing.hero.trust.usd")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>{t("landing.hero.trust.transfers")}</span>
              </div>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-transparent to-transparent z-10 pointer-events-none" />
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/50 backdrop-blur shadow-2xl shadow-black/50">
              <div className="absolute inset-0 bg-gradient-to-tr from-red-500/5 via-transparent to-amber-500/5" />
              {/* Mock Dashboard */}
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-lg bg-white/5 text-xs text-zinc-500">app.onit.tl/dashboard</div>
                </div>
              </div>
              <div className="p-8 min-h-[400px] bg-gradient-to-br from-zinc-900 to-zinc-950">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: t("landing.mock.stats.totalEmployees"), value: "847", change: t("landing.mock.stats.totalEmployeesChange") },
                    { label: t("landing.mock.stats.monthlyPayroll"), value: "$124,350", change: t("landing.mock.stats.monthlyPayrollChange") },
                    { label: t("landing.mock.stats.inssContribution"), value: "$12,435", change: t("landing.mock.stats.inssContributionChange") },
                    { label: t("landing.mock.stats.thirteenth"), value: "$103,625", change: t("landing.mock.stats.thirteenthChange") },
                  ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <p className="text-xs text-zinc-500 mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                      <p className="text-xs text-amber-400 mt-1">{stat.change}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 p-4 rounded-xl bg-white/5 border border-white/5 h-48">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-white">{t("landing.mock.payrollByDept")}</p>
                      <span className="text-xs text-zinc-500">{t("landing.mock.currency")}</span>
                    </div>
                    <div className="flex items-end gap-2 h-32">
                      {[
                        { h: 85, label: t("landing.mock.departments.security") },
                        { h: 70, label: t("landing.mock.departments.admin") },
                        { h: 55, label: t("landing.mock.departments.finance") },
                        { h: 90, label: t("landing.mock.departments.operations") },
                        { h: 45, label: t("landing.mock.departments.hr") },
                        { h: 60, label: t("landing.mock.departments.it") },
                      ].map((bar, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full rounded-t bg-gradient-to-t from-red-500/80 to-amber-500/80" style={{ height: `${bar.h}%` }} />
                          <span className="text-[10px] text-zinc-600">{bar.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-sm font-medium text-white mb-3">
                      {t("landing.mock.upcomingHolidays")}
                    </p>
                    <div className="space-y-2">
                      {[
                        { date: t("landing.mock.holidays.nov12.date"), name: t("landing.mock.holidays.nov12.name") },
                        { date: t("landing.mock.holidays.nov28.date"), name: t("landing.mock.holidays.nov28.name") },
                        { date: t("landing.mock.holidays.dec7.date"), name: t("landing.mock.holidays.dec7.name") },
                        { date: t("landing.mock.holidays.dec25.date"), name: t("landing.mock.holidays.dec25.name") },
                      ].map((holiday, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 text-sm">
                          <span className="text-xs text-amber-400 font-mono">{holiday.date}</span>
                          <span className="text-zinc-400 text-xs">{holiday.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who Uses OniT */}
      <section className="py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm text-zinc-500 uppercase tracking-wider mb-2">Trusted by organizations across Timor-Leste</p>
            <h2 className="text-2xl font-bold text-white">Built for businesses that need compliance</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Heart, label: "NGOs & INGOs", desc: "Donor compliance & audit trails", color: "text-rose-400" },
              { icon: Landmark, label: "Government", desc: "SEFOPE reporting ready", color: "text-blue-400" },
              { icon: BriefcaseBusiness, label: "Oil & Gas", desc: "Complex contractor payroll", color: "text-amber-400" },
              { icon: Building2, label: "Hotels & Tourism", desc: "Seasonal staff management", color: "text-emerald-400" },
            ].map((segment, i) => {
              const Icon = segment.icon;
              return (
                <div key={i} className="text-center p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                  <Icon className={`h-8 w-8 ${segment.color} mx-auto mb-3`} />
                  <h3 className="font-semibold text-white mb-1">{segment.label}</h3>
                  <p className="text-xs text-zinc-500">{segment.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Pain points - Why switch */}
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-red-500/5 border border-red-500/10">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="font-semibold text-white mb-2">Still using paper?</h3>
              <p className="text-sm text-zinc-400">Manual calculations lead to IRPS errors that cost you money. One wrong deduction = audit risk.</p>
            </div>
            <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-semibold text-white mb-2">Excel breaking down?</h3>
              <p className="text-sm text-zinc-400">Formulas fail. Files corrupt. No audit trail for donors. No automatic 13th month calculations.</p>
            </div>
            <div className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="text-3xl mb-3">✅</div>
              <h3 className="font-semibold text-white mb-2">OniT solves this</h3>
              <p className="text-sm text-zinc-400">Automatic IRPS/INSS. Bank transfers to BNU/BNCTL. Reports for SEFOPE. Tetun interface.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Timor-Specific Features */}
      <section id="features" className="py-24 lg:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
              <MapPin className="h-3 w-3 text-red-400" />
              <span className="text-xs text-red-400">
                {t("landing.features.badge")}
              </span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-black mb-4">
              {t("landing.features.title")}
              <span className="block text-zinc-500 text-2xl lg:text-3xl mt-2">
                {t("landing.features.titleAccent")}
              </span>
            </h2>
            <p className="text-zinc-400">
              {t("landing.features.description")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {tlFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="group relative p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-red-500/20 transition-all hover:bg-white/[0.04]"
                >
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-4 shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-baseline gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                    <span className="text-sm text-zinc-500">{feature.subtitle}</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-500/0 via-red-500/5 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
              );
            })}
          </div>

          {/* Banks */}
          <div className="mt-12 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <Landmark className="h-5 w-5 text-amber-400" />
              <span className="font-medium text-white">
                {t("landing.banks.title")}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {banks.map((bank, i) => (
                <div key={i} className="flex flex-col items-center gap-1 p-4 rounded-xl bg-white/5">
                  <span className="font-bold text-white">{bank.name}</span>
                  <span className="text-xs text-zinc-500 text-center">{bank.full}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Labor Law Compliance */}
      <section id="labor-law" className="py-24 lg:py-32 bg-gradient-to-b from-transparent via-red-500/[0.02] to-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <Scale className="h-3 w-3 text-emerald-400" />
              <span className="text-xs text-emerald-400">
                {t("landing.laborLaw.badge")}
              </span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-black mb-4">
              {t("landing.laborLaw.title")}
              <span className="block bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                {t("landing.laborLaw.titleAccent")}
              </span>
            </h2>
            <p className="text-zinc-400">
              {t("landing.laborLaw.description")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {laborLawFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Icon className="h-4 w-4 text-emerald-400" />
                    </div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-400">{feature.description}</p>
                </div>
              );
            })}
          </div>

          {/* Public Holidays */}
          <div className="mt-12 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="h-5 w-5 text-amber-400" />
              <span className="font-medium text-white">
                {t("landing.holidays.title")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {publicHolidays.map((holiday, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-300 text-xs border border-amber-500/20">
                  {holiday}
                </span>
              ))}
              <span className="px-3 py-1.5 rounded-full bg-zinc-500/10 text-zinc-400 text-xs border border-zinc-500/20">
                {t("landing.holidays.more")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Tax & Social Security */}
      <section className="py-24 lg:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                <Calculator className="h-3 w-3 text-blue-400" />
                <span className="text-xs text-blue-400">
                  {t("landing.tax.badge")}
                </span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-black mb-6">
                WIT & INSS
                <span className="block text-zinc-500">
                  {t("landing.tax.titleAccent")}
                </span>
              </h2>
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <h3 className="font-semibold text-white mb-2">
                    {t("landing.tax.wit.title")}
                  </h3>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-400" />
                      {t("landing.tax.wit.points.threshold")}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-400" />
                      {t("landing.tax.wit.points.rate")}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-400" />
                      {t("landing.tax.wit.points.nonResident")}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-400" />
                      {t("landing.tax.wit.points.perDiem")}
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <h3 className="font-semibold text-white mb-2">
                    {t("landing.tax.inss.title")}
                  </h3>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      {t("landing.tax.inss.points.employee")}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      {t("landing.tax.inss.points.employer")}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      {t("landing.tax.inss.points.smallBusiness")}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      {t("landing.tax.inss.points.foodAllowance")}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="p-6 rounded-2xl bg-zinc-900 border border-white/10">
                <div className="text-xs text-zinc-500 mb-4">
                  {t("landing.tax.example.title")}
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">
                      {t("landing.tax.example.basicSalary")}
                    </span>
                    <span className="text-white">$1,200.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">
                      {t("landing.tax.example.overtime")}
                    </span>
                    <span className="text-emerald-400">+$180.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">
                      {t("landing.tax.example.foodAllowance")}
                    </span>
                    <span className="text-emerald-400">+$100.00</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between">
                    <span className="text-zinc-300">
                      {t("landing.tax.example.gross")}
                    </span>
                    <span className="text-white font-bold">$1,480.00</span>
                  </div>
                  <div className="flex justify-between text-red-400">
                    <span>{t("landing.tax.example.wit")}</span>
                    <span>-$98.00</span>
                  </div>
                  <div className="flex justify-between text-red-400">
                    <span>{t("landing.tax.example.inss")}</span>
                    <span>-$55.20</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between">
                    <span className="text-amber-400 font-semibold">
                      {t("landing.tax.example.net")}
                    </span>
                    <span className="text-amber-400 font-bold text-lg">$1,326.80</span>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 px-3 py-1 rounded-full bg-emerald-500 text-black text-xs font-bold">
                {t("landing.tax.example.badge")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 lg:py-32 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Free Trial Banner */}
          <div className="mb-12 p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-3">
              <Sparkles className="h-4 w-4" />
              Limited Time Offer
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Start with 30 days free</h3>
            <p className="text-zinc-400 max-w-xl mx-auto">No credit card required. Full access to all features. Cancel anytime. Special rates for registered NGOs and government agencies.</p>
          </div>

          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-black mb-4">
              {t("landing.pricing.title")}
              <span className="block bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
                {t("landing.pricing.titleAccent")}
              </span>
            </h2>
            <p className="text-zinc-400">
              {t("landing.pricing.description")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-2xl border transition-all ${
                  plan.popular
                    ? "bg-gradient-to-b from-red-500/10 to-amber-500/5 border-red-500/30 scale-105"
                    : "bg-white/[0.02] border-white/5 hover:border-white/10"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-red-500 to-amber-500 text-white text-xs font-bold">
                    {t("landing.pricing.popular")}
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-zinc-500">{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-zinc-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm text-zinc-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full ${
                    plan.popular
                      ? "bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-semibold"
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  }`}
                >
                  <Link to="/auth/signup">{t("landing.pricing.cta")}</Link>
                </Button>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-zinc-500 mt-8">
            {t("landing.pricing.footer")}
          </p>
        </div>
      </section>

      {/* Local Support Section */}
      <section className="py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                <MapPin className="h-3 w-3 text-amber-400" />
                <span className="text-xs text-amber-400">Based in Dili</span>
              </div>
              <h2 className="text-3xl font-black mb-4">
                Local support,
                <span className="block text-zinc-500">iha Tetun no English</span>
              </h2>
              <p className="text-zinc-400 mb-6">
                We're not a foreign company with offshore support. OniT is built in Timor-Leste,
                for Timor-Leste. Get help from people who understand local business practices.
              </p>
              <ul className="space-y-3">
                {[
                  "WhatsApp support in Tetun & English",
                  "On-site training available in Dili",
                  "Help with SEFOPE submissions",
                  "Bank integration assistance (BNU, BNCTL)",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="p-8 rounded-2xl bg-gradient-to-br from-amber-500/5 to-red-500/5 border border-amber-500/10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-xl">
                    🇹🇱
                  </div>
                  <div>
                    <p className="font-semibold text-white">Need help getting started?</p>
                    <p className="text-sm text-zinc-500">Free setup consultation</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <a href="https://wa.me/6707701234" className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                    <span className="text-xl">📱</span>
                    <div>
                      <p className="text-sm font-medium text-white">WhatsApp</p>
                      <p className="text-xs text-zinc-500">+670 770 1234</p>
                    </div>
                  </a>
                  <a href="mailto:suporte@onit.tl" className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                    <span className="text-xl">📧</span>
                    <div>
                      <p className="text-sm font-medium text-white">Email</p>
                      <p className="text-xs text-zinc-500">suporte@onit.tl</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-red-500/20 to-amber-500/20 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-black mb-6">
            {t("landing.cta.title")}
            <span className="block bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
              {t("landing.cta.titleAccent")}
            </span>
          </h2>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
            {t("landing.cta.description")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="h-14 px-10 text-base bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-semibold shadow-xl shadow-red-500/30">
              <Link to="/auth/signup">
                {t("landing.cta.primary")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-14 px-10 text-base border-white/10 bg-white/5 hover:bg-white/10 text-white">
              <Link to="/auth/login">{t("auth.signIn")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-black/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center">
                <span className="text-white text-xs font-black">TL</span>
              </div>
              <div>
                <span className="font-bold">{t("landing.footer.brand")}</span>
                <span className="text-zinc-600 text-sm ml-2">
                  {t("landing.footer.location")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-8 text-sm text-zinc-500">
              <a href="#" className="hover:text-white transition-colors">
                {t("landing.footer.links.privacy")}
              </a>
              <a href="#" className="hover:text-white transition-colors">
                {t("landing.footer.links.terms")}
              </a>
              <a href="#" className="hover:text-white transition-colors">
                {t("landing.footer.links.support")}
              </a>
              <a href="#" className="hover:text-white transition-colors">
                {t("landing.footer.links.contact")}
              </a>
            </div>
            <div className="text-sm text-zinc-600">
              {t("landing.footer.copyright")}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
