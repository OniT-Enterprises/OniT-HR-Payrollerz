/**
 * AppLayout — Main application layout with sidebar + top bar.
 * Wraps all routes in App.tsx.
 * Skips sidebar for unauthenticated users (login, landing, signup).
 */

import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { LayoutProvider } from "@/contexts/LayoutContext";
import AppSidebar from "./AppSidebar";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { useI18n } from "@/i18n/I18nProvider";

// TopBar owns setup/notification data queries. Do not load that Firestore
// surface for landing and authentication pages that never render app chrome.
const TopBar = React.lazy(() => import("./TopBar"));

// Routes that should NOT show the sidebar layout
const PUBLIC_PATHS = [
  "/auth/",
  "/landing",
  "/how-it-works",
  "/features",
  "/unauthorized",
  "/apply/",
  "/i/",
  "/privacy",
  "/terms",
];
const ADMIN_PATHS = ["/admin"];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const { session, loading: tenantLoading, isImpersonating } = useTenant();
  const location = useLocation();
  const { t } = useI18n();
  const mainRef = useRef<HTMLElement>(null);

  // The authenticated shell scrolls inside <main>, not the window. Reset that
  // container when the page changes so a new screen never opens halfway down.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  const isPublicRoute = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p));
  const isTenantDocumentAlerts = location.pathname.startsWith(
    "/admin/document-alerts"
  );
  const isAdminRoute =
    !isTenantDocumentAlerts &&
    ADMIN_PATHS.some((p) => location.pathname.startsWith(p));

  // No sidebar while loading, for public/admin pages, or unauthenticated users
  if (authLoading || tenantLoading || !user || !session || isPublicRoute || isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <LayoutProvider>
      <div className="flex h-dvh bg-background">
        <a
          href="#main-content"
          className="sr-only z-[60] rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          {t("common.skipToContent")}
        </a>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {isImpersonating && <ImpersonationBanner />}
          <React.Suspense fallback={<div className="h-14 shrink-0 border-b border-border/70 bg-card" />}>
            <TopBar />
          </React.Suspense>
          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 overflow-y-auto outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </LayoutProvider>
  );
}
