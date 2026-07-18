import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import type { ModulePermission } from "@/types/tenant";
import { PageSkeleton } from "@/components/PageSkeleton";
import { canUseNgoReporting } from "@/lib/ngo/access";

// Lazy: FeatureRoute is in the entry graph and the gate pulls in the page
// chrome (MainNavigation → firestore) — a static import would blow the
// initial-page budget (scripts/check-entry-budget.mjs).
const AccountantGate = React.lazy(() =>
  import("@/components/auth/AccountantGate").then((m) => ({
    default: m.AccountantGate,
  })),
);

interface FeatureRouteProps {
  children: React.ReactNode;
  requiredModule?: ModulePermission;
  requiredAnyModules?: ModulePermission[];
  requiredAllModules?: ModulePermission[];
  requireManage?: boolean;
  requireManager?: boolean;
  requirePeopleManager?: boolean;
  requireHrAdmin?: boolean;
  requireNgoReporting?: boolean;
  /**
   * Accountant-only screen: without showAdvancedTax the user gets a friendly
   * explainer (AccountantGate) pointing back at the everyday module.
   */
  requireAdvancedTax?: false | "money" | "payroll";
  fallbackPath?: string;
}

export function FeatureRoute({
  children,
  requiredModule,
  requiredAnyModules,
  requiredAllModules,
  requireManage = false,
  requireManager = false,
  requirePeopleManager = false,
  requireHrAdmin = false,
  requireNgoReporting = false,
  requireAdvancedTax = false,
  fallbackPath,
}: FeatureRouteProps) {
  const location = useLocation();
  const { user, loading: authLoading, authResolved } = useAuth();
  const {
    session,
    loading: tenantLoading,
    tenantResolved,
    hasModule,
    canManage,
    showAdvancedTax,
  } = useTenant();

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

  if (
    requirePeopleManager &&
    !["owner", "hr-admin", "manager"].includes(session.role)
  ) {
    return <Navigate to={deniedPath} replace />;
  }

  if (requireHrAdmin && !["owner", "hr-admin"].includes(session.role)) {
    return <Navigate to={deniedPath} replace />;
  }

  if (requireNgoReporting && !canUseNgoReporting(session, hasModule("reports"))) {
    return <Navigate to={deniedPath} replace />;
  }

  if (requireAdvancedTax && !showAdvancedTax) {
    return (
      <React.Suspense
        fallback={
          <PageSkeleton type="table" showHeader={false} statCards={0} showNavigation={false} />
        }
      >
        <AccountantGate backTo={requireAdvancedTax} />
      </React.Suspense>
    );
  }

  return <>{children}</>;
}
