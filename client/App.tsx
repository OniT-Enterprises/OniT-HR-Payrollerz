import "./global.css";
import React, { Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FirebaseProvider } from "@/contexts/FirebaseContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  APP_ORIGIN,
  MARKETING_ORIGIN,
  APP_HOST,
  MARKETING_HOST,
  isAppHost,
  pathBelongsToApp,
  pathBelongsToMarketing,
} from "@/lib/hosts";
import { GuidanceProvider } from "@/contexts/GuidanceContext";
import { I18nProvider, useI18n } from "@/i18n/I18nProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";
import { MarketingRouteFallback } from "@/components/marketing/MarketingRouteFallback";

import ChatWidget from "@/components/chat/ChatWidget";
import AppLayout from "@/components/layout/AppLayout";

// Route definitions
import {
  AccountantPortfolioDashboard,
  Dashboard,
  Landing,
  authRoutes,
  peopleRoutes,
  schedulingRoutes,
  payrollRoutes,
  moneyRoutes,
  accountingRoutes,
  reportsRoutes,
  legacyRedirects,
  adminRoutes,
  notFoundRoute,
} from "./routes";
import { isAccountantPartnerTenant } from "@/lib/accountantPartners";

function SessionRecovery({
  onRetry,
  onUseAnotherAccount,
}: {
  onRetry: () => void | Promise<void>;
  onUseAnotherAccount: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [activeAction, setActiveAction] = React.useState<"retry" | "signout" | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const handleRetry = async () => {
    if (activeAction) return;
    setActionError(null);
    setActiveAction("retry");
    try {
      await onRetry();
    } finally {
      setActiveAction(null);
    }
  };

  const handleUseAnotherAccount = async () => {
    if (activeAction) return;
    setActionError(null);
    setActiveAction("signout");
    try {
      await onUseAnotherAccount();
    } catch {
      setActionError(t("auth.errors.signOutFailed"));
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div
        className="w-full max-w-md rounded-2xl border border-amber-200 bg-card p-5 shadow-sm dark:border-amber-900/60"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold">
              {t("common.accountRecoveryTitle")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("common.accountRecoveryDesc")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={activeAction !== null}
                onClick={() => { void handleRetry(); }}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${activeAction === "retry" ? "animate-spin" : ""}`} />
                {t("common.retry")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={activeAction !== null}
                onClick={() => { void handleUseAnotherAccount(); }}
              >
                {t("auth.onboarding.useAnotherAccount")}
              </Button>
            </div>
            {actionError && (
              <p className="mt-2 text-sm text-destructive">{actionError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Host split: corrects client-side navigations that cross the
 * marketing (xefe.tl) / app (app.xefe.tl) boundary — nginx handles the
 * server-side hits, this handles SPA <Link> navigation. Prod hosts only;
 * dev/localhost and previews are untouched.
 */
function HostGuard() {
  const { pathname, search, hash } = useLocation();
  React.useEffect(() => {
    if (!import.meta.env.PROD || typeof window === "undefined") return;
    const host = window.location.hostname;
    const full = `${pathname}${search}${hash}`;
    if (host === MARKETING_HOST && pathBelongsToApp(pathname)) {
      window.location.replace(`${APP_ORIGIN}${full}`);
    } else if (host === APP_HOST && pathBelongsToMarketing(pathname)) {
      window.location.replace(`${MARKETING_ORIGIN}${full}`);
    }
  }, [pathname, search, hash]);
  return null;
}

// Smart home route - shows landing for guests, appropriate dashboard for users
function HomeRoute() {
  const {
    user,
    userProfile,
    profileStatus,
    profileError,
    loading,
    authResolved,
    isSuperAdmin,
    refreshUserProfile,
    signOut,
  } = useAuth();
  const {
    session,
    availableTenants,
    loading: tenantLoading,
    tenantResolved,
    error: tenantError,
    isImpersonating,
    retryInitialization,
  } = useTenant();

  // Never make a redirect decision until Firebase has resolved the latest auth
  // transition and a profile read has a definite outcome.
  if (loading || !authResolved) {
    return <RouteLoadingFallback />;
  }

  // Not logged in - show landing page (dark marketing skeleton while the
  // chunk loads; the app-style RouteLoadingFallback would flash light here).
  // On the app host the marketing site lives on the apex — send guests there.
  if (!user) {
    if (import.meta.env.PROD && isAppHost()) {
      window.location.replace(MARKETING_ORIGIN);
      return <MarketingRouteFallback />;
    }
    return (
      <Suspense fallback={<MarketingRouteFallback />}>
        <Landing />
      </Suspense>
    );
  }

  if (profileStatus === "idle" || profileStatus === "loading") {
    return <RouteLoadingFallback />;
  }

  const profileReadFailed = profileStatus === "error" || profileError !== null;
  if (profileReadFailed && !isSuperAdmin) {
    return (
      <SessionRecovery
        onRetry={refreshUserProfile}
        onUseAnotherAccount={signOut}
      />
    );
  }

  const hasTenants =
    (userProfile?.tenantIds?.length ?? 0) > 0 ||
    Object.keys(userProfile?.tenantAccess ?? {}).length > 0 ||
    availableTenants.length > 0 ||
    Boolean(session);

  // Membership restoration can discover legacy or claim-based access that is
  // not yet denormalized onto the user profile. Let it finish before deciding
  // that this user needs a new organization.
  if (tenantLoading || (!tenantResolved && !session)) {
    return <RouteLoadingFallback />;
  }

  // A failed membership/claims read is an unknown state, never evidence that
  // the user needs to create a new organization.
  if (!session && tenantError) {
    return (
      <SessionRecovery
        onRetry={retryInitialization}
        onUseAnotherAccount={signOut}
      />
    );
  }

  // Claim/member-based access can legitimately predate the user profile. A
  // missing profile must not bounce an already-restored member into onboarding.
  if (!isSuperAdmin && !hasTenants) {
    return <Navigate to="/auth/onboarding" replace />;
  }

  // While impersonating a tenant, "/" is that tenant's dashboard — not the
  // admin console. This must win over the superadmin → /admin redirects below
  // (a superadmin has no tenants of their own, so hasTenants is false and they
  // would otherwise be bounced to /admin, making impersonation look broken).
  if (isImpersonating && session) {
    return isAccountantPartnerTenant(session.tid)
      ? <AccountantPortfolioDashboard />
      : <Dashboard />;
  }

  // Superadmins may intentionally have no profile or tenant of their own.
  if (profileReadFailed || profileStatus === "missing" || !hasTenants) {
    if (isSuperAdmin) {
      return <Navigate to="/admin" replace />;
    }
  }

  // The tenant session can still be resolving even with tenantLoading=false
  // (partial cache, or a fresh signup/sign-in where the membership load hasn't
  // finished yet). Wait for it to resolve rather than bouncing to landing —
  // this is what caused "signed in but got kicked back to the home page".
  if (!session && !tenantResolved) {
    return <RouteLoadingFallback />;
  }

  if (!session) {
    if (isSuperAdmin) {
      return <Navigate to="/admin" replace />;
    }
    return (
      <SessionRecovery
        onRetry={retryInitialization}
        onUseAnotherAccount={signOut}
      />
    );
  }

  if (isAccountantPartnerTenant(session.tid)) {
    return <AccountantPortfolioDashboard />;
  }

  // User with tenants - show regular dashboard
  return <Dashboard />;
}

const App = ({ queryClient }: { queryClient: QueryClient }) => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <GuidanceProvider>
            <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true }}>
              <HostGuard />
              <ErrorBoundary>
                <FirebaseProvider>
                  <AuthProvider>
                    <TenantProvider>
                      <ChatWidget />
                      <AppLayout>
                        <Suspense fallback={<RouteLoadingFallback />}>
                          <Routes>
                            <Route path="/" element={<HomeRoute />} />
                            {authRoutes}
                            {peopleRoutes}
                            {schedulingRoutes}
                            {payrollRoutes}
                            {moneyRoutes}
                            {accountingRoutes}
                            {reportsRoutes}
                            {legacyRedirects}
                            {adminRoutes}
                            {notFoundRoute}
                          </Routes>
                        </Suspense>
                      </AppLayout>
                    </TenantProvider>
                  </AuthProvider>
                </FirebaseProvider>
              </ErrorBoundary>
            </BrowserRouter>
            </TooltipProvider>
          </GuidanceProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
