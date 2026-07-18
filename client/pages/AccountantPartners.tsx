import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Languages,
  Loader2,
  Lock,
  MapPin,
  ReceiptText,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicSectionNav } from "@/components/marketing/PublicSectionNav";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import {
  PRIMOS_BOOT_PARTNER,
  isAccountantPartnerTenant,
  rememberAccountantPartner,
} from "@/lib/accountantPartners";
import { accountantPartnerService } from "@/services/accountantPartnerService";

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
    <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.25em] text-sky-300">
      <Crescent className="h-3.5 w-3.5 text-sky-400" />
      {children}
    </p>
  );
}

export default function AccountantPartners() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { session, refreshSession } = useTenant();
  const { t } = useI18n();
  const partner = PRIMOS_BOOT_PARTNER;
  const existingConnection =
    session?.config.accountantPartner?.partnerId === partner.id
      ? session.config.accountantPartner
      : null;
  const [status, setStatus] = useState(existingConnection?.status ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRequest = session?.role === "owner" || session?.role === "hr-admin";
  const isPartnerWorkspace = isAccountantPartnerTenant(session?.tid);
  const activeStatus = status === "requested" || status === "accepted" || status === "connected";

  const handleChoose = async () => {
    setError(null);
    if (isPartnerWorkspace) {
      navigate("/accountant/clients");
      return;
    }
    rememberAccountantPartner(partner.id);

    if (!user) {
      navigate(`/auth/signup?accountant=${partner.id}`);
      return;
    }
    if (!session) {
      navigate(`/auth/onboarding?accountant=${partner.id}`);
      return;
    }
    if (!canRequest) {
      setError(t("accountantPartners.selection.ownerOnly"));
      return;
    }
    if (!partner.connectionsOpen) {
      setError(t("accountantPartners.connection.prelaunchNote"));
      return;
    }

    setBusy(true);
    try {
      const result = await accountantPartnerService.requestConnection(
        session.tid,
        partner.id,
      );
      setStatus(result.status);
      await refreshSession();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("accountantPartners.selection.failed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const actionLabel = isPartnerWorkspace
    ? t("accountantPartners.selection.openPortfolio")
    : status === "requested"
    ? t("accountantPartners.selection.requested")
    : status === "accepted"
      ? t("accountantPartners.selection.accepted")
      : status === "connected"
        ? t("accountantPartners.selection.connected")
        : partner.connectionsOpen
          ? t("accountantPartners.selection.choose")
          : t("accountantPartners.connection.prelaunchAction");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0b] text-white">
      <SEO {...seoConfig.accountantPartners} />

      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-zinc-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("common.skipToContent")}
      </a>

      <PublicNav />
      <PublicSectionNav
        pageLabelKey="landing.nav.forAccountants"
        accent="sky"
        sections={[
          { id: "partner", labelKey: "accountantPartners.nav.partner" },
          { id: "process", labelKey: "accountantPartners.nav.process" },
          { id: "access", labelKey: "accountantPartners.nav.access" },
        ]}
      />

      <main id="main-content">
        <section className="relative overflow-hidden pb-20 pt-40 sm:pb-24 sm:pt-44 lg:pb-28 lg:pt-52">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(56,189,248,0.10),transparent_38%),radial-gradient(circle_at_15%_78%,rgba(110,142,44,0.08),transparent_34%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:px-8">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3.5 py-2 text-sm text-sky-200">
                <UserCheck className="h-4 w-4" />
                {t("accountantPartners.hero.eyebrow")}
              </div>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.8rem]">
                {t("accountantPartners.hero.title")}
                <span className="mt-1 block bg-gradient-to-r from-sky-200 via-sky-400 to-lime-300 bg-clip-text text-transparent">
                  {t("accountantPartners.hero.titleAccent")}
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400 lg:text-xl">
                {t("accountantPartners.hero.description")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  onClick={() => document.getElementById("partner")?.scrollIntoView()}
                  className="h-12 bg-amber-400 px-7 text-base font-bold text-zinc-950 hover:bg-amber-300"
                >
                  {t("accountantPartners.hero.primary")}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 border-white/10 bg-white/5 px-7 text-white hover:bg-white/10 hover:text-white">
                  <Link to="/how-it-works">
                    {t("accountantPartners.hero.secondary")}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-400">
                {["consent", "revoke", "agreement"].map((key) => (
                  <span key={key} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-lime-400" />
                    {t(`accountantPartners.hero.trust.${key}`)}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/85 p-6 shadow-2xl shadow-black/50 sm:p-8">
              {/* Partner identity withheld until the agreement is signed —
                  generic mark only (see client/lib/accountantPartners.ts). */}
              <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-9">
                <Building2 className="h-9 w-9 text-sky-300" />
                <span className="text-lg font-bold text-white">{partner.name}</span>
              </div>
              <div className="mt-6 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-lime-400" />{t("accountantPartners.partner.dili")}</div>
                <div className="flex items-center gap-2"><Languages className="h-4 w-4 text-lime-400" />{t("accountantPartners.partner.languages")}</div>
                <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-lime-400" />{t("accountantPartners.partner.since")}</div>
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-lime-400" />{t("accountantPartners.partner.accountingAudit")}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="partner" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("accountantPartners.partner.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">{t("accountantPartners.partner.title")}</h2>
              <p className="mt-4 text-zinc-400">{t("accountantPartners.partner.description")}</p>
            </div>

            <article className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
              <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
                <div className="flex flex-col justify-between border-b border-white/[0.07] bg-[#11120f] p-6 sm:p-8 lg:border-b-0 lg:border-r">
                  <div>
                    <span className="inline-flex rounded-full bg-lime-400 px-3 py-1 text-xs font-bold text-zinc-950">
                      {t("accountantPartners.partner.preferred")}
                    </span>
                    <div className="mt-6 flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-8">
                      <Building2 className="h-8 w-8 text-sky-300" />
                      <span className="text-base font-bold text-white">{partner.name}</span>
                    </div>
                    <p className="mt-6 text-sm leading-6 text-zinc-400">{t("accountantPartners.partner.profile")}</p>
                  </div>
                  <p className="mt-6 text-sm font-medium text-zinc-500">
                    {t("accountantPartners.partner.website")}
                  </p>
                </div>

                <div className="p-6 sm:p-8">
                  <h3 className="text-xl font-bold">{t("accountantPartners.partner.servicesTitle")}</h3>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {["bookkeeping", "payroll", "tax", "statements", "audit", "advisory"].map((service) => (
                      <li key={service} className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-lime-400" />
                        {t(`accountantPartners.partner.services.${service}`)}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4 text-sm leading-6 text-zinc-300">
                    <span className="font-bold text-amber-200">{t("accountantPartners.partner.beforeAccessTitle")}</span>{" "}
                    {t("accountantPartners.partner.beforeAccessDescription")}
                  </div>

                  {!partner.connectionsOpen && (
                    <div className="mt-4 rounded-xl border border-blue-400/15 bg-blue-400/[0.06] p-4 text-sm leading-6 text-zinc-300">
                      {t("accountantPartners.connection.prelaunchNote")}
                    </div>
                  )}

                  {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Button
                      size="lg"
                      onClick={() => void handleChoose()}
                      disabled={busy || (activeStatus && !isPartnerWorkspace)}
                      className="h-12 flex-1 bg-amber-400 font-bold text-zinc-950 hover:bg-amber-300"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {actionLabel}
                      {!busy && !activeStatus && <ArrowRight className="h-4 w-4" />}
                    </Button>
                    {user && session && activeStatus && (
                      <Button size="lg" variant="outline" asChild className="h-12 flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                        <Link to="/settings#accountant-partner">{t("accountantPartners.selection.manage")}</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="process" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t("accountantPartners.process.eyebrow")}</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-[2.6rem]">{t("accountantPartners.process.title")}</h2>
              <p className="mt-4 text-zinc-400">{t("accountantPartners.process.description")}</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                { key: "choose", icon: UserCheck },
                { key: "agree", icon: ClipboardCheck },
                { key: "review", icon: BookOpen },
              ].map(({ key, icon: Icon }, index) => (
                <article key={key} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10">
                      <Icon className="h-5 w-5 text-amber-300" />
                    </div>
                    <span className="font-mono text-sm text-zinc-700">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 font-bold">{t(`accountantPartners.process.steps.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{t(`accountantPartners.process.steps.${key}.description`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="access" className="scroll-mt-32 border-t border-white/[0.06] py-20 lg:py-24">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <SectionEyebrow>{t("accountantPartners.access.eyebrow")}</SectionEyebrow>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight">{t("accountantPartners.access.title")}</h2>
                <p className="mt-4 text-zinc-400">{t("accountantPartners.access.description")}</p>
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-400/15 bg-blue-400/[0.06] p-4">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
                  <p className="text-sm leading-6 text-zinc-300">{t("accountantPartners.access.consentNote")}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-2xl border border-lime-400/15 bg-lime-400/[0.05] p-6">
                  <h3 className="font-bold text-lime-200">{t("accountantPartners.access.canTitle")}</h3>
                  <ul className="mt-4 space-y-3">
                    {["payroll", "money", "reports", "review"].map((key) => (
                      <li key={key} className="flex gap-2 text-sm leading-6 text-zinc-300"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-lime-400" />{t(`accountantPartners.access.can.${key}`)}</li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6">
                  <h3 className="font-bold">{t("accountantPartners.access.cannotTitle")}</h3>
                  <ul className="mt-4 space-y-3">
                    {["users", "employees", "billing", "integrations"].map((key) => (
                      <li key={key} className="flex gap-2 text-sm leading-6 text-zinc-400"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-zinc-500" />{t(`accountantPartners.access.cannot.${key}`)}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/[0.06] py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(110,142,44,0.10),transparent_50%)]" />
          <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-6">
            <ReceiptText className="mx-auto h-8 w-8 text-lime-400" />
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight">{t("accountantPartners.cta.title")}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">{t("accountantPartners.cta.description")}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => void handleChoose()} disabled={busy || (activeStatus && !isPartnerWorkspace)} className="h-12 bg-amber-400 px-8 font-bold text-zinc-950 hover:bg-amber-300">
                {actionLabel}<ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
