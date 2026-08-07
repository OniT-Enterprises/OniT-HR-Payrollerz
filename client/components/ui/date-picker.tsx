/**
 * DatePicker — popover calendar that replaces native <input type="date">.
 *
 * The native control is wrong for this product: its popup ignores our theme
 * (a white sheet in dark mode), its hit targets are small, and its segmented
 * MM/DD/YYYY entry is ambiguous for users who do not read English or
 * Portuguese dates. This renders the app's own calendar with a plainly
 * formatted, localized label.
 *
 * Accepts and emits ISO date strings (YYYY-MM-DD), so it is a drop-in for the
 * existing `value` / `onChange(e.target.value)` call sites.
 */
import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  /** ISO date string YYYY-MM-DD */
  value: string;
  /** Called with ISO date string YYYY-MM-DD, or "" when cleared */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Earliest selectable date, ISO YYYY-MM-DD */
  min?: string;
  /** Latest selectable date, ISO YYYY-MM-DD */
  max?: string;
  /** Show a clear button when a date is set. Off for required fields. */
  clearable?: boolean;
  /** Blocks form submission while empty, like the native input did. */
  required?: boolean;
  name?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}

function parseIso(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  id,
  disabled = false,
  min,
  max,
  clearable = false,
  required = false,
  name,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);

  const date = parseIso(value);
  const minDate = parseIso(min);
  const maxDate = parseIso(max);

  const handleSelect = (selected: Date | undefined) => {
    if (!selected) return;
    onChange(format(selected, "yyyy-MM-dd"));
    setOpen(false);
  };

  // Use the app's own month names so the label reads correctly in Tetun and
  // Portuguese, not just English.
  const label = date
    ? `${format(date, "d")} ${t(`common.months.${date.getMonth() + 1}`) || format(date, "MMM")} ${format(date, "yyyy")}`
    : null;

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            className={cn(
              "h-11 w-full justify-start px-3 text-left font-normal",
              !value && "text-muted-foreground",
              clearable && value && "pr-10",
              ariaInvalid && "border-destructive",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">
              {label ?? (placeholder || t("common.pickADate") || "Pick a date")}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            defaultMonth={date ?? minDate ?? maxDate}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      {/* Keeps native form validation working now that the real date input is
          gone. Not `hidden`/`display:none` — the browser cannot focus those,
          and an unfocusable invalid control silently blocks submit with no
          message. An opacity-0 control still receives focus and anchors the
          bubble over the trigger. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          name={name}
          value={value}
          onChange={() => undefined}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full opacity-0"
        />
      )}

      {clearable && value && !disabled && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("common.clear") || "Clear"}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
