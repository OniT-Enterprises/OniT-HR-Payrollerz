/**
 * TimePicker - A popover-based time picker with hour/minute/period selectors
 * Replaces native <input type="time"> for a better UX
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value: string; // HH:MM in 24h format
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

// Common work schedule presets
const PRESETS = [
  { label: "8:00 AM", value: "08:00" },
  { label: "8:30 AM", value: "08:30" },
  { label: "9:00 AM", value: "09:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "1:00 PM", value: "13:00" },
  { label: "5:00 PM", value: "17:00" },
  { label: "5:30 PM", value: "17:30" },
  { label: "6:00 PM", value: "18:00" },
];

function to12Hour(h24: number): { hour: number; period: "AM" | "PM" } {
  if (h24 === 0) return { hour: 12, period: "AM" };
  if (h24 < 12) return { hour: h24, period: "AM" };
  if (h24 === 12) return { hour: 12, period: "PM" };
  return { hour: h24 - 12, period: "PM" };
}

function to24Hour(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function formatDisplay(value: string): string {
  if (!value) return "";
  const [hStr, mStr] = value.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return "";
  const { hour, period } = to12Hour(h);
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  required,
  className,
  id,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse current value
  const parsed = React.useMemo(() => {
    if (!value) return { hour: 8, minute: 0, period: "AM" as const };
    const [hStr, mStr] = value.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return { hour: 8, minute: 0, period: "AM" as const };
    const { hour, period } = to12Hour(h);
    return { hour, minute: m, period };
  }, [value]);

  const setTime = (hour12: number, minute: number, period: "AM" | "PM") => {
    const h24 = to24Hour(hour12, period);
    onChange(`${h24.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
  };

  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span>{value ? formatDisplay(value) : placeholder}</span>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        {/* Quick presets */}
        <div className="border-b p-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1.5">Quick Select</p>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  onChange(preset.value);
                  setOpen(false);
                }}
                className={cn(
                  "px-2 py-1 text-xs rounded-md border transition-colors",
                  value === preset.value
                    ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                    : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hour / Minute / Period selectors */}
        <div className="p-3">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            {/* Hours */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Hour</p>
              <div className="grid grid-cols-4 gap-1">
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setTime(h, parsed.minute, parsed.period)}
                    className={cn(
                      "h-7 rounded text-xs font-medium transition-colors",
                      parsed.hour === h
                        ? "bg-cyan-500 text-white"
                        : "bg-muted/50 text-foreground hover:bg-accent",
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Min</p>
              <div className="grid grid-cols-4 gap-1">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTime(parsed.hour, m, parsed.period)}
                    className={cn(
                      "h-7 rounded text-xs font-medium transition-colors",
                      parsed.minute === m
                        ? "bg-cyan-500 text-white"
                        : "bg-muted/50 text-foreground hover:bg-accent",
                    )}
                  >
                    {m.toString().padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            {/* AM/PM */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Period</p>
              <div className="flex flex-col gap-1">
                {(["AM", "PM"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTime(parsed.hour, parsed.minute, p)}
                    className={cn(
                      "h-7 px-2 rounded text-xs font-semibold transition-colors",
                      parsed.period === p
                        ? "bg-cyan-500 text-white"
                        : "bg-muted/50 text-foreground hover:bg-accent",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Current selection display + done */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            <span className="text-sm font-medium text-foreground">
              {value ? formatDisplay(value) : "No time set"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
