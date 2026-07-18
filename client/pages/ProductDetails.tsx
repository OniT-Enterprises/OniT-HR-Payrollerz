import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Landmark,
  Languages,
  ClipboardList,
  Lock,
  MessageCircle,
  Scale,
  Search,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicSectionNav } from "@/components/marketing/PublicSectionNav";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

type Locale = "en" | "tet" | "pt";

/** Gold crescent — the small mark used throughout Xefe's public identity. */
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
    <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.25em] text-lime-300">
      <Crescent className="h-3.5 w-3.5 text-lime-400" />
      {children}
    </p>
  );
}

function formatUSD(amount: number, locale: Locale): string {
  const locales: Record<Locale, string> = {
    en: "en-US",
    tet: "pt-TL",
    pt: "pt-TL",
  };
  return new Intl.NumberFormat(locales[locale], {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

interface WorkflowItem {
  icon: LucideIcon;
  title: string;
  you: string;
  xefe: string;
  verify: string;
}

interface JournalLine {
  code: string;
  account: string;
  debit: number;
  credit: number;
}

export default function ProductDetails() {
  const { t, locale } = useI18n();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const heroProof = [
    {
      icon: UsersRound,
      title: t("howItWorks.hero.proof.people.title"),
      description: t("howItWorks.hero.proof.people.description"),
    },
    {
      icon: Calculator,
      title: t("howItWorks.hero.proof.payroll.title"),
      description: t("howItWorks.hero.proof.payroll.description"),
    },
    {
      icon: Landmark,
      title: t("howItWorks.hero.proof.outputs.title"),
      description: t("howItWorks.hero.proof.outputs.description"),
    },
    {
      icon: BookOpen,
      title: t("howItWorks.hero.proof.accounts.title"),
      description: t("howItWorks.hero.proof.accounts.description"),
    },
  ];

  const audienceCards = [
    {
      icon: UsersRound,
      title: t("howItWorks.audience.everyday.title"),
      description: t("howItWorks.audience.everyday.description"),
      points: [
        t("howItWorks.audience.everyday.points.guided"),
        t("howItWorks.audience.everyday.points.defaults"),
        t("howItWorks.audience.everyday.points.language"),
      ],
      tone: "lime",
    },
    {
      icon: Search,
      title: t("howItWorks.audience.professional.title"),
      description: t("howItWorks.audience.professional.description"),
      points: [
        t("howItWorks.audience.professional.points.calculations"),
        t("howItWorks.audience.professional.points.accounting"),
        t("howItWorks.audience.professional.points.compliance"),
      ],
      tone: "amber",
    },
  ];

  const workflow: WorkflowItem[] = [
    {
      icon: UsersRound,
      title: t("howItWorks.workflow.people.title"),
      you: t("howItWorks.workflow.people.you"),
      xefe: t("howItWorks.workflow.people.xefe"),
      verify: t("howItWorks.workflow.people.verify"),
    },
    {
      icon: Calculator,
      title: t("howItWorks.workflow.payroll.title"),
      you: t("howItWorks.workflow.payroll.you"),
      xefe: t("howItWorks.workflow.payroll.xefe"),
      verify: t("howItWorks.workflow.payroll.verify"),
    },
    {
      icon: Landmark,
      title: t("howItWorks.workflow.payments.title"),
      you: t("howItWorks.workflow.payments.you"),
      xefe: t("howItWorks.workflow.payments.xefe"),
      verify: t("howItWorks.workflow.payments.verify"),
    },
    {
      icon: BookOpen,
      title: t("howItWorks.workflow.accounting.title"),
      you: t("howItWorks.workflow.accounting.you"),
      xefe: t("howItWorks.workflow.accounting.xefe"),
      verify: t("howItWorks.workflow.accounting.verify"),
    },
  ];

  const calculationRows = [
    { label: t("landing.tax.example.basicSalary"), value: 1200 },
    { label: t("landing.tax.example.overtime"), value: 180 },
    { label: t("landing.tax.example.foodAllowance"), value: 100 },
    { label: t("landing.tax.example.gross"), value: 1480, strong: true },
    { label: t("landing.tax.example.wit"), value: -98 },
    { label: t("landing.tax.example.inss"), value: -55.2 },
    { label: t("landing.tax.example.net"), value: 1326.8, total: true },
    { label: t("howItWorks.example.employerInss"), value: 82.8 },
    { label: t("howItWorks.example.employerCost"), value: 1562.8, strong: true },
  ];

  const journalLines: JournalLine[] = [
    {
      code: "5110",
      account: t("howItWorks.example.accounts.wages"),
      debit: 1480,
      credit: 0,
    },
    {
      code: "5150",
      account: t("howItWorks.example.accounts.employerInssExpense"),
      debit: 82.8,
      credit: 0,
    },
    {
      code: "2210",
      account: t("howItWorks.example.accounts.netPayable"),
      debit: 0,
      credit: 1326.8,
    },
    {
      code: "2220",
      account: t("howItWorks.example.accounts.witPayable"),
      debit: 0,
      credit: 98,
    },
    {
      code: "2230",
      account: t("howItWorks.example.accounts.employeeInssPayable"),
      debit: 0,
      credit: 55.2,
    },
    {
      code: "2240",
      account: t("howItWorks.example.accounts.employerInssPayable"),
      debit: 0,
      credit: 82.8,
    },
  ];

  const controls = [
    {
      icon: Calculator,
      title: t("howItWorks.controls.items.visible.title"),
      description: t("howItWorks.controls.items.visible.description"),
    },
    {
      icon: ClipboardCheck,
      title: t("howItWorks.controls.items.approval.title"),
      description: t("howItWorks.controls.items.approval.description"),
    },
    {
      icon: ShieldCheck,
      title: t("howItWorks.controls.items.noGuessing.title"),
      description: t("howItWorks.controls.items.noGuessing.description"),
    },
    {
      icon: BookOpen,
      title: t("howItWorks.controls.items.journals.title"),
      description: t("howItWorks.controls.items.journals.description"),
    },
    {
      icon: Lock,
      title: t("howItWorks.controls.items.audit.title"),
      description: t("howItWorks.controls.items.audit.description"),
    },
    {
      icon: FileSpreadsheet,
      title: t("howItWorks.controls.items.exports.title"),
      description: t("howItWorks.controls.items.exports.description"),
    },
  ];

  const outputs = [
    t("howItWorks.controls.outputs.payslips"),
    t("howItWorks.controls.outputs.bankFiles"),
    t("howItWorks.controls.outputs.payrollRegister"),
    t("howItWorks.controls.outputs.wit"),
    t("howItWorks.controls.outputs.inss"),
    t("howItWorks.controls.outputs.journal"),
    t("howItWorks.controls.outputs.ledger"),
    t("howItWorks.controls.outputs.statements"),
  ];

  const evidence = [
    {
      icon: Scale,
      title: t("howItWorks.evidence.items.sources.title"),
      description: t("howItWorks.evidence.items.sources.description"),
    },
    {
      icon: ClipboardList,
      title: t("howItWorks.evidence.items.testing.title"),
      description: t("howItWorks.evidence.items.testing.description"),
    },
    {
      icon: ShieldCheck,
      title: t("howItWorks.evidence.items.guardrails.title"),
      description: t("howItWorks.evidence.items.guardrails.description"),
    },
    {
      icon: Search,
      title: t("howItWorks.evidence.items.review.title"),
      description: t("howItWorks.evidence.items.review.description"),
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0b] text-white">
      <SEO {...seoConfig.howItWorks} />

      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-zinc-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("common.skipToContent")}
      </a>

      <PublicNav />
      <PublicSectionNav
        pageLabelKey="landing.simple.nav.howItWorks"
        accent="lime"
        sections={[
          { id: "workflow", labelKey: "howItWorks.nav.workflow" },
          { id: "example", labelKey: "howItWorks.nav.example" },
          { id: "controls", labelKey: "howItWorks.nav.controls" },
          { id: "evidence", labelKey: "howItWorks.nav.evidence" },
        ]}
      />

      <main id="main-content">
        <section className="relative overflow-hidden pb-20 pt-40 sm:pb-24 sm:pt-44 lg:pb-28 lg:pt-52">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(106,156,41,0.12),transparent_36%),radial-gradient(circle_at_15%_78%,rgba(251,191,36,0.06),transparent_32%)]" />
          <Crescent className="pointer-events-none absolute -right-24 -top-28 hidden h-[520px] w-[520px] text-lime-400/[0.05] md:block" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/10 px-3.5 py-2 text-sm text-lime-200">
                <UsersRound className="h-4 w-4" />
                {t("howItWorks.hero.eyebrow")}
              </div>

              <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.8rem]">
                {t("howItWorks.hero.title")}
                <span className="mt-1 block bg-gradient-to-r from-lime-200 via-lime-400 to-amber-300 bg-clip-text text-transparent">
                  {t("howItWorks.hero.titleAccent")}
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400 lg:text-xl">
                {t("howItWorks.hero.description")}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="h-12 bg-amber-400 px-7 text-base font-bold text-zinc-950 shadow-xl shadow-amber-500/20 hover:bg-amber-300"
                >
                  <Link to="/auth/signup">
                    {t("howItWorks.hero.primary")}
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 border-white/10 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#workflow">
                    {t("howItWorks.hero.secondary")}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="mt-8 flex flex-col gap-3 text-sm text-zinc-400 sm:flex-row sm:flex-wrap sm:gap-x-6">
                {[
                  t("howItWorks.hero.trust.plain"),
                  t("howItWorks.hero.trust.detail"),
                  t("howItWorks.hero.trust.languages"),
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/90 p-5 shadow-2xl shadow-black/50 sm:p-7">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {t("howItWorks.hero.proof.eyebrow")}
                    </p>
                    <h2 className="mt-2 text-lg font-bold">
                      {t("howItWorks.hero.proof.title")}
                    </h2>
                  </div>
                  <span className="rounded-full bg-lime-400 px-2.5 py-1 text-[11px] font-bold text-zinc-950">
                    {t("howItWorks.hero.proof.status")}
                  </span>
                </div>

                <div className="space-y-2">
                  {heroProof.map(({ icon: Icon, title, description }, index) => (
                    <div
                      key={title}
                      className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                        <Icon className="h-4 w-4 text-amber-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold">{title}</p>
                          <span className="font-mono text-xs text-zinc-600">0{index + 1}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("howItWorks.audience.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("howItWorks.audience.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("howItWorks.audience.description")}</p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              {audienceCards.map(({ icon: Icon, title, description, points, tone }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 sm:p-7"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone === "lime" ? "bg-lime-400/10" : "bg-amber-400/10"}`}>
                      <Icon className={`h-5 w-5 ${tone === "lime" ? "text-lime-400" : "text-amber-300"}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
                    </div>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
                        <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${tone === "lime" ? "text-lime-400" : "text-amber-300"}`} />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-xl border border-blue-400/15 bg-blue-400/[0.06] p-5">
              <Languages className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
              <p className="text-sm leading-6 text-zinc-300">
                <span className="font-bold text-white">{t("howItWorks.audience.modeTitle")}</span>{" "}
                {t("howItWorks.audience.modeDescription")}
              </p>
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("howItWorks.workflow.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("howItWorks.workflow.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("howItWorks.workflow.description")}</p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              {workflow.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10">
                          <Icon className="h-5 w-5 text-amber-300" />
                        </div>
                        <h3 className="text-lg font-bold">{item.title}</h3>
                      </div>
                      <span className="font-mono text-sm text-zinc-700">0{index + 1}</span>
                    </div>

                    <dl className="mt-6 space-y-4">
                      <WorkflowDetail label={t("howItWorks.workflow.labels.you")} value={item.you} />
                      <WorkflowDetail label={t("howItWorks.workflow.labels.xefe")} value={item.xefe} />
                      <WorkflowDetail label={t("howItWorks.workflow.labels.verify")} value={item.verify} />
                    </dl>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="example" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("howItWorks.example.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("howItWorks.example.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("howItWorks.example.description")}</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3.5 py-2 text-xs font-medium text-amber-200">
                <ShieldCheck className="h-4 w-4" />
                {t("howItWorks.example.synthetic")}
              </div>
            </div>

            <div className="mt-12 grid items-start gap-6 lg:grid-cols-[0.82fr_1.18fr]">
              <article className="rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {t("howItWorks.example.calculationEyebrow")}
                    </p>
                    <h3 className="mt-2 text-lg font-bold">{t("howItWorks.example.calculationTitle")}</h3>
                  </div>
                  <Calculator className="h-5 w-5 text-amber-300" />
                </div>

                <div className="mt-6 space-y-3 font-mono text-sm">
                  {calculationRows.map((row) => (
                    <div
                      key={row.label}
                      className={`flex items-baseline justify-between gap-4 ${row.strong || row.total ? "border-t border-white/10 pt-3" : ""}`}
                    >
                      <span className={`font-sans ${row.total ? "font-bold text-amber-300" : "text-zinc-400"}`}>
                        {row.label}
                      </span>
                      <span className={row.total ? "text-lg font-bold text-amber-300" : row.strong ? "font-bold text-white" : row.value < 0 ? "text-red-300" : "text-white"}>
                        {formatUSD(row.value, locale)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-2 rounded-xl bg-black/25 p-4 text-xs leading-5 text-zinc-400">
                  <p>{t("howItWorks.example.formulas.wit")}</p>
                  <p>{t("howItWorks.example.formulas.employeeInss")}</p>
                  <p>{t("howItWorks.example.formulas.employerInss")}</p>
                </div>
              </article>

              <article className="rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {t("howItWorks.example.journalEyebrow")}
                    </p>
                    <h3 className="mt-2 text-lg font-bold">{t("howItWorks.example.journalTitle")}</h3>
                  </div>
                  <BookOpen className="h-5 w-5 text-lime-400" />
                </div>

                <div className="mt-6 overflow-x-auto rounded-xl border border-white/[0.07]">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t("howItWorks.example.table.account")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("howItWorks.example.table.debit")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("howItWorks.example.table.credit")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {journalLines.map((line) => (
                        <tr key={line.code}>
                          <td className="px-4 py-3">
                            <span className="mr-2 font-mono text-xs text-zinc-500">{line.code}</span>
                            <span className="text-zinc-300">{line.account}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-300">
                            {line.debit ? formatUSD(line.debit, locale) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-300">
                            {line.credit ? formatUSD(line.credit, locale) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-amber-400/20 bg-amber-400/[0.06] font-bold text-amber-200">
                      <tr>
                        <td className="px-4 py-3">{t("howItWorks.example.table.total")}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatUSD(1562.8, locale)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatUSD(1562.8, locale)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-400">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
                  {t("howItWorks.example.journalNote")}
                </p>
              </article>
            </div>

            <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-5 text-zinc-500">
              {t("howItWorks.example.disclaimer")}
            </p>
          </div>
        </section>

        <section id="controls" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("howItWorks.controls.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("howItWorks.controls.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("howItWorks.controls.description")}</p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                {controls.map(({ icon: Icon, title, description }) => (
                  <article key={title} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/10">
                      <Icon className="h-5 w-5 text-amber-300" />
                    </div>
                    <h3 className="mt-4 font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
                  </article>
                ))}
              </div>

              <aside className="rounded-2xl border border-white/[0.07] bg-zinc-900/70 p-6 lg:sticky lg:top-24 lg:self-start">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-400/10">
                    <FileText className="h-5 w-5 text-lime-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      {t("howItWorks.controls.outputsEyebrow")}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">{t("howItWorks.controls.outputsTitle")}</h3>
                  </div>
                </div>

                <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {outputs.map((output) => (
                    <li key={output} className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-lime-400" />
                      <span>{output}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-xl border border-blue-400/15 bg-blue-400/[0.06] p-4">
                  <p className="text-sm font-bold text-blue-200">{t("howItWorks.controls.accountantModeTitle")}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">
                    {t("howItWorks.controls.accountantModeDescription")}
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section id="evidence" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("howItWorks.evidence.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("howItWorks.evidence.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("howItWorks.evidence.description")}</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {evidence.map(({ icon: Icon, title, description }, index) => (
                <article key={title} className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
                    <Icon className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-zinc-600">0{index + 1}</span>
                      <h3 className="font-bold">{title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-4 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-6">
              <Scale className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
              <div>
                <h3 className="font-bold text-amber-100">{t("howItWorks.evidence.honestyTitle")}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{t("howItWorks.evidence.honestyDescription")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/[0.06] py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08),transparent_48%)]" />
          <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-6 lg:px-8">
            <SectionEyebrow>{t("howItWorks.cta.eyebrow")}</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("howItWorks.cta.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-zinc-400">
              {t("howItWorks.cta.description")}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 bg-amber-400 px-8 text-base font-bold text-zinc-950 hover:bg-amber-300"
              >
                <Link to="/auth/signup">
                  {t("howItWorks.cta.primary")}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 border-white/10 bg-white/5 px-8 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <a href="https://wa.me/6707701234" target="_blank" rel="noreferrer">
                  <MessageCircle className="h-5 w-5 text-lime-400" />
                  {t("howItWorks.cta.whatsapp")}
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

function WorkflowDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[132px_1fr] sm:gap-4">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</dt>
      <dd className="text-sm leading-6 text-zinc-300">{value}</dd>
    </div>
  );
}
