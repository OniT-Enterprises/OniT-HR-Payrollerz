/**
 * TimePicker - A compact 24-hour picker with common work-time shortcuts.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatTime24 } from "@/lib/time";

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
  "08:00",
  "08:30",
  "09:00",
  "12:00",
  "13:00",
  "17:00",
  "17:30",
  "18:00",
];

export function TimePicker({
  value,
  onChange,
  placeholder,
  required,
  className,
  id,
}: TimePickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [popoverContainer, setPopoverContainer] = React.useState<HTMLElement | null>(null);

  const handleTriggerRef = React.useCallback((node: HTMLButtonElement | null) => {
    setPopoverContainer((node?.closest("[role='dialog']") as HTMLElement | null) ?? null);
  }, []);

  // Parse current value
  const parsed = React.useMemo(() => {
    if (!value) return { hour: 8, minute: 0 };
    const [hStr, mStr] = value.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return { hour: 8, minute: 0 };
    return { hour: h, minute: m };
  }, [value]);

  const setTime = (hour: number, minute: number) => {
    onChange(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
  };

  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const minutes = Array.from(
    new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, parsed.minute]),
  ).sort((a, b) => a - b);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          ref={handleTriggerRef}
          type="button"
          id={id}
          aria-required={required}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span>{value ? formatTime24(value) : placeholder || t("common.timePicker.selectTime")}</span>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[280px] p-0"
        align="start"
        container={popoverContainer}
      >
        {/* Quick presets */}
        <div className="border-b p-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
            {t("common.timePicker.quickSelect")}
          </p>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onChange(preset);
                  setOpen(false);
                }}
                className={cn(
                  "px-2 py-1 text-xs rounded-md border transition-colors",
                  value === preset
                    ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                    : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground",
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Native selects stay compact and use the phone's familiar controls. */}
        <div className="p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("common.timePicker.hour")}
              </span>
              <select
                value={parsed.hour}
                onChange={(event) => setTime(Number(event.target.value), parsed.minute)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {hours.map((hour) => (
                  <option key={hour} value={hour}>{hour.toString().padStart(2, "0")}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("common.timePicker.minute")}
              </span>
              <select
                value={parsed.minute}
                onChange={(event) => setTime(parsed.hour, Number(event.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {minutes.map((minute) => (
                  <option key={minute} value={minute}>{minute.toString().padStart(2, "0")}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Current selection display + done */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            <span className="text-sm font-medium text-foreground">
              {value ? formatTime24(value) : t("common.timePicker.noTime")}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              {t("common.timePicker.done")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
