/**
 * /docs/payroll-money-chain — first article of the public documentation
 * section. Marketing design language (docs/DESIGN_MARKETING.md): lime accent,
 * crescent-only decoration, calculation artifacts (ledger entries) as the
 * visual core, tabular-nums for anything money-shaped.
 *
 * PUBLIC-SAFE: statutes, deadlines and our own product guarantees only.
 * Never mention data sourcing (mail corpus, firms, assessment amounts) —
 * same rule as the /engine proof wording (docs/PUBLIC_SITE.md).
 */
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicSectionNav } from "@/components/marketing/PublicSectionNav";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { localeFromPath, withLocalePrefix } from "@/lib/publicLocale";
import { cn } from "@/lib/utils";

function StatePill({
  label,
  note,
  hot,
  terminal,
}: {
  label: string;
  note: string;
  hot?: boolean;
  terminal?: boolean;
}) {
  return (
    <div className="min-w-[130px] flex-1 text-center">
      <span
        className={cn(
          "inline-block rounded-full border px-4 py-1.5 font-mono text-[13px] font-semibold",
          hot
            ? "border-lime-400/60 bg-lime-400/[0.06] text-lime-300"
            : terminal
              ? "border-white/25 text-zinc-200"
              : "border-white/15 text-zinc-400",
        )}
      >
        {label}
      </span>
      <p className="mt-2 px-1 text-[11.5px] leading-snug text-zinc-400">
        {note}
      </p>
    </div>
  );
}

function LedgerCard({
  title,
  when,
  rows,
  foot,
}: {
  title: string;
  when: string;
  rows: { code: string; name: string; side: "dr" | "cr" }[];
  foot: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025]">
      <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          {when}
        </span>
      </div>
      <div className="px-5 py-3 font-mono text-[12.5px]">
        {rows.map((row) => (
          <div
            key={`${row.code}-${row.side}`}
            className={cn(
              "flex items-baseline justify-between gap-3 py-1.5",
              row.side === "cr" && "pl-6",
            )}
          >
            <span className={row.side === "dr" ? "text-zinc-200" : "text-zinc-400"}>
              <span className="text-zinc-500">{row.code}</span> {row.name}
            </span>
            <span
              className={cn(
                "font-bold",
                row.side === "dr" ? "text-lime-300" : "text-zinc-500",
              )}
            >
              {row.side === "dr" ? "Dr" : "Cr"}
            </span>
          </div>
        ))}
      </div>
      <p className="border-t border-white/[0.07] px-5 py-3 text-xs leading-relaxed text-zinc-400">
        {foot}
      </p>
    </div>
  );
}

