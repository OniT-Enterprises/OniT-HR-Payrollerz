import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  UserCheck,
  XCircle,
} from "lucide-react";
import MainNavigation from "@/components/layout/MainNavigation";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { PRIMOS_BOOT_PARTNER } from "@/lib/accountantPartners";
import {
  accountantPartnerService,
  type AccountantPartnerPortfolioItem,
} from "@/services/accountantPartnerService";

const portfolioKey = ["accountant-partner-portfolio", PRIMOS_BOOT_PARTNER.id] as const;

export default function AccountantPortfolioDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperAdmin, refreshUserProfile, user } = useAuth();
  const {
    session,
    isImpersonating,
    startImpersonation,
    switchTenant,
    refreshTenants,
  } = useTenant();
  const { t, locale } = useI18n();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const portfolioQuery = useQuery({
    queryKey: portfolioKey,
    queryFn: () => accountantPartnerService.getPortfolio(PRIMOS_BOOT_PARTNER.id),
    enabled: session?.tid === PRIMOS_BOOT_PARTNER.tenantId,
  });

  if (session?.tid !== PRIMOS_BOOT_PARTNER.tenantId) {
    return <Navigate to="/" replace />;
  }

  const items = portfolioQuery.data?.items ?? [];
  const requested = items.filter((item) => item.status === "requested");
  const awaitingAccess = items.filter((item) => item.status === "accepted");
  const connected = items.filter((item) => item.status === "connected");

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: portfolioKey });
  };

  const respond = async (
    item: AccountantPartnerPortfolioItem,
    decision: "accept" | "decline",
  ) => {
    setWorkingId(item.requestId);
    setError(null);
    try {
      await accountantPartnerService.respondToRequest(item.requestId, decision);
      await refresh();
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : t("accountantPortfolio.errors.respond"));
    } finally {
      setWorkingId(null);
    }
  };

  const openClient = async (item: AccountantPartnerPortfolioItem) => {
    setWorkingId(item.requestId);
    setError(null);
    try {
      if (isSuperAdmin) {
        await startImpersonation(item.tenantId, item.tenantName);
      } else {
        await accountantPartnerService.activateClientAccess(item.requestId);
        await user?.getIdToken(true);
        await refreshUserProfile();
        await refreshTenants();
        await switchTenant(item.tenantId);
      }
      navigate("/");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : t("accountantPortfolio.errors.open"));
    } finally {
      setWorkingId(null);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : locale === "tet" ? "pt-TL" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Dili",
      }).format(date);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.accountantPortfolio} />
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-4 py-5 pb-10 sm:px-6 sm:py-6">
        <div className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-muted">
                <Building2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">{t("accountantPortfolio.title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("accountantPortfolio.subtitle")}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void refresh()} disabled={portfolioQuery.isFetching}>
              <RefreshCw className={`h-4 w-4 ${portfolioQuery.isFetching ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
          </div>
          {isSuperAdmin && isImpersonating && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {t("accountantPortfolio.impersonationNote")}
            </p>
          )}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          {[
            { value: requested.length, label: t("accountantPortfolio.cards.requests"), icon: UserCheck },
            { value: connected.length, label: t("accountantPortfolio.cards.connected"), icon: CheckCircle2 },
          ].map(({ value, label, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</p>}

        {portfolioQuery.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : portfolioQuery.isError ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("accountantPortfolio.errors.load")}</p>
            <Button className="mt-4" variant="outline" onClick={() => void portfolioQuery.refetch()}>{t("common.retry")}</Button>
          </div>
        ) : (
          <div className="space-y-7">
            <section>
              <h2 className="mb-3 text-sm font-semibold">{t("accountantPortfolio.needsAttention")}</h2>
              <div className="space-y-2">
                {requested.map((item) => (
                  <article key={item.requestId} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10"><Building2 className="h-5 w-5 text-amber-600" /></div>
                        <div className="min-w-0">
                          <h3 className="font-medium">{item.tenantName}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{item.requesterName || item.requesterEmail || t("accountantPortfolio.requesterUnknown")} · {formatDate(item.requestedAt)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{t("accountantPortfolio.responseNotice")}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => void respond(item, "decline")} disabled={workingId === item.requestId}><XCircle className="h-4 w-4" />{t("accountantPortfolio.actions.decline")}</Button>
                        <Button onClick={() => void respond(item, "accept")} disabled={workingId === item.requestId}>{workingId === item.requestId && <Loader2 className="h-4 w-4 animate-spin" />}{t("accountantPortfolio.actions.accept")}</Button>
                      </div>
                    </div>
                  </article>
                ))}
                {requested.length === 0 && (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5 text-emerald-600" />{t("accountantPortfolio.noRequests")}</div>
                )}
              </div>
            </section>

            {awaitingAccess.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold">{t("accountantPortfolio.awaitingTitle")}</h2>
                <div className="space-y-2">
                  {awaitingAccess.map((item) => (
                    <article key={item.requestId} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                      <Clock3 className="h-5 w-5 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1"><h3 className="font-medium">{item.tenantName}</h3><p className="text-xs text-muted-foreground">{t("accountantPortfolio.awaitingDescription")}</p></div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold">{t("accountantPortfolio.clientsTitle")}</h2>
              <div className="space-y-2">
                {connected.map((item) => (
                  <button key={item.requestId} onClick={() => void openClient(item)} disabled={workingId === item.requestId} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Building2 className="h-5 w-5 text-primary" /></div>
                    <div className="min-w-0 flex-1"><h3 className="font-medium">{item.tenantName}</h3><p className="text-xs text-muted-foreground">{t("accountantPortfolio.connectedDescription")}</p></div>
                    {workingId === item.requestId ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                ))}
                {connected.length === 0 && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("accountantPortfolio.noClients")}</div>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
