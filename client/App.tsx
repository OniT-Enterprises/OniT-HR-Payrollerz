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
  const { user, userProfile, loading, isSuperAdmin } = useAuth();
  const { session, loading: tenantLoading } = useTenant();

  if (loading || tenantLoading) {
    return <PageLoader />;
  }

  // Not logged in - show landing page
  if (!user) {
    return <Landing />;
  }

  // User without a user profile - needs to complete setup
  if (user && !userProfile) {
    return <Navigate to="/admin/setup" replace />;
  }

  // Check if user has any tenants
  const hasTenants = userProfile?.tenantIds && userProfile.tenantIds.length > 0;

  if (!hasTenants) {
    // Superadmin without tenants goes to admin dashboard
    if (isSuperAdmin) {
      return <Navigate to="/admin/tenants" replace />;
    }
    // Regular user without tenants needs setup
    return <Navigate to="/admin/setup" replace />;
  }

  if (!session) {
    if (isSuperAdmin) {
      return <Navigate to="/admin/tenants" replace />;
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
