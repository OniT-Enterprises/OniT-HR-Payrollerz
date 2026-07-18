/**
 * PageHeader — Slim page header rendered at the top of the content area.
 * One compact row: icon + title + optional subtitle on the left, action
 * buttons on the right. The business name (not the page title) lives in the
 * top bar; every page's title sits here, on the same row as its primary action.
 *
 * Pass `cardIcon` (a card-icon name, e.g. "ac-journal") to show the larger
 * two-tone duotone icon that matches the module's hub card. Otherwise pass a
 * Lucide `icon` for the compact tinted badge.
 */

import React from "react";
import type { ComponentType } from "react";
import { CardIcon, hasCardIcon } from "@/components/ui/CardIcon";
import { cn } from "@/lib/utils";

// Section accent classes (literal strings so Tailwind's scanner picks them up).
// Keyed by the color word in `iconColor` so headers match their dashboard cards.
const ACCENT: Record<string, string> = {
  blue: "[--card-icon-accent:#2563eb] dark:[--card-icon-accent:#60a5fa]",
  cyan: "[--card-icon-accent:#0891b2] dark:[--card-icon-accent:#22d3ee]",
  green: "[--card-icon-accent:#6A9C29] dark:[--card-icon-accent:#8cc63f]",
  indigo: "[--card-icon-accent:#4f46e5] dark:[--card-icon-accent:#818cf8]",
  orange: "[--card-icon-accent:#ea580c] dark:[--card-icon-accent:#fb923c]",
  violet: "[--card-icon-accent:#7c3aed] dark:[--card-icon-accent:#a78bfa]",
  primary: "[--card-icon-accent:#6A9C29] dark:[--card-icon-accent:#8cc63f]",
};

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle or date string below the title */
  subtitle?: React.ReactNode;
  /** Card-icon name for the larger two-tone duotone icon (matches the hub card) */
  cardIcon?: string;
  /** Optional Lucide icon for the compact tinted badge (fallback when no cardIcon) */
  icon?: ComponentType<{ className?: string }>;
  /** Icon color class (e.g. "text-cyan-500") — also drives the duotone accent */
  iconColor?: string;
  /** Action buttons rendered on the right */
  actions?: React.ReactNode;
  /** Additional className for the container */
  className?: string;
  /** Optional title sizing override for pages that use the full page-title scale. */
  titleClassName?: string;
}

export default function PageHeader({
  title,
  subtitle,
  cardIcon,
  icon: Icon,
  iconColor = "text-muted-foreground",
  actions,
  className = "",
  titleClassName,
}: PageHeaderProps) {
  // Derive accent border color from iconColor (e.g. "text-blue-500" -> "border-blue-500")
  const accentBorder = iconColor.replace("text-", "border-");
  const colorKey = iconColor.match(
    /blue|cyan|green|indigo|orange|violet|primary/,
  )?.[0];
  const showCardIcon = cardIcon && hasCardIcon(cardIcon);

  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          {showCardIcon ? (
            <CardIcon
              name={cardIcon!}
              className={`h-9 w-9 shrink-0 text-foreground sm:h-10 sm:w-10 ${colorKey ? ACCENT[colorKey] : ""}`}
            />
          ) : Icon ? (
            <div className="shrink-0 rounded-lg bg-muted p-1.5">
              <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
            </div>
          ) : null}
          <div className="min-w-0">
            <h1
              className={cn(
                "truncate text-lg font-bold tracking-tight",
                titleClassName,
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground sm:line-clamp-none sm:truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      <div
        className={`mt-3 h-0.5 rounded-full border-b-2 ${accentBorder} opacity-40`}
      />
    </div>
  );
}
