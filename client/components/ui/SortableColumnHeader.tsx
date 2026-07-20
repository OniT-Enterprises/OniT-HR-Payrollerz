import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/table-sort";

interface SortableColumnHeaderProps {
  /** Column label shown to the user. */
  label: string;
  /** True when this column is the one currently sorted. */
  active: boolean;
  /** Current direction (only meaningful when `active`). */
  direction: SortDirection;
  /** Click handler — pair with `useTableSort`'s `toggleSort(key)`. */
  onSort: () => void;
  /** Right-align for numeric columns (mirrors the icon to the label's left). */
  align?: "left" | "right";
  className?: string;
}

/**
 * A clickable, sort-aware column header button. Drops into a custom grid
 * `columnheader` div or a shadcn `<TableHead>`; put `aria-sort` on that wrapping
 * element. Neutral state shows a dimmed up/down chevron; active shows the
 * current direction. Pairs with `useTableSort`.
 */
export function SortableColumnHeader({
  label,
  active,
  direction,
  onSort,
  align = "left",
  className,
}: SortableColumnHeaderProps) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        "group inline-flex select-none items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground",
        align === "right" && "flex-row-reverse",
        className,
      )}
    >
      <span>{label}</span>
      <Icon
        aria-hidden="true"
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-opacity",
          active ? "text-foreground opacity-100" : "opacity-40 group-hover:opacity-70",
        )}
      />
    </button>
  );
}
