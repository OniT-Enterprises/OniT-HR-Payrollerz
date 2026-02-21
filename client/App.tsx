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
import { TenantProvider } from "@/contexts/TenantContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import ChatWidget from "@/components/chat/ChatWidget";

// Route definitions
import {
  PageLoader,
  Dashboard,
  Landing,
  authRoutes,
  peopleRoutes,
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

  if (loading) {
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

  // User with tenants - show regular dashboard
  return <Dashboard />;
}

const App = ({ queryClient }: { queryClient: QueryClient }) => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ErrorBoundary>
                <FirebaseProvider>
                  <AuthProvider>
                    <TenantProvider>
                      <ChatWidget />
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          {/* Home route */}
                          <Route path="/" element={<HomeRoute />} />

                          {/* Auth & Core */}
                          {authRoutes}

                          {/* People Module (Staff, Hiring, Time, Performance) */}
                          {peopleRoutes}

                          {/* Payroll Module */}
                          {payrollRoutes}

                          {/* Money Module (Invoicing) */}
                          {moneyRoutes}

                          {/* Accounting Module */}
                          {accountingRoutes}

                          {/* Reports Module */}
                          {reportsRoutes}

                          {/* Legacy Redirects */}
                          {legacyRedirects}

                          {/* Admin Routes */}
                          {adminRoutes}

                          {/* Catch-all 404 */}
                          {notFoundRoute}
                        </Routes>
                      </Suspense>
                    </TenantProvider>
                  </AuthProvider>
                </FirebaseProvider>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
