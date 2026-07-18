/**
 * Loading skeleton for the Run Payroll Wizard
 * Matches: page header + step indicator (mobile bar / desktop stepper) +
 * step content card + sticky footer nav, as rendered by StepWizard once loaded.
 */

import MainNavigation from "@/components/layout/MainNavigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function PayrollLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        {/* Page Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10" />
            <div className="min-w-0">
              <Skeleton className="mb-1.5 h-5 w-40" />
              <Skeleton className="h-3.5 w-56" />
            </div>
          </div>
          <Skeleton className="mt-3 h-0.5 w-full rounded-full opacity-40" />
        </div>

        <div className="space-y-6">
          {/* Mobile compact step bar */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 sm:hidden">
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          </div>

          {/* Desktop Step Indicator */}
          <div className="relative hidden sm:block">
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-muted" />
            <div className="relative flex justify-between">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2 bg-background px-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>

          {/* Step Content Card */}
          <Card>
            <CardHeader className="hidden sm:block">
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="min-h-[420px] space-y-8">
              {/* Frequency cards placeholder */}
              <div>
                <Skeleton className="mb-4 h-5 w-28" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                  ))}
                </div>
              </div>

              {/* Date pickers placeholder */}
              <div>
                <Skeleton className="mb-4 h-5 w-40" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-11 w-full rounded-md" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Subsidio toggle placeholder */}
              <Skeleton className="h-16 rounded-2xl" />
            </CardContent>
          </Card>

          {/* Sticky Footer Nav */}
          <div className="sticky bottom-0 z-30 -mx-4 -mb-6 mt-6 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-20 rounded-md" />
              <div className="flex items-center gap-2 sm:gap-3">
                <Skeleton className="h-10 w-20 rounded-md" />
                <Skeleton className="h-10 w-24 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
