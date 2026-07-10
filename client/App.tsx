import "./global.css";
import React, { Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FirebaseProvider } from "@/contexts/FirebaseContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GuidanceProvider } from "@/contexts/GuidanceContext";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import ChatWidget from "@/components/chat/ChatWidget";
import AppLayout from "@/components/layout/AppLayout";

// Route definitions
import {
  PageLoader,
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

// Smart home route - shows landing for guests, appropriate dashboard for users
function HomeRoute() {
  const { user, userProfile, loading, authResolved, isSuperAdmin } = useAuth();
  const { session, loading: tenantLoading, tenantResolved, availableTenants, isImpersonating } = useTenant();

  // A cold load / fresh sign-in can have loading=false (cached) while Firebase
  // is still restoring the session — don't decide anything until auth resolves.
  if (loading || tenantLoading || (!user && !authResolved)) {
    return <PageLoader />;
  }

  // Not logged in - show landing page
  if (!user) {
    return <Landing />;
  }

  // While impersonating a tenant, "/" is that tenant's dashboard — not the
  // admin console. This must win over the superadmin → /admin redirects below
  // (a superadmin has no tenants of their own, so hasTenants is false and they
  // would otherwise be bounced to /admin, making impersonation look broken).
  if (isImpersonating && session) {
    return <Dashboard />;
  }

  // User without a user profile - needs to create their organization.
  // Superadmins (token claim, no profile doc) go to the admin dashboard.
  if (user && !userProfile) {
    return <Navigate to={isSuperAdmin ? "/admin" : "/auth/onboarding"} replace />;
  }

  // Check if user has any tenants
  const hasTenants = userProfile?.tenantIds && userProfile.tenantIds.length > 0;

  if (!hasTenants) {
    // Superadmin without tenants goes to admin dashboard
    if (isSuperAdmin) {
      return <Navigate to="/admin" replace />;
    }
    // Regular user without tenants needs to create their organization
    return <Navigate to="/auth/onboarding" replace />;
  }

  // The tenant session can still be resolving even with tenantLoading=false
  // (partial cache, or a fresh signup/sign-in where the membership load hasn't
  // finished yet). Wait for it to resolve rather than bouncing to landing —
  // this is what caused "signed in but got kicked back to the home page".
  if (!session && !tenantResolved) {
    return <PageLoader />;
  }

  if (!session) {
    if (isSuperAdmin) {
      return <Navigate to="/admin" replace />;
    }
    // The profile lists tenants the resolution hasn't seen (fresh signup /
    // onboarding: it resolved before provisioning finished, and the profile
    // change re-triggers the init effect only after this render). Wait for
    // the re-run instead of bouncing a valid user to the marketing page.
    if (availableTenants.length === 0) {
      return <PageLoader />;
    }
    return <Navigate to="/landing" replace />;
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
            <BrowserRouter>
              <ErrorBoundary>
                <FirebaseProvider>
                  <AuthProvider>
                    <TenantProvider>
                      <ChatWidget />
                      <AppLayout>
                        <Suspense fallback={<PageLoader />}>
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
