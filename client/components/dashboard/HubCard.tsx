import type { ComponentType } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Module-dashboard navigation card: an accent icon badge, a strong title, a
 * short purpose statement, and an action row anchored at the bottom. One
 * component keeps every module hub identical apart from its accent colour.
 */
export type HubAccent =
  | "green"
  | "blue"
  | "cyan"
  | "indigo"
  | "orange"
  | "violet";

// Static class strings (Tailwind can't see interpolated colour names).
const ACCENTS: Record<
  HubAccent,
  { badge: string; icon: string; action: string; hover: string }
> = {
  green: {
    badge: "bg-primary/10 ring-primary/20",
    icon: "text-primary",
    action: "text-primary",
    hover: "hover:border-primary/40 hover:bg-primary/[0.03]",
  },
  blue: {
    badge: "bg-blue-500/10 ring-blue-500/20",
    icon: "text-blue-500 dark:text-blue-400",
    action: "text-blue-600 dark:text-blue-400",
    hover: "hover:border-blue-400/40 hover:bg-blue-500/[0.03]",
  },
  cyan: {
    badge: "bg-cyan-500/10 ring-cyan-500/20",
    icon: "text-cyan-500 dark:text-cyan-400",
    action: "text-cyan-600 dark:text-cyan-400",
    hover: "hover:border-cyan-400/40 hover:bg-cyan-500/[0.03]",
  },
  indigo: {
    badge: "bg-indigo-500/10 ring-indigo-500/20",
    icon: "text-indigo-500 dark:text-indigo-400",
    action: "text-indigo-600 dark:text-indigo-400",
    hover: "hover:border-indigo-400/40 hover:bg-indigo-500/[0.03]",
  },
  orange: {
    badge: "bg-orange-500/10 ring-orange-500/20",
    icon: "text-orange-500 dark:text-orange-400",
    action: "text-orange-600 dark:text-orange-400",
    hover: "hover:border-orange-400/40 hover:bg-orange-500/[0.03]",
  },
  violet: {
    badge: "bg-violet-500/10 ring-violet-500/20",
    icon: "text-violet-500 dark:text-violet-400",
    action: "text-violet-600 dark:text-violet-400",
    hover: "hover:border-violet-400/40 hover:bg-violet-500/[0.03]",
  },
};

export function HubCard({
  icon: Icon,
  title,
  purpose,
  action,
  accent = "green",
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  purpose: string;
  action: string;
  accent?: HubAccent;
  onClick: () => void;
}) {
  const a = ACCENTS[accent];
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-[9.5rem] flex-col overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[11rem] sm:rounded-2xl sm:p-5",
        a.hover,
      )}
    >
      <div className="mb-3 w-fit sm:mb-4">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-inset sm:rounded-2xl",
            a.badge,
          )}
        >
          <Icon className={cn("h-6 w-6", a.icon)} />
        </span>
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold leading-5 sm:text-base">
        {title}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:text-sm">
        {purpose}
      </p>

      <div
        className={cn(
          "mt-auto flex items-center gap-1.5 border-t border-border/60 pt-3 text-sm font-medium",
          a.action,
        )}
      >
        {action}
        <ArrowRight className="h-4 w-4" />
      </div>
    </button>
  );
}
