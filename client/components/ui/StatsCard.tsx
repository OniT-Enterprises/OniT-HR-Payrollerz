/**
 * StatsCard - Consistent stats display card
 * Used across dashboards and pages for key metrics
 */

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  /** Main value to display (number or formatted string) */
  value: string | number;
  /** Label describing the stat */
  label: string;
  /** Icon to display */
  icon?: LucideIcon;
  /** Icon background color class (e.g., "bg-blue-100 dark:bg-blue-900/30") */
  iconBg?: string;
  /** Icon color class (e.g., "text-blue-500") */
  iconColor?: string;
  /** Optional badge to show (e.g., "Needs Review") */
  badge?: string;
  /** Badge variant */
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  /** Badge color override */
  badgeClassName?: string;
  /** Click handler to make card interactive */
  onClick?: () => void;
  /** Additional className */
  className?: string;
  /** Trend indicator */
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
}

export function StatsCard({
  value,
  label,
  icon: Icon,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
  badge,
  badgeVariant = "secondary",
  badgeClassName,
  onClick,
  className,
  trend,
}: StatsCardProps) {
  const isClickable = !!onClick;

  return (
    <Card
      className={cn(
        isClickable && "cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
            {trend && (
              <p
                className={cn(
                  "text-xs mt-1",
                  trend.direction === "up" && "text-green-600",
                  trend.direction === "down" && "text-red-600",
                  trend.direction === "neutral" && "text-muted-foreground"
                )}
              >
                {trend.direction === "up" && "↑ "}
                {trend.direction === "down" && "↓ "}
                {trend.value}
              </p>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center",
                iconBg
              )}
            >
              <Icon className={cn("h-6 w-6", iconColor)} />
            </div>
          )}
        </div>
        {badge && (
          <Badge
            variant={badgeVariant}
            className={cn("mt-2", badgeClassName)}
          >
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * StatsRow - Grid container for stats cards
 * Responsive: 1 col mobile, 2 col tablet, 4 col desktop
 */
interface StatsRowProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsRow({ children, columns = 4, className }: StatsRowProps) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}

export default StatsCard;
