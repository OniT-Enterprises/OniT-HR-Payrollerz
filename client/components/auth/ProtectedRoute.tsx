import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { PageSkeleton } from "@/components/PageSkeleton";
import { ModulePermission, TenantRole, hasModulePermission } from "@/types/tenant";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Require authentication (default: true) */
  requireAuth?: boolean;
  /** Require tenant membership (default: true) */
  requireTenant?: boolean;
  /** Require specific module permission */
  requiredModule?: ModulePermission;
  /** Require one of these roles */
  requiredRoles?: TenantRole[];
}

/**
 * Route guard component that protects routes based on auth and permissions.
 *
 * Usage:
 * ```tsx
 * <Route path="/staff" element={
 *   <ProtectedRoute requiredModule="staff">
 *     <StaffPage />
 *   </ProtectedRoute>
 * } />
 * ```
 */
export function ProtectedRoute({
  children,
  requireAuth = true,
  requireTenant = true,
  requiredModule,
  requiredRoles,
}: ProtectedRouteProps) {
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const { session, loading: tenantLoading } = useTenant();
  const location = useLocation();

  // Show loading skeleton while checking auth/tenant
  if (authLoading || (requireTenant && tenantLoading)) {
    return <PageSkeleton type="table" showHeader={false} statCards={0} />;
  }

  // Not authenticated - redirect to login
  if (requireAuth && !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Superadmins bypass tenant and permission checks when impersonating
  // (they'll have a session set by impersonation)
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // No tenant session - redirect to tenant selection or setup
  if (requireTenant && !session) {
    return <Navigate to="/no-tenant" replace />;
  }

  // Check module permission
  if (requiredModule && session) {
    if (!hasModulePermission(session.role, session.modules, requiredModule)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check role requirements
  if (requiredRoles && session) {
    if (!requiredRoles.includes(session.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
