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
  requireNgoReporting?: boolean;
  fallbackPath?: string;
}

export function FeatureRoute({
  children,
  requiredModule,
  requiredAnyModules,
  requiredAllModules,
  requireManage = false,
  requireNgoReporting = false,
  fallbackPath,
}: FeatureRouteProps) {
  const location = useLocation();
  const { user, loading: authLoading, authResolved } = useAuth();
  const { session, loading: tenantLoading, tenantResolved, hasModule, canManage } = useTenant();

  // Routes that set an explicit fallbackPath keep the old silent redirect;
  // otherwise denied users land on /unauthorized so they know why.
  const deniedPath = fallbackPath ?? "/unauthorized";

  // A cold page load can have loading=false (cached profile) while Firebase is
  // still restoring the session — don't bounce to login until auth resolves.
  if (authLoading || tenantLoading || (!user && !authResolved)) {
    return <PageSkeleton type="table" showHeader={false} statCards={0} showNavigation={false} />;
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
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

  if (requireNgoReporting && !canUseNgoReporting(session, hasModule("reports"))) {
    return <Navigate to={deniedPath} replace />;
  }

  return <>{children}</>;
}
