/**
 * PageHeader — Slim page header replacing the fat hero sections.
 * One compact row: title + optional subtitle + action buttons on the right.
 * No breadcrumbs (sidebar shows location), no gradient icon badges.
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
  // Derive accent border color from iconColor (e.g. "text-blue-500" → "border-blue-500")
  const accentBorder = iconColor.replace("text-", "border-");

  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="p-2.5 rounded-xl bg-muted shrink-0">
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 animate-in slide-in-from-right-8 fade-in duration-500">
            {actions}
          </div>
        )}
      </div>
      {/* Module accent line */}
      <div className={`mt-4 h-0.5 rounded-full border-b-2 ${accentBorder} opacity-40`} />
    </div>
  );
}
