/**
 * Loading skeleton for the Run Payroll page
 * Matches the actual page structure: hero section, period banner,
 * summary cards, tax summary, and employee table
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
        {/* Period Banner Skeleton */}
        <Card className="mb-6 border-2 border-green-200/50 dark:border-green-800/50 animate-fade-up stagger-1">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div>
                  <Skeleton className="h-5 w-24 mb-2 rounded-full" />
                  <Skeleton className="h-7 w-52" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-16 mb-2 ml-auto" />
                <Skeleton className="h-6 w-36" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-up stagger-2">
          {[
            "from-green-500/5 to-emerald-500/5",
            "from-red-500/5 to-rose-500/5",
            "from-emerald-500/5 to-teal-500/5",
            "from-blue-500/5 to-indigo-500/5",
          ].map((gradient, i) => (
            <Card key={i} className="relative overflow-hidden border-border/50">
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
              <CardContent className="relative p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-7 w-28 mt-1" />
                  </div>
                  <Skeleton className="h-11 w-11 rounded-xl" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tax Summary Skeleton */}
        <Card className="mb-6 border-border/50 animate-fade-up stagger-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
            <Skeleton className="h-4 w-72 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 rounded-lg bg-muted/30 border border-border/20">
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Employee Table Skeleton */}
        <Card className="border-border/50 animate-fade-up stagger-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-5 w-36" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-32 rounded-md" />
                <Skeleton className="h-9 w-64 rounded-md" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Table header */}
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
            {/* Table rows */}
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
    </div>
  );
}
