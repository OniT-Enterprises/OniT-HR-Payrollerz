import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageSkeleton } from "@/components/PageSkeleton";

interface SuperadminRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard for superadmin-only pages.
 * Redirects non-superadmins to the app home route.
 *
 * Usage:
 * ```tsx
 * <Route path="/admin/tenants" element={
 *   <SuperadminRoute>
 *     <TenantListPage />
 *   </SuperadminRoute>
 * } />
 * ```
 */
export function SuperadminRoute({ children }: SuperadminRouteProps) {
  const { user, loading, isSuperAdmin } = useAuth();
  const location = useLocation();

  // Show loading skeleton while checking auth
  if (loading) {
    return <PageSkeleton type="table" showHeader={false} statCards={0} />;
  }

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Not a superadmin - redirect to app home
  if (!isSuperAdmin) {
    console.warn(`Unauthorized superadmin access attempt by user ${user.uid}`);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
