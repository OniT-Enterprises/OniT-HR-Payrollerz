/**
 * PageHeader — Slim page header rendered at the top of the content area.
 * One compact row: icon + title + optional subtitle on the left, action
 * buttons on the right. The business name (not the page title) lives in the
 * top bar; every page's title sits here, on the same row as its primary action.
 */

import React from "react";
import type { ComponentType } from "react";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle or date string below the title */
  subtitle?: React.ReactNode;
  /** Optional icon shown before the title */
  icon?: ComponentType<{ className?: string }>;
  /** Icon color class (e.g. "text-cyan-500") */
  iconColor?: string;
  /** Action buttons rendered on the right */
  actions?: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-muted-foreground",
  actions,
  className = "",
}: PageHeaderProps) {
  // Derive accent border color from iconColor (e.g. "text-blue-500" -> "border-blue-500")
  const accentBorder = iconColor.replace("text-", "border-");

  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <div className="shrink-0 rounded-lg bg-muted p-1.5">
              <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 animate-in fade-in slide-in-from-right-8 duration-500">
            {actions}
          </div>
        )}
      </div>
      <div className={`mt-3 h-0.5 rounded-full border-b-2 ${accentBorder} opacity-40`} />
    </div>
  );
}
