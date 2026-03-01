/**
 * Loading skeleton for the Run Payroll page
 * Matches the 2-column layout: employee table (left) + config sidebar (right)
 */

import MainNavigation from "@/components/layout/MainNavigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function PayrollLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      {/* Hero Section Skeleton */}
      <div className="border-b bg-green-50 dark:bg-green-950/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-4 w-48 mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div>
                <Skeleton className="h-8 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-md" />
              <Skeleton className="h-10 w-28 rounded-md" />
              <Skeleton className="h-10 w-40 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Employee Table */}
          <div className="lg:col-span-2">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-lg" />
                    <Skeleton className="h-5 w-36" />
                  </div>
                  <Skeleton className="h-9 w-64 rounded-md" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 pb-3 border-b border-border/50 mb-3 bg-muted/30 rounded-t px-2 py-2">
                  <Skeleton className="h-3 w-6" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-10 ml-auto" />
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/20 last:border-0 px-2">
                      <Skeleton className="h-4 w-4" />
                      <div className="flex items-center gap-3 w-44">
                        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                        <div>
                          <Skeleton className="h-4 w-24 mb-1" />
                          <Skeleton className="h-3 w-14" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-16 rounded ml-auto" />
                      <Skeleton className="h-8 w-14 rounded" />
                      <Skeleton className="h-8 w-14 rounded" />
                      <Skeleton className="h-8 w-20 rounded" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-4">
            {/* Period Config Skeleton */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-9 w-full rounded-md" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Summary Skeleton */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tax Skeleton */}
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
