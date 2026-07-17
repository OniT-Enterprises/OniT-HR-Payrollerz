import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import type { ModulePermission } from "@/types/tenant";
import { PageSkeleton } from "@/components/PageSkeleton";
import { canUseNgoReporting } from "@/lib/ngo/access";

interface FeatureRouteProps {
  children: React.ReactNode;
  requiredModule?: ModulePermission;
  requiredAnyModules?: ModulePermission[];
  requiredAllModules?: ModulePermission[];
  requireManage?: boolean;
  requireManager?: boolean;
  requireNgoReporting?: boolean;
  fallbackPath?: string;
}

export function FeatureRoute({
  children,
  requiredModule,
  requiredAnyModules,
  requiredAllModules,
  requireManage = false,
  requireManager = false,
  requireNgoReporting = false,
  fallbackPath,
}: FeatureRouteProps) {
  const location = useLocation();
  const { user, loading: authLoading, authResolved } = useAuth();
  const { session, loading: tenantLoading, tenantResolved, hasModule, canManage } = useTenant();

  // Routes that set an explicit fallbackPath keep the old silent redirect;
  // otherwise denied users land on /unauthorized so they know why.
  const deniedPath = fallbackPath ?? "/unauthorized";

  // Wait for the latest auth transition unconditionally. During an account
  // switch `user` can already be non-null while the new profile is unresolved.
  if (authLoading || !authResolved) {
    return <PageSkeleton type="table" showHeader={false} statCards={0} showNavigation={false} />;
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (tenantLoading) {
    return <PageSkeleton type="table" showHeader={false} statCards={0} showNavigation={false} />;
  }

  // Session may still be restoring on a cold deep-link even when loading=false
  // (partial cache). Wait rather than bounce to the fallback.
  if (!session && !tenantResolved) {
    return <PageSkeleton type="table" showHeader={false} statCards={0} showNavigation={false} />;
  }

  if (!session) {
    // No tenant session is a setup problem, not a permission problem
    return <Navigate to={fallbackPath ?? "/dashboard"} replace />;
  }

  if (requiredModule && !hasModule(requiredModule)) {
    return <Navigate to={deniedPath} replace />;
  }

  if (requiredAnyModules?.length && !requiredAnyModules.some((module) => hasModule(module))) {
    return <Navigate to={deniedPath} replace />;
  }

  if (requiredAllModules?.length && requiredAllModules.some((module) => !hasModule(module))) {
    return <Navigate to={deniedPath} replace />;
  }

  if (requireManage && !canManage()) {
    return <Navigate to={deniedPath} replace />;
  }

  if (requireManager && !canManage() && session.role !== "manager") {
    return <Navigate to={deniedPath} replace />;
  }

  if (requireNgoReporting && !canUseNgoReporting(session, hasModule("reports"))) {
    return <Navigate to={deniedPath} replace />;
  }

  return <>{children}</>;
}
