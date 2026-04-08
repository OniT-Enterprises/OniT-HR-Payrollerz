/**
 * DatePicker — Popover calendar that replaces native <input type="date">
 * Accepts/emits ISO date strings (YYYY-MM-DD) for compatibility with existing code.
 */
import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  /** ISO date string YYYY-MM-DD */
  value: string;
  /** Called with ISO date string YYYY-MM-DD */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const date = value ? parseISO(value) : undefined;

  const handleSelect = (selected: Date | undefined) => {
    if (selected) {
      // Format as YYYY-MM-DD
      const iso = format(selected, "yyyy-MM-dd");
      onChange(iso);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-11",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {date ? format(date, "MMM d, yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          defaultMonth={date}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
