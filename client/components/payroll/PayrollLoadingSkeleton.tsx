/**
 * Loading skeleton for the Run Payroll Wizard
 * Matches: compact hero + step indicator + step content card
 */

import MainNavigation from "@/components/layout/MainNavigation";
import ModuleSectionNav from "@/components/ModuleSectionNav";
import { payrollNavConfig } from "@/lib/moduleNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function PayrollLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <ModuleSectionNav config={payrollNavConfig} />

      {/* Compact Hero */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="mx-auto max-w-screen-2xl px-6 py-5">
          <Skeleton className="h-3 w-36 mb-2" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div>
              <Skeleton className="h-7 w-36 mb-1.5" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </div>
      </div>

      {/* Wizard Content */}
      <div className="mx-auto max-w-screen-2xl px-6 py-6 space-y-6">
        {/* Step Indicator */}
        <div className="relative flex justify-between">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 bg-background px-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>

        {/* Step Content Card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Frequency cards placeholder */}
            <div>
              <Skeleton className="h-5 w-28 mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl" />
                ))}
              </div>
            </div>

            {/* Date pickers placeholder */}
            <div>
              <Skeleton className="h-5 w-40 mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/* Navigation bar */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-20 rounded-md" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-20 rounded-md" />
            <Skeleton className="h-10 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
