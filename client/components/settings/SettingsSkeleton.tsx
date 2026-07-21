/**
 * Loading skeleton for the Settings page
 */

import MainNavigation from "@/components/layout/MainNavigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTenant } from "@/contexts/TenantContext";
import { isAccountantPartnerTenant } from "@/lib/accountantPartners";

export function SettingsSkeleton() {
  // Mirror the role gates of the real page: quick links need canManage(),
  // AdvancedTaxModeCard is owner-only, AccountantPartnerCard is
  // owner/hr-admin and hidden for accountant-partner tenants.
  const { session, canManage } = useTenant();
  const showQuickLinks = canManage();
  const showTaxCard = session?.role === "owner";
  const showPartnerCard =
    !!session &&
    ["owner", "hr-admin"].includes(session.role) &&
    !isAccountantPartnerTenant(session.tid);

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0 sm:h-10 sm:w-10" />
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          </div>
          <Skeleton className="mt-3 h-0.5 w-full rounded-full" />
        </div>

        {showQuickLinks && (
          <div className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/50">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 rounded-md border border-border/50 px-3 py-2"
            >
              <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-56" />
                </div>
              </div>
              <Skeleton className="h-9 w-32" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Skeleton className="h-10 w-28" />
            </div>
          </CardContent>
        </Card>

        {showTaxCard && (
          <Card className="mt-6">
            <CardContent className="flex items-start justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3.5 w-72" />
                </div>
              </div>
              <Skeleton className="h-5 w-9 rounded-full shrink-0" />
            </CardContent>
          </Card>
        )}

        {showPartnerCard && (
          <Card className="mt-6 scroll-mt-20">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-lg border bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full max-w-md" />
                    <Skeleton className="h-3 w-2/3 max-w-sm" />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <Skeleton className="h-9 w-20 rounded-md" />
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
