/**
 * Loading skeleton for the Settings hub.
 *
 * Mirrors the grouped hub layout: page header, two uppercase group headings
 * with their rows, and the collapsed advanced bar. The editor pages keep the
 * older `SettingsSkeleton`, which mirrors a form layout instead.
 */

import MainNavigation from "@/components/layout/MainNavigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/contexts/TenantContext";

function RowSkeleton() {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5">
      <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-44" />
      </div>
    </div>
  );
}

function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <div className="mb-6">
      <Skeleton className="mb-2 h-3 w-24" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function SettingsHubSkeleton() {
  // Mirror the hub's role gate so the skeleton does not promise a row the
  // loaded page will not render.
  const { session } = useTenant();
  const isPeopleAdmin = ["owner", "hr-admin"].includes(session?.role || "");

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <Skeleton className="mt-3 h-0.5 w-full rounded-full" />
        </div>

        <GroupSkeleton rows={3} />
        {isPeopleAdmin && <GroupSkeleton rows={2} />}

        <Skeleton className="mt-2 h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}
