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
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="p-2 rounded-xl bg-muted shrink-0">
            <Icon className={`h-5 w-5 ${iconColor}`} />
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
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
