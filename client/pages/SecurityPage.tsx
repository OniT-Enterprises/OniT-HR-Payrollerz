/**
 * /security — the public trust page. Everything Xefe already does for
 * safety, written down: server-enforced rules, tested-before-deploy,
 * backups, privacy-by-construction. Marketing design language, sky accent
 * (calm, factual — no drama, no unverifiable claims).
 */
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  ClipboardCheck,
  Lock,
  Mail,
  ShieldCheck,
  UsersRound,
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

export default function SecurityPage() {
  const { t } = useI18n();
  const location = useLocation();
  const locale = localeFromPath(location.pathname);
  const to = (path: string) => withLocalePrefix(path, locale);

  const CONTROL_CARDS = [
    { key: "rules", icon: ShieldCheck },
    { key: "twoPerson", icon: UsersRound },
    { key: "billing", icon: Lock },
    { key: "tested", icon: ClipboardCheck },
  ];

  const DATA_POINTS = ["encryption", "backups", "isolation", "audit"];
  const PRIVACY_POINTS = ["email", "links", "roles", "payslips"];

  return (
    <div className="public-grain min-h-screen overflow-x-hidden text-white">
      <SEO {...seoConfig.security} />

      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-zinc-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("common.skipToContent")}
      </a>

      <PublicNav />
      <PublicSectionNav
        pageLabelKey="securityPage.nav.page"
        accent="sky"
        sections={[
          { id: "controls", labelKey: "securityPage.nav.controls" },
          { id: "data", labelKey: "securityPage.nav.data" },
          { id: "privacy", labelKey: "securityPage.nav.privacy" },
        ]}
      />

      <main id="main-content">
        {/* ── hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pb-16 pt-40 sm:pt-44 lg:pb-20 lg:pt-52">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(56,189,248,0.09),transparent_40%)]" />
          <Crescent className="pointer-events-none absolute -right-24 -top-28 hidden h-[520px] w-[520px] text-sky-400/[0.05] md:block" />
          <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3.5 py-2 text-sm text-sky-200">
              <ShieldCheck className="h-4 w-4" />
              {t("securityPage.hero.eyebrow")}
            </div>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              {t("securityPage.hero.title")}
              <span className="mt-1 block bg-gradient-to-r from-sky-200 via-sky-400 to-sky-600 bg-clip-text text-transparent">
                {t("securityPage.hero.titleAccent")}
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              {t("securityPage.hero.description")}
            </p>
          </div>
        </section>

        {/* ── controls ─────────────────────────────────────────── */}
        <section id="controls" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow accent="sky">{t("securityPage.controls.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("securityPage.controls.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("securityPage.controls.description")}</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {CONTROL_CARDS.map(({ key, icon: Icon }) => (
                <article key={key} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/10">
                    <Icon className="h-5 w-5 text-sky-300" />
                  </div>
                  <h3 className="mt-5 font-bold">{t(`securityPage.controls.cards.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {t(`securityPage.controls.cards.${key}.description`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── data ─────────────────────────────────────────────── */}
        <section id="data" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <SectionEyebrow accent="sky">{t("securityPage.data.eyebrow")}</SectionEyebrow>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight">
                  {t("securityPage.data.title")}
                </h2>
                <p className="mt-4 text-zinc-400">{t("securityPage.data.description")}</p>
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.06] p-4">
                  <Database className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
                  <p className="text-sm leading-6 text-zinc-300">{t("securityPage.data.note")}</p>
                </div>
              </div>
              <ul className="space-y-3">
                {DATA_POINTS.map((key) => (
                  <li key={key} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />
                    <div>
                      <h3 className="font-bold">{t(`securityPage.data.points.${key}.title`)}</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">
                        {t(`securityPage.data.points.${key}.description`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── privacy ──────────────────────────────────────────── */}
        <section id="privacy" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow accent="sky">{t("securityPage.privacy.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">
                {t("securityPage.privacy.title")}
              </h2>
              <p className="mt-4 text-zinc-400">{t("securityPage.privacy.description")}</p>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2">
              {PRIVACY_POINTS.map((key) => (
                <article key={key} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                  <Mail className="h-5 w-5 text-sky-300" />
                  <h3 className="mt-4 font-bold">{t(`securityPage.privacy.points.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {t(`securityPage.privacy.points.${key}.description`)}
                  </p>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-10 max-w-3xl text-center text-sm leading-7 text-zinc-500">
              {t("securityPage.privacy.disclosure")}{" "}
              <a href="mailto:info@onit.tl" className="text-sky-300 hover:underline">
                info@onit.tl
              </a>
            </p>
          </div>
        </section>

        {/* ── cta ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-white/[0.06] py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08),transparent_52%)]" />
          <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight">{t("securityPage.cta.title")}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">{t("securityPage.cta.description")}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="h-12 bg-amber-400 px-8 font-bold text-zinc-950 hover:bg-amber-300">
                <Link to={to("/engine")}>
                  {t("securityPage.cta.engine")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
