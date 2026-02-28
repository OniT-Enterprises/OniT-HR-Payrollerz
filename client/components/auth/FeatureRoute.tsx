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
  fallbackPath = "/dashboard",
}: FeatureRouteProps) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { session, loading: tenantLoading, hasModule, canManage } = useTenant();

  if (authLoading || tenantLoading) {
    return <PageSkeleton type="table" showHeader={false} statCards={0} />;
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (!session) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (requiredModule && !hasModule(requiredModule)) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (requiredAnyModules?.length && !requiredAnyModules.some((module) => hasModule(module))) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (requiredAllModules?.length && requiredAllModules.some((module) => !hasModule(module))) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (requireManage && !canManage()) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (requireNgoReporting && !canUseNgoReporting(session, hasModule("reports"))) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
