/**
 * Themed Recharts tooltip + hover cursor
 * Replaces Recharts' default white tooltip and grey cursor on dashboard charts.
 */

import React from "react";

interface ChartTooltipPayloadItem {
  value?: number | string;
  color?: string;
  fill?: string;
  name?: string;
  dataKey?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
  /** Optional unit suffix, e.g. "%" */
  unit?: string;
  /** Label for the value, e.g. "staff". Omitted if only one row. */
  valueLabel?: string;
  /** Custom value formatter (takes priority over `unit`). */
  formatValue?: (value: number | string | undefined) => string;
  /** When true, use the row's category name as the header instead of `label`. */
  useRowNameAsLabel?: boolean;
}

export function ChartTooltip({
  active,
  payload,
  label,
  unit = "",
  valueLabel,
  formatValue,
  useRowNameAsLabel = false,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const headerLabel = useRowNameAsLabel ? payload[0]?.name : label;

  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      {headerLabel ? (
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {headerLabel}
        </div>
      ) : null}
      <div className="space-y-0.5">
        {payload.map((entry: ChartTooltipPayloadItem, idx: number) => {
          const tone = entry.color || entry.fill || "hsl(var(--primary))";
          const formatted = formatValue
            ? formatValue(entry.value)
            : `${typeof entry.value === "number" ? entry.value.toLocaleString() : String(entry.value ?? "")}${unit}`;
          return (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tone }}
              />
              <span className="font-semibold tabular-nums text-foreground">{formatted}</span>
              {valueLabel ? (
                <span className="text-xs text-muted-foreground">{valueLabel}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Transparent bar hover cursor — kills Recharts' grey hover block. */
export const chartHoverCursor = { fill: "hsl(var(--muted) / 0.35)", radius: 8 } as const;