export default function DocsMoneyChain() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const locale = localeFromPath(pathname);
  const p = (path: string) => withLocalePrefix(path, locale);

  const deadlines = [
    { day: "10", key: "d10", owner: "payroll" },
    { day: "15", key: "d15", owner: "payroll" },
    { day: "20", key: "d20", owner: "payroll" },
    { day: "31/03", key: "d31", owner: "accounting" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <SEO {...seoConfig.docsMoneyChain} />
      <PublicNav />
      <PublicSectionNav
        accent="lime"
        pageLabelKey="publicDocs.chain.navLabel"
        sections={[
          { id: "lifecycle", labelKey: "publicDocs.chain.nav.lifecycle" },
          { id: "journals", labelKey: "publicDocs.chain.nav.journals" },
          { id: "deadlines", labelKey: "publicDocs.chain.nav.deadlines" },
          { id: "guarantees", labelKey: "publicDocs.chain.nav.guarantees" },
        ]}
      />

      {/* ── hero ── */}
      <header className="mx-auto max-w-5xl px-6 pb-16 pt-16 sm:pt-20">
        <SectionEyebrow accent="lime">
          {t("publicDocs.eyebrow")}
        </SectionEyebrow>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
          {t("publicDocs.chain.titleTop")}{" "}
          <span className="bg-gradient-to-r from-lime-300 to-lime-500 bg-clip-text text-transparent">
            {t("publicDocs.chain.titleAccent")}
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
          {t("publicDocs.chain.lede")}
        </p>
      </header>

      {/* ── 1. lifecycle ── */}
      <section id="lifecycle" className="mx-auto max-w-5xl px-6 py-14">
        <SectionEyebrow accent="lime">
          {t("publicDocs.chain.s1.eyebrow")}
        </SectionEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
          {t("publicDocs.chain.s1.title")}
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
          {t("publicDocs.chain.s1.body")}
        </p>
        <div className="mt-8 overflow-x-auto pb-2">
          <div className="flex min-w-[880px] items-start gap-1">
            <StatePill
              label={t("publicDocs.chain.s1.draft")}
              note={t("publicDocs.chain.s1.draftNote")}
            />
            <span className="mt-1.5 shrink-0 text-lime-400/70">→</span>
            <StatePill
              hot
              label={t("publicDocs.chain.s1.processing")}
              note={t("publicDocs.chain.s1.processingNote")}
            />
            <span className="mt-1.5 shrink-0 text-lime-400/70">→</span>
            <StatePill
              hot
              label={t("publicDocs.chain.s1.approved")}
              note={t("publicDocs.chain.s1.approvedNote")}
            />
            <span className="mt-1.5 shrink-0 text-lime-400/70">→</span>
            <StatePill
              hot
              label={t("publicDocs.chain.s1.paid")}
              note={t("publicDocs.chain.s1.paidNote")}
            />
            <span className="mt-1.5 shrink-0 text-lime-400/70">→</span>
            <StatePill
              terminal
              label={t("publicDocs.chain.s1.closed")}
              note={t("publicDocs.chain.s1.closedNote")}
            />
          </div>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-lime-300" />
          <p className="text-sm leading-relaxed text-zinc-300">
            {t("publicDocs.chain.s1.gate")}
          </p>
        </div>
      </section>

      {/* ── 2. journals ── */}
      <section id="journals" className="mx-auto max-w-5xl px-6 py-14">
        <SectionEyebrow accent="lime">
          {t("publicDocs.chain.s2.eyebrow")}
        </SectionEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
          {t("publicDocs.chain.s2.title")}
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
          {t("publicDocs.chain.s2.body")}
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <LedgerCard
            title={t("publicDocs.chain.s2.accrual")}
            when={t("publicDocs.chain.s2.accrualWhen")}
            foot={t("publicDocs.chain.s2.accrualFoot")}
            rows={[
              { code: "5110", name: t("publicDocs.chain.acct.salaries"), side: "dr" },
              { code: "5150", name: t("publicDocs.chain.acct.inssEmployer"), side: "dr" },
              { code: "2210", name: t("publicDocs.chain.acct.netPayable"), side: "cr" },
              { code: "2220", name: t("publicDocs.chain.acct.witPayable"), side: "cr" },
              { code: "2230", name: t("publicDocs.chain.acct.inssEmpPayable"), side: "cr" },
              { code: "2240", name: t("publicDocs.chain.acct.inssErPayable"), side: "cr" },
            ]}
          />
          <LedgerCard
            title={t("publicDocs.chain.s2.settlement")}
            when={t("publicDocs.chain.s2.settlementWhen")}
            foot={t("publicDocs.chain.s2.settlementFoot")}
            rows={[
              { code: "2210", name: t("publicDocs.chain.acct.netPayable"), side: "dr" },
              { code: "11xx", name: t("publicDocs.chain.acct.bank"), side: "cr" },
            ]}
          />
          <LedgerCard
            title={t("publicDocs.chain.s2.clearing")}
            when={t("publicDocs.chain.s2.clearingWhen")}
            foot={t("publicDocs.chain.s2.clearingFoot")}
            rows={[
              { code: "2220", name: t("publicDocs.chain.acct.witPayable"), side: "dr" },
              { code: "2230", name: t("publicDocs.chain.acct.inssEmpPayable"), side: "dr" },
              { code: "2240", name: t("publicDocs.chain.acct.inssErPayable"), side: "dr" },
              { code: "11xx", name: t("publicDocs.chain.acct.bank"), side: "cr" },
            ]}
          />
        </div>
      </section>

      {/* ── 3. deadlines ── */}
      <section id="deadlines" className="mx-auto max-w-5xl px-6 py-14">
        <SectionEyebrow accent="lime">
          {t("publicDocs.chain.s3.eyebrow")}
        </SectionEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
          {t("publicDocs.chain.s3.title")}
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
          {t("publicDocs.chain.s3.body")}
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {deadlines.map((deadline) => (
            <div
              key={deadline.key}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
            >
              <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-lime-300">
                {deadline.day}
                <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {t(`publicDocs.chain.s3.${deadline.key}Small`)}
                </span>
              </p>
              <h3 className="mt-2 text-[15px] font-bold text-white">
                {t(`publicDocs.chain.s3.${deadline.key}Title`)}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
                {t(`publicDocs.chain.s3.${deadline.key}Body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. guarantees ── */}
      <section id="guarantees" className="mx-auto max-w-5xl px-6 py-14">
        <SectionEyebrow accent="lime">
          {t("publicDocs.chain.s4.eyebrow")}
        </SectionEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
          {t("publicDocs.chain.s4.title")}
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
          {t("publicDocs.chain.s4.body")}
        </p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.07]">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => (
            <div
              key={n}
              className={cn(
                "grid grid-cols-[48px_1fr] bg-white/[0.02]",
                n > 1 && "border-t border-white/[0.06]",
              )}
            >
              <span className="flex justify-center pt-4 font-mono text-[13px] font-bold text-lime-400/80">
                {n}
              </span>
              <div className="py-3.5 pr-5">
                <p className="text-sm font-semibold text-zinc-200">
                  {t(`publicDocs.chain.s4.g${n}`)}
                </p>
                <p className="mt-0.5 text-[12.5px] text-zinc-400">
                  {t(`publicDocs.chain.s4.g${n}By`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <div className="flex flex-col items-start gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              {t("publicDocs.chain.cta.title")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              {t("publicDocs.chain.cta.body")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button
              asChild
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              <Link to={p("/engine")}>
                {t("publicDocs.chain.cta.engine")}
              </Link>
            </Button>
            <Button
              asChild
              className="bg-amber-400 font-semibold text-black hover:bg-amber-300"
            >
              <Link to="/auth/signup">
                {t("publicDocs.chain.cta.signup")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
