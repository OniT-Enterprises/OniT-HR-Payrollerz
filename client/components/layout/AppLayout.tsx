/**
 * AppLayout — Main application layout with sidebar + top bar.
 * Wraps all routes in App.tsx.
 * Skips sidebar for unauthenticated users (login, landing, signup).
 */

import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { LayoutProvider } from "@/contexts/LayoutContext";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";

// Routes that should NOT show the sidebar layout
const PUBLIC_PATHS = ["/auth/", "/landing", "/features", "/unauthorized", "/apply/"];
const ADMIN_PATHS = ["/admin"];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const { session, loading: tenantLoading } = useTenant();
  const location = useLocation();

  const isPublicRoute = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p));
  const isAdminRoute = ADMIN_PATHS.some((p) => location.pathname.startsWith(p));

  // No sidebar while loading, for public/admin pages, or unauthenticated users
  if (authLoading || tenantLoading || !user || !session || isPublicRoute || isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <LayoutProvider>
      <div className="flex h-dvh bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </LayoutProvider>
  );
}
