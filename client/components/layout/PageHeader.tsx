/**
 * PageHeader — Slim page header replacing the fat hero sections.
 * One compact row: title + optional subtitle + action buttons on the right.
 * No breadcrumbs (sidebar shows location), no gradient icon badges.
 */

import React, { useEffect } from "react";
import type { ComponentType } from "react";
import { useLayoutOptional } from "@/contexts/LayoutContext";

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

function flattenSubtitleText(value: React.ReactNode): string {
  if (value == null || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flattenSubtitleText).join("");
  if (React.isValidElement(value)) {
    const element = value as React.ReactElement<{ children?: React.ReactNode }>;
    return flattenSubtitleText(element.props.children);
  }
  return "";
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-muted-foreground",
  actions,
  className = "",
}: PageHeaderProps) {
  const layout = useLayoutOptional();
  const setPageHeader = layout?.setPageHeader;
  const clearPageHeader = layout?.clearPageHeader;
  const subtitleText = flattenSubtitleText(subtitle).replace(/\s+/g, " ").trim() || undefined;

  useEffect(() => {
    if (!setPageHeader) return;

    setPageHeader({
      title,
      subtitle: subtitleText,
      icon: Icon,
      iconColor,
    });

    return () => {
      clearPageHeader?.();
    };
  }, [setPageHeader, clearPageHeader, title, subtitleText, Icon, iconColor]);

  if (layout) {
    if (!actions) {
      return null;
    }

    return (
      <div className={`mb-4 flex justify-end ${className}`}>
        <div className="flex flex-wrap items-center gap-2 shrink-0 animate-in slide-in-from-right-8 fade-in duration-500">
          {actions}
        </div>
      </div>
    );
  }

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
