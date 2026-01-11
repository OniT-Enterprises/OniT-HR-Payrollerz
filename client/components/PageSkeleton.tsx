import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MainNavigation from "@/components/layout/MainNavigation";

interface PageSkeletonProps {
  type?: "table" | "form" | "dashboard" | "list";
  statCards?: number;
  tableRows?: number;
  showHeader?: boolean;
}

export function PageSkeleton({
  type = "table",
  statCards = 4,
  tableRows = 8,
  showHeader = true,
}: PageSkeletonProps) {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          {showHeader && (
            <div className="flex items-center justify-between mb-6">
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-5 w-72" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          )}

          {/* Stat Cards */}
          {statCards > 0 && (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(statCards, 4)} gap-4 mb-6`}>
              {Array.from({ length: statCards }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-5 w-5 rounded" />
                    </div>
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Main Content based on type */}
          {type === "table" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-10 w-64" />
                </div>
              </CardHeader>
              <CardContent>
                {/* Table Header */}
                <div className="border-b pb-3 mb-3">
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                {/* Table Rows */}
                <div className="space-y-3">
                  {Array.from({ length: tableRows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div>
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <div className="flex gap-2 ml-auto">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {type === "form" && (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 pt-4">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-24" />
                </div>
              </CardContent>
            </Card>
          )}

          {type === "list" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: tableRows }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {type === "dashboard" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <Skeleton className="h-6 w-36 mb-2" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j}>
                        <div className="flex justify-between mb-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TablePageSkeleton({ rows = 10 }: { rows?: number }) {
  return <PageSkeleton type="table" tableRows={rows} />;
}

export function FormPageSkeleton() {
  return <PageSkeleton type="form" statCards={0} />;
}

export function ListPageSkeleton({ items = 6 }: { items?: number }) {
  return <PageSkeleton type="list" statCards={0} tableRows={items} />;
}
