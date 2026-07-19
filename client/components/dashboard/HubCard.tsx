import type { ComponentType } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Module-dashboard navigation card: an accent icon badge with a soft glow, a
 * strong title, a one-line purpose statement, and an action row anchored at
 * the bottom. One component so every module hub looks identical apart from its
 * own accent colour.
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
  { glow: string; badge: string; icon: string; action: string; hover: string }
> = {
  green: {
    glow: "bg-primary/25",
    badge: "bg-primary/10 ring-primary/20",
    icon: "text-primary",
    action: "text-primary",
    hover: "hover:border-primary/40 hover:shadow-primary/5",
  },
  blue: {
    glow: "bg-blue-500/25",
    badge: "bg-blue-500/10 ring-blue-500/20",
    icon: "text-blue-500 dark:text-blue-400",
    action: "text-blue-600 dark:text-blue-400",
    hover: "hover:border-blue-400/40 hover:shadow-blue-500/5",
  },
  cyan: {
    glow: "bg-cyan-500/25",
    badge: "bg-cyan-500/10 ring-cyan-500/20",
    icon: "text-cyan-500 dark:text-cyan-400",
    action: "text-cyan-600 dark:text-cyan-400",
    hover: "hover:border-cyan-400/40 hover:shadow-cyan-500/5",
  },
  indigo: {
    glow: "bg-indigo-500/25",
    badge: "bg-indigo-500/10 ring-indigo-500/20",
    icon: "text-indigo-500 dark:text-indigo-400",
    action: "text-indigo-600 dark:text-indigo-400",
    hover: "hover:border-indigo-400/40 hover:shadow-indigo-500/5",
  },
  orange: {
    glow: "bg-orange-500/25",
    badge: "bg-orange-500/10 ring-orange-500/20",
    icon: "text-orange-500 dark:text-orange-400",
    action: "text-orange-600 dark:text-orange-400",
    hover: "hover:border-orange-400/40 hover:shadow-orange-500/5",
  },
  violet: {
    glow: "bg-violet-500/25",
    badge: "bg-violet-500/10 ring-violet-500/20",
    icon: "text-violet-500 dark:text-violet-400",
    action: "text-violet-600 dark:text-violet-400",
    hover: "hover:border-violet-400/40 hover:shadow-violet-500/5",
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
        "group relative flex min-h-[10.5rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-4 text-left transition-[border-color,box-shadow] duration-200 hover:shadow-md active:scale-[0.99] sm:min-h-[12rem] sm:p-5",
        a.hover,
      )}
    >
      <div className="relative mb-4 w-fit">
        {/* Static, soft glow behind the badge. Kept constant (no hover
            animation) — animating opacity on a blurred layer flickers. */}
        <span
          aria-hidden
          className={cn("absolute inset-0 rounded-2xl blur-md opacity-70", a.glow)}
        />
        <span
          className={cn(
            "relative flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset sm:h-14 sm:w-14",
            a.badge,
          )}
        >
          <Icon className={cn("h-6 w-6 sm:h-7 sm:w-7", a.icon)} />
        </span>
      </div>

      <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{purpose}</p>

      <div
        className={cn(
          "mt-auto flex items-center gap-1.5 border-t border-border/60 pt-3 text-sm font-medium",
          a.action,
        )}
      >
        {action}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
