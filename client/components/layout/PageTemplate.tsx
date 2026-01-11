/**
 * PageTemplate - Consistent page layout wrapper
 * Provides navigation, breadcrumbs, header, and content structure
 */

import React from "react";
import MainNavigation from "./MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PageAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

interface PageTemplateProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Icon to show next to title */
  icon?: LucideIcon;
  /** Icon color class (e.g., "text-blue-500") */
  iconColor?: string;
  /** Primary action button */
  primaryAction?: PageAction;
  /** Secondary actions */
  secondaryActions?: PageAction[];
  /** Stats cards to show below header */
  stats?: React.ReactNode;
  /** Show loading skeleton */
  loading?: boolean;
  /** Main content */
  children: React.ReactNode;
  /** Max width of content (default: 7xl) */
  maxWidth?: "4xl" | "5xl" | "6xl" | "7xl" | "full";
  /** Hide breadcrumbs */
  hideBreadcrumbs?: boolean;
  /** Additional className for content wrapper */
  className?: string;
}

const maxWidthClasses = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  "full": "max-w-full",
};

export function PageTemplate({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  primaryAction,
  secondaryActions,
  stats,
  loading = false,
  children,
  maxWidth = "7xl",
  hideBreadcrumbs = false,
  className,
}: PageTemplateProps) {
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className={cn("p-6 mx-auto", maxWidthClasses[maxWidth])}>
          <Skeleton className="h-5 w-48 mb-6" />
          <div className="flex items-center justify-between mb-8">
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          {stats && (
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          )}
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />

      <div className={cn("p-6 mx-auto", maxWidthClasses[maxWidth], className)}>
        {/* Breadcrumbs */}
        {!hideBreadcrumbs && <AutoBreadcrumb className="mb-6" />}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {Icon && <Icon className={cn("h-8 w-8", iconColor)} />}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {secondaryActions?.map((action, idx) => {
              const ActionIcon = action.icon;
              return (
                <Button
                  key={idx}
                  variant={action.variant || "outline"}
                  onClick={action.onClick}
                >
                  {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
                  {action.label}
                </Button>
              );
            })}
            {primaryAction && (
              <Button onClick={primaryAction.onClick}>
                {primaryAction.icon && (
                  <primaryAction.icon className="h-4 w-4 mr-2" />
                )}
                {primaryAction.label}
              </Button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        {stats && <div className="mb-8">{stats}</div>}

        {/* Main Content */}
        {children}
      </div>
    </div>
  );
}

export default PageTemplate;
