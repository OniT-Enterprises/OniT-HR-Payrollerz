/**
 * Marketing section eyebrow — small tracked uppercase label with the gold
 * crescent hovering above its first letter, echoing the mark above the "x"
 * in the Xefe logo. Accent follows the page's color (docs/DESIGN_MARKETING.md).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Crescent } from "./Crescent";
import type { PublicAccent } from "./PublicSectionNav";

const TEXT: Record<PublicAccent, string> = {
  amber: "text-amber-300",
  lime: "text-lime-300",
  sky: "text-sky-300",
};

const MARK: Record<PublicAccent, string> = {
  amber: "text-amber-400",
  lime: "text-lime-400",
  sky: "text-sky-400",
};

export function SectionEyebrow({
  accent = "amber",
  children,
}: {
  accent?: PublicAccent;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "relative inline-block pt-2 text-[11px] font-bold uppercase tracking-[0.25em]",
        TEXT[accent],
      )}
    >
      <Crescent className={cn("absolute -top-1 left-0 h-3.5 w-3.5", MARK[accent])} />
      {children}
    </p>
  );
}
