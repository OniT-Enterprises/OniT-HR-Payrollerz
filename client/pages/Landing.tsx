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
  ChevronRight,
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
  ChevronDown,
  Settings,
  Target,
  Wallet,
  Briefcase,
  Smartphone,
  WifiOff,
  ShoppingBag,
  Printer,
  Zap,
  HardDrive,
  Feather,
  UtensilsCrossed,
  HardHat,
  BookOpen,
  MonitorSmartphone,
  FileSpreadsheet,
  UserCheck,
  CalendarCheck,
  Camera,
  Globe,
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
    { name: "BNU", full: "Banco Nacional Ultramarino", format: t("landing.banks.bnu"), key: "bnu" },
    { name: "BNCTL", full: "Banco Nacional de Comercio", format: t("landing.banks.bnctl"), key: "bnctl" },
    { name: "MANDIRI", full: "Bank Mandiri Timor-Leste", format: t("landing.banks.mandiri"), key: "mandiri" },
    { name: "ANZ", full: "ANZ Bank", format: t("landing.banks.anz"), key: "anz" },
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
              <img
                src="/images/illustrations/logo-v2-dark.webp"
                alt="Meza"
                className="h-9 w-auto"
              />
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {t("landing.nav.features")}
              </Link>
              <a href="#labor-law" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {t("landing.nav.laborLaw")}
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
              <Button asChild className="bg-gradient-to-r from-emerald-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white font-semibold shadow-lg shadow-emerald-500/25">
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
        {/* Background Effects - Brand gradient (teal → amber) */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-black/20 to-transparent rounded-full blur-[120px]" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-zinc-300">
                {t("landing.hero.badge")}{" "}
                <span className="text-emerald-400 font-medium">
                  {t("landing.hero.badgeHighlight")}
                </span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6">
              <span className="block text-white">{t("landing.hero.headline")}</span>
              <span className="block bg-gradient-to-r from-emerald-400 via-yellow-400 to-amber-300 bg-clip-text text-transparent">
                {t("landing.hero.headlineAccent")}
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-6 leading-relaxed">
              {t("landing.hero.subheadline.before")}
              <span className="text-white"> {t("landing.hero.subheadline.highlight1")}</span>
              {t("landing.hero.subheadline.middle")}
              <span className="text-white"> {t("landing.hero.subheadline.highlight2")}</span>
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
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <span>{t("landing.hero.points.accounting")}</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Button size="lg" asChild className="h-14 px-8 text-base bg-gradient-to-r from-emerald-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all">
                <Link to="/auth/signup">
                  {t("landing.hero.ctaPrimary")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-14 px-8 text-base border-white/10 bg-white/5 hover:bg-white/10 text-white">
                <Link to="/features">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  {t("landing.nav.features")}
                </Link>
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

          {/* Dashboard Preview - Hero Illustration */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-transparent to-transparent z-10 pointer-events-none" />
            <div className="relative flex justify-center">
              <img
                src="/images/illustrations/hero-dashboard.webp"
                alt="Meza HR dashboard command center"
                className="w-full max-w-3xl drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Who Uses OniT */}
      <section className="py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm text-zinc-500 uppercase tracking-wider mb-2">{t("landing.segments.subtitle")}</p>
            <h2 className="text-2xl font-bold text-white">{t("landing.segments.title")}</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { icon: Shield, label: t("landing.segments.security.label"), desc: t("landing.segments.security.desc"), color: "text-red-400" },
              { icon: UtensilsCrossed, label: t("landing.segments.restaurants.label"), desc: t("landing.segments.restaurants.desc"), color: "text-orange-400" },
              { icon: Heart, label: t("landing.segments.ngos.label"), desc: t("landing.segments.ngos.desc"), color: "text-rose-400" },
              { icon: Building2, label: t("landing.segments.hotels.label"), desc: t("landing.segments.hotels.desc"), color: "text-emerald-400" },
              { icon: BriefcaseBusiness, label: t("landing.segments.consulting.label"), desc: t("landing.segments.consulting.desc"), color: "text-blue-400" },
              { icon: HardHat, label: t("landing.segments.construction.label"), desc: t("landing.segments.construction.desc"), color: "text-amber-400" },
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
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { img: "pain-paper", border: "border-red-500/10", bg: "bg-red-500/5", titleKey: "landing.painPoints.paper.title", descKey: "landing.painPoints.paper.desc" },
              { img: "pain-excel", border: "border-amber-500/10", bg: "bg-amber-500/5", titleKey: "landing.painPoints.excel.title", descKey: "landing.painPoints.excel.desc" },
              { img: "pain-foreign", border: "border-blue-500/10", bg: "bg-blue-500/5", titleKey: "landing.painPoints.foreign.title", descKey: "landing.painPoints.foreign.desc" },
              { img: "pain-solution", border: "border-emerald-500/10", bg: "bg-emerald-500/5", titleKey: "landing.painPoints.solution.title", descKey: "landing.painPoints.solution.desc" },
            ].map((pain, i) => (
              <div key={i} className={`p-6 rounded-xl ${pain.bg} ${pain.border} border`}>
                <img src={`/images/illustrations/${pain.img}.webp`} alt="" className="h-28 w-28 mb-4 -ml-2" />
                <h3 className="font-semibold text-white mb-2">{t(pain.titleKey)}</h3>
                <p className="text-sm text-zinc-400">{t(pain.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timor-Specific Features */}
      <section id="features" className="py-24 lg:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <MapPin className="h-3 w-3 text-emerald-400" />
              <span className="text-xs text-emerald-400">
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
                  className="group relative p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 transition-all hover:bg-white/[0.04]"
                >
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-4 shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-baseline gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                    <span className="text-sm text-zinc-500">{feature.subtitle}</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
              );
            })}
          </div>

          {/* Banks — Killer Feature */}
          <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-amber-500/[0.04] via-white/[0.02] to-amber-500/[0.04] border border-amber-500/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Landmark className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">{t("landing.banks.title")}</h3>
                <p className="text-sm text-zinc-400">{t("landing.banks.subtitle")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
              {banks.map((bank, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/5">
                  <span className="font-bold text-white text-lg">{bank.name}</span>
                  <span className="text-[11px] text-zinc-500 text-center">{bank.full}</span>
                  <span className="mt-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 text-[11px] font-medium border border-amber-500/20">
                    {bank.format}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-amber-400/70 text-center font-medium">
              {t("landing.banks.tagline")}
            </p>
          </div>

          {/* Mobile Payments */}
          <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-emerald-500/5 via-amber-500/5 to-emerald-500/5 border border-amber-500/20">
            <div className="flex items-center gap-3 mb-5">
              <Smartphone className="h-5 w-5 text-amber-400" />
              <h4 className="font-bold text-white text-lg">{t("landing.mobilePay.title")}</h4>
            </div>
            <p className="text-sm text-zinc-400 mb-5">{t("landing.mobilePay.subtitle")}</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {/* T-PAY / Telkomcel */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                <img
                  src="/images/tpay-logo-white.png"
                  alt="T-PAY"
                  className="h-12 w-12 rounded-full object-contain bg-black"
                />
                <div>
                  <span className="text-sm font-semibold text-white block">T-PAY</span>
                  <img
                    src="/images/telkomcel-logo.png"
                    alt="Telkomcel"
                    className="h-4 w-auto opacity-60 mt-1"
                  />
                </div>
              </div>
              {/* Mosan / Telemor */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="h-12 w-12 rounded-full bg-[#FF6600] flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img
                    src="/images/telemor-logo.svg"
                    alt="Telemor"
                    className="h-5 w-auto"
                  />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">Mosan</span>
                  <span className="text-[10px] text-zinc-500">Telemor</span>
                </div>
              </div>
              {/* Coming Soon */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/10 col-span-2 lg:col-span-1">
                <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-5 w-5 text-zinc-600" />
                </div>
                <div>
                  <span className="text-sm font-medium text-zinc-400 block">{t("landing.mobilePay.comingSoon")}</span>
                  <span className="text-[10px] text-zinc-600">More integrations</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              {t("landing.mobilePay.note")}
            </p>
          </div>
        </div>
      </section>

      {/* All Platform Modules */}
      <section className="py-24 lg:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
              <Settings className="h-3 w-3 text-violet-400" />
              <span className="text-xs text-violet-400">{t("landing.modules.badge")}</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-black mb-4">
              {t("landing.modules.title")}
              <span className="block text-zinc-500 text-2xl lg:text-3xl mt-2">
                {t("landing.modules.titleAccent")}
              </span>
            </h2>
            <p className="text-zinc-400">
              {t("landing.modules.description")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Users, name: t("landing.modules.people.name"), desc: t("landing.modules.people.desc"), color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { icon: Briefcase, name: t("landing.modules.hiring.name"), desc: t("landing.modules.hiring.desc"), color: "text-violet-400", bg: "bg-violet-500/10" },
              { icon: Clock, name: t("landing.modules.time.name"), desc: t("landing.modules.time.desc"), color: "text-orange-400", bg: "bg-orange-500/10" },
              { icon: Target, name: t("landing.modules.performance.name"), desc: t("landing.modules.performance.desc"), color: "text-pink-400", bg: "bg-pink-500/10" },
              { icon: Calculator, name: t("landing.modules.payroll.name"), desc: t("landing.modules.payroll.desc"), color: "text-blue-400", bg: "bg-blue-500/10" },
              { icon: Wallet, name: t("landing.modules.money.name"), desc: t("landing.modules.money.desc"), color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { icon: Landmark, name: t("landing.modules.accounting.name"), desc: t("landing.modules.accounting.desc"), color: "text-slate-400", bg: "bg-slate-500/10" },
              { icon: BarChart3, name: t("landing.modules.reports.name"), desc: t("landing.modules.reports.desc"), color: "text-cyan-400", bg: "bg-cyan-500/10" },
              { icon: Shield, name: t("landing.modules.compliance.name"), desc: t("landing.modules.compliance.desc"), color: "text-red-400", bg: "bg-red-500/10" },
            ].map((module, i) => {
              const Icon = module.icon;
              return (
                <div key={i} className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${module.bg}`}>
                      <Icon className={`h-5 w-5 ${module.color}`} />
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

      {/* ═══════════════════════════════════════════════════════════
          Ekipa — Employee Mobile Companion
      ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 border-t border-white/5 relative overflow-hidden">
        {/* Teal glow */}
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-teal-500/[0.07] rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] bg-emerald-600/[0.05] rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 mb-4">
              <Users className="h-3 w-3 text-teal-400" />
              <span className="text-xs text-teal-400">{t("landing.ekipa.badge")}</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-black mb-2">
              {t("landing.ekipa.title")}
              <span className="block text-zinc-500 text-2xl lg:text-3xl mt-2">
                {t("landing.ekipa.titleAccent")}
              </span>
            </h2>
            <p className="text-zinc-400 mt-4">
              {t("landing.ekipa.description")}
            </p>
          </div>

          {/* Two-column: Phone Mockup + Features */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Features */}
            <div>
              <p className="text-sm text-teal-400/80 font-medium mb-6 italic">
                {t("landing.ekipa.tagline")}
              </p>
              <div className="space-y-5">
                {[
                  { icon: FileText, title: t("landing.ekipa.features.payslips.title"), desc: t("landing.ekipa.features.payslips.desc"), color: "text-teal-400", bg: "bg-teal-500/10" },
                  { icon: CalendarCheck, title: t("landing.ekipa.features.leave.title"), desc: t("landing.ekipa.features.leave.desc"), color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { icon: Camera, title: t("landing.ekipa.features.crewClock.title"), desc: t("landing.ekipa.features.crewClock.desc"), color: "text-cyan-400", bg: "bg-cyan-500/10" },
                  { icon: WifiOff, title: t("landing.ekipa.features.offline.title"), desc: t("landing.ekipa.features.offline.desc"), color: "text-blue-400", bg: "bg-blue-500/10" },
                  { icon: Globe, title: t("landing.ekipa.features.bilingual.title"), desc: t("landing.ekipa.features.bilingual.desc"), color: "text-violet-400", bg: "bg-violet-500/10" },
                  { icon: UserCheck, title: t("landing.ekipa.features.selfService.title"), desc: t("landing.ekipa.features.selfService.desc"), color: "text-amber-400", bg: "bg-amber-500/10" },
                ].map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <div key={i} className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${feature.bg} flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${feature.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/20 text-teal-300 font-medium text-sm">
                  <Smartphone className="h-4 w-4" />
                  {t("landing.ekipa.cta")}
                </div>
                <span className="text-xs text-zinc-600">{t("landing.ekipa.ctaNote")}</span>
              </div>
            </div>

            {/* Phone Mockup */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Glow behind phone */}
                <div className="absolute inset-0 bg-gradient-to-b from-teal-500/20 to-emerald-600/10 rounded-[3rem] blur-2xl scale-110" />
                {/* Phone frame */}
                <div className="relative rounded-[2.5rem] border-[6px] border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/50 w-[280px]">
                  {/* Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-zinc-800 rounded-full z-10" />
                  {/* Screen */}
                  <div className="rounded-[2rem] overflow-hidden bg-[#111]">
                    {/* Status bar */}
                    <div className="flex justify-between items-center px-6 pt-7 pb-2">
                      <span className="text-[10px] text-zinc-500 font-medium">9:41</span>
                      <div className="flex gap-1.5 items-center text-[10px] text-zinc-500">
                        <span>LTE</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* App header */}
                    <div className="px-5 pt-2 pb-3">
                      <p className="text-teal-400 font-bold text-base tracking-wide">Ekipa</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">Bondia, Maria</p>
                    </div>

                    {/* Payday countdown */}
                    <div className="mx-4 p-4 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-600/10 border border-teal-500/20 mb-3">
                      <p className="text-[10px] text-zinc-400 mb-1">Next payday</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-white">3</p>
                        <p className="text-sm text-zinc-400">days</p>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 mt-2">
                        <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-teal-400 to-emerald-400" />
                      </div>
                    </div>

                    {/* Leave Balance Card */}
                    <div className="mx-4 p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-3">
                      <p className="text-[10px] text-zinc-500 mb-2 font-medium">Leave balance</p>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <p className="text-lg font-bold text-emerald-400">12</p>
                          <p className="text-[9px] text-zinc-500">Annual</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-bold text-blue-400">8</p>
                          <p className="text-[9px] text-zinc-500">Sick</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-bold text-amber-400">2</p>
                          <p className="text-[9px] text-zinc-500">Personal</p>
                        </div>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-3 gap-2 px-4 mb-3">
                      <div className="py-2.5 rounded-xl bg-teal-500/15 border border-teal-500/20 text-center">
                        <FileText className="h-4 w-4 text-teal-400 mx-auto mb-1" />
                        <span className="text-[9px] text-teal-300 block">Payslips</span>
                      </div>
                      <div className="py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-center">
                        <CalendarCheck className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                        <span className="text-[9px] text-emerald-300 block">Leave</span>
                      </div>
                      <div className="py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-center">
                        <Clock className="h-4 w-4 text-cyan-400 mx-auto mb-1" />
                        <span className="text-[9px] text-cyan-300 block">Clock In</span>
                      </div>
                    </div>

                    {/* Latest payslip */}
                    <div className="px-4 pb-6">
                      <p className="text-[10px] text-zinc-500 mb-2 font-medium">Latest payslip</p>
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[10px] text-zinc-400 block">January 2026</span>
                            <span className="text-sm font-semibold text-white">$847.30</span>
                          </div>
                          <div className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-medium">Paid</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Two Tiers - Shipped / Coming Next */}
          <div className="mt-20 grid md:grid-cols-2 gap-6">
            {/* Shipped */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-teal-500/20 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-semibold border border-teal-500/20">{t("landing.ekipa.shipped.badge")}</div>
                <h3 className="font-bold text-white text-lg">{t("landing.ekipa.shipped.title")}</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  t("landing.ekipa.shipped.features.login"),
                  t("landing.ekipa.shipped.features.dashboard"),
                  t("landing.ekipa.shipped.features.payslips"),
                  t("landing.ekipa.shipped.features.leave"),
                  t("landing.ekipa.shipped.features.crewClock"),
                  t("landing.ekipa.shipped.features.profile"),
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Coming Next */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/[0.03] to-emerald-500/[0.03] border border-teal-500/20 hover:border-teal-400/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">{t("landing.ekipa.coming.badge")}</div>
                <h3 className="font-bold text-white text-lg">{t("landing.ekipa.coming.title")}</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  t("landing.ekipa.coming.features.push"),
                  t("landing.ekipa.coming.features.attendance"),
                  t("landing.ekipa.coming.features.documents"),
                  t("landing.ekipa.coming.features.shifts"),
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Built for TL Internet */}
      <section className="py-16 lg:py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="p-8 rounded-2xl bg-gradient-to-r from-cyan-500/[0.04] via-white/[0.02] to-blue-500/[0.04] border border-cyan-500/15">
              <div className="flex items-center gap-3 mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                  <Zap className="h-3 w-3 text-cyan-400" />
                  <span className="text-xs text-cyan-400">{t("landing.performance.badge")}</span>
                </div>
              </div>
              <h3 className="text-2xl font-black text-white mt-4 mb-2">{t("landing.performance.title")}</h3>
              <p className="text-sm text-zinc-400 mb-6">{t("landing.performance.description")}</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: HardDrive, text: t("landing.performance.features.cache"), color: "text-cyan-400", bg: "bg-cyan-500/10" },
                  { icon: Feather, text: t("landing.performance.features.lazy"), color: "text-blue-400", bg: "bg-blue-500/10" },
                  { icon: Zap, text: t("landing.performance.features.small"), color: "text-emerald-400", bg: "bg-emerald-500/10" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className={`p-1.5 rounded-md ${item.bg} flex-shrink-0`}>
                        <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                      </div>
                      <span className="text-xs text-zinc-300 leading-relaxed">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kaixa — Mobile Money & POS */}
      <section className="py-24 lg:py-32 border-t border-white/5 relative overflow-hidden">
        {/* Warm terracotta glow */}
        <div className="absolute inset-0">
          <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-orange-500/[0.07] rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-amber-600/[0.05] rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 mb-4">
              <Smartphone className="h-3 w-3 text-orange-400" />
              <span className="text-xs text-orange-400">{t("landing.kaixa.badge")}</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-black mb-2">
              {t("landing.kaixa.title")}
              <span className="block text-zinc-500 text-2xl lg:text-3xl mt-2">
                {t("landing.kaixa.titleAccent")}
              </span>
            </h2>
            <p className="text-zinc-400 mt-4">
              {t("landing.kaixa.description")}
            </p>
          </div>

          {/* Two-column: Phone Mockup + Features */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Phone Mockup */}
            <div className="flex justify-center order-2 lg:order-1">
              <div className="relative">
                {/* Glow behind phone */}
                <div className="absolute inset-0 bg-gradient-to-b from-orange-500/20 to-amber-600/10 rounded-[3rem] blur-2xl scale-110" />
                {/* Phone frame */}
                <div className="relative rounded-[2.5rem] border-[6px] border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/50 w-[280px]">
                  {/* Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-zinc-800 rounded-full z-10" />
                  {/* Screen */}
                  <div className="rounded-[2rem] overflow-hidden bg-[#111]">
                    {/* Status bar */}
                    <div className="flex justify-between items-center px-6 pt-7 pb-2">
                      <span className="text-[10px] text-zinc-500 font-medium">9:41</span>
                      <div className="flex gap-1.5 items-center text-[10px] text-zinc-500">
                        <WifiOff className="h-2.5 w-2.5" />
                        <span>100%</span>
                      </div>
                    </div>

                    {/* App header */}
                    <div className="px-5 pt-2 pb-3">
                      <p className="text-orange-400 font-bold text-base tracking-wide">Kaixa</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">Ohin loron</p>
                    </div>

                    {/* Balance card */}
                    <div className="mx-4 p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-600/10 border border-orange-500/20 mb-3">
                      <p className="text-[10px] text-zinc-400 mb-1">Balansu ohin</p>
                      <p className="text-2xl font-bold text-white">$247.50</p>
                      <div className="flex gap-4 mt-2">
                        <div>
                          <p className="text-[9px] text-emerald-500">&#8593; Tama</p>
                          <p className="text-xs font-semibold text-emerald-400">$385.00</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-red-500">&#8595; Sai</p>
                          <p className="text-xs font-semibold text-red-400">$137.50</p>
                        </div>
                      </div>
                    </div>

                    {/* Money In / Money Out buttons */}
                    <div className="grid grid-cols-2 gap-2 px-4 mb-3">
                      <div className="py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 mx-auto mb-1.5 flex items-center justify-center">
                          <span className="text-emerald-400 font-bold text-sm">+</span>
                        </div>
                        <span className="text-[11px] text-emerald-300 font-semibold block">Tama</span>
                        <span className="text-[9px] text-zinc-500">Money In</span>
                      </div>
                      <div className="py-3 rounded-xl bg-red-500/15 border border-red-500/20 text-center">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 mx-auto mb-1.5 flex items-center justify-center">
                          <span className="text-red-400 font-bold text-sm">&minus;</span>
                        </div>
                        <span className="text-[11px] text-red-300 font-semibold block">Sai</span>
                        <span className="text-[9px] text-zinc-500">Money Out</span>
                      </div>
                    </div>

                    {/* Recent transactions */}
                    <div className="px-4 pb-6">
                      <p className="text-[10px] text-zinc-500 mb-2 font-medium">Transasaun resente</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center p-2 rounded-lg bg-white/[0.03]">
                          <span className="text-[10px] text-zinc-400">Kreditu telemovel</span>
                          <span className="text-[10px] text-emerald-400 font-medium">+$85.00</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-white/[0.03]">
                          <span className="text-[10px] text-zinc-400">Sosa stock</span>
                          <span className="text-[10px] text-red-400 font-medium">&minus;$42.50</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-white/[0.03]">
                          <span className="text-[10px] text-zinc-400">Fa'an sigaru</span>
                          <span className="text-[10px] text-emerald-400 font-medium">+$15.00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="order-1 lg:order-2">
              <p className="text-sm text-orange-400/80 font-medium mb-6 italic">
                {t("landing.kaixa.tagline")}
              </p>
              <div className="space-y-5">
                {[
                  { icon: DollarSign, title: t("landing.kaixa.features.tamasai.title"), desc: t("landing.kaixa.features.tamasai.desc"), color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { icon: ShoppingBag, title: t("landing.kaixa.features.pos.title"), desc: t("landing.kaixa.features.pos.desc"), color: "text-orange-400", bg: "bg-orange-500/10" },
                  { icon: WifiOff, title: t("landing.kaixa.features.offline.title"), desc: t("landing.kaixa.features.offline.desc"), color: "text-blue-400", bg: "bg-blue-500/10" },
                  { icon: Languages, title: t("landing.kaixa.features.tetum.title"), desc: t("landing.kaixa.features.tetum.desc"), color: "text-violet-400", bg: "bg-violet-500/10" },
                  { icon: Printer, title: t("landing.kaixa.features.bluetooth.title"), desc: t("landing.kaixa.features.bluetooth.desc"), color: "text-cyan-400", bg: "bg-cyan-500/10" },
                  { icon: Shield, title: t("landing.kaixa.features.vat.title"), desc: t("landing.kaixa.features.vat.desc"), color: "text-amber-400", bg: "bg-amber-500/10" },
                ].map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <div key={i} className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${feature.bg} flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${feature.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/20 text-orange-300 font-medium text-sm">
                  <Smartphone className="h-4 w-4" />
                  {t("landing.kaixa.cta")}
                </div>
                <span className="text-xs text-zinc-600">{t("landing.kaixa.ctaNote")}</span>
              </div>
            </div>
          </div>

          {/* Two Tiers */}
          <div className="mt-20 grid md:grid-cols-2 gap-6">
            {/* Tier 1: Free */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-orange-500/20 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">{t("landing.kaixa.free.badge")}</div>
                <h3 className="font-bold text-white text-lg">{t("landing.kaixa.free.title")}</h3>
              </div>
              <p className="text-sm text-zinc-400 mb-4">
                {t("landing.kaixa.free.desc")}
              </p>
              <ul className="space-y-2.5">
                {[
                  t("landing.kaixa.free.features.moneyInOut"),
                  t("landing.kaixa.free.features.summaries"),
                  t("landing.kaixa.free.features.photoReceipts"),
                  t("landing.kaixa.free.features.categories"),
                  t("landing.kaixa.free.features.offline"),
                  t("landing.kaixa.free.features.tetum"),
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tier 2: Freemium */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/[0.03] to-amber-500/[0.03] border border-orange-500/20 hover:border-orange-400/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-semibold border border-orange-500/20">{t("landing.kaixa.upgrade.badge")}</div>
                <h3 className="font-bold text-white text-lg">{t("landing.kaixa.upgrade.title")}</h3>
              </div>
              <p className="text-sm text-zinc-400 mb-4">
                {t("landing.kaixa.upgrade.desc")}
              </p>
              <ul className="space-y-2.5">
                {[
                  t("landing.kaixa.upgrade.features.catalog"),
                  t("landing.kaixa.upgrade.features.tapToSell"),
                  t("landing.kaixa.upgrade.features.inventory"),
                  t("landing.kaixa.upgrade.features.customerTabs"),
                  t("landing.kaixa.upgrade.features.printer"),
                  t("landing.kaixa.upgrade.features.whatsapp"),
                  t("landing.kaixa.upgrade.features.monthlyReport"),
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Who is Kaixa for? */}
          <div className="mt-12 grid sm:grid-cols-3 gap-4">
            {[
              { img: "persona-maria", name: t("landing.kaixa.personas.maria.name"), role: t("landing.kaixa.personas.maria.role"), desc: t("landing.kaixa.personas.maria.desc") },
              { img: "persona-ana", name: t("landing.kaixa.personas.ana.name"), role: t("landing.kaixa.personas.ana.role"), desc: t("landing.kaixa.personas.ana.desc") },
              { img: "persona-tomas", name: t("landing.kaixa.personas.tomas.name"), role: t("landing.kaixa.personas.tomas.role"), desc: t("landing.kaixa.personas.tomas.desc") },
            ].map((persona, i) => (
              <div key={i} className="p-5 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                <img src={`/images/illustrations/${persona.img}.webp`} alt={persona.name} className="h-20 w-20 rounded-full mx-auto mb-3 object-cover" />
                <h4 className="font-semibold text-white">{persona.name}</h4>
                <p className="text-xs text-orange-400/70 mb-2">{persona.role}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{persona.desc}</p>
              </div>
            ))}
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

      {/* Accounting Section */}
      <section className="py-24 lg:py-32 border-t border-white/5 bg-gradient-to-b from-transparent via-slate-500/[0.03] to-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/10 border border-slate-500/20 mb-4">
              <BookOpen className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-400">
                {t("landing.accounting.badge")}
              </span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-black mb-4">
              {t("landing.accounting.title")}
              <span className="block bg-gradient-to-r from-slate-300 to-zinc-400 bg-clip-text text-transparent">
                {t("landing.accounting.titleAccent")}
              </span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: BookOpen, title: t("landing.accounting.features.doubleEntry.title"), desc: t("landing.accounting.features.doubleEntry.desc"), color: "text-slate-300", bg: "bg-slate-500/10" },
              { icon: FileSpreadsheet, title: t("landing.accounting.features.glTrial.title"), desc: t("landing.accounting.features.glTrial.desc"), color: "text-zinc-300", bg: "bg-zinc-500/10" },
              { icon: Zap, title: t("landing.accounting.features.autoPost.title"), desc: t("landing.accounting.features.autoPost.desc"), color: "text-amber-400", bg: "bg-amber-500/10" },
              { icon: MonitorSmartphone, title: t("landing.accounting.features.qbExport.title"), desc: t("landing.accounting.features.qbExport.desc"), color: "text-blue-400", bg: "bg-blue-500/10" },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-slate-500/20 transition-colors">
                  <div className="p-2.5 rounded-lg bg-white/5 inline-flex mb-4">
                    <Icon className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-center text-sm text-zinc-500 italic max-w-2xl mx-auto">
            {t("landing.accounting.description")}
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
                <span className="text-xs text-amber-400">{t("landing.localSupport.badge")}</span>
              </div>
              <h2 className="text-3xl font-black mb-4">
                {t("landing.localSupport.title")}
                <span className="block text-zinc-500">{t("landing.localSupport.titleAccent")}</span>
              </h2>
              <p className="text-zinc-400 mb-6">
                {t("landing.localSupport.description")}
              </p>
              <ul className="space-y-3">
                {[
                  t("landing.localSupport.items.whatsapp"),
                  t("landing.localSupport.items.training"),
                  t("landing.localSupport.items.sefope"),
                  t("landing.localSupport.items.bank"),
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
                    <p className="font-semibold text-white">{t("landing.localSupport.cta.title")}</p>
                    <p className="text-sm text-zinc-500">{t("landing.localSupport.cta.subtitle")}</p>
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-emerald-500/20 to-amber-500/20 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-black mb-6">
            {t("landing.cta.title")}
            <span className="block bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
              {t("landing.cta.titleAccent")}
            </span>
          </h2>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
            {t("landing.cta.description")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="h-14 px-10 text-base bg-gradient-to-r from-emerald-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white font-semibold shadow-xl shadow-emerald-500/30">
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
              <img
                src="/images/illustrations/logo-v2-dark.webp"
                alt="Meza"
                className="h-7 w-auto"
              />
              <span className="text-zinc-600 text-sm">
                {t("landing.footer.location")}
              </span>
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
