/**
 * Calendar component built on react-day-picker v9
 * Styled to match shadcn/ui design system
 */
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { format as formatDate } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Local-time ISO date, matching the value DatePicker emits. */
function formatISO(date: Date): string {
  return formatDate(date, "yyyy-MM-dd");
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1 sm:p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "pointer-events-none relative flex h-11 items-center justify-center pt-1",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1 absolute inset-x-0 justify-between z-10",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-0 z-10 h-11 w-11 bg-transparent p-0 opacity-50 hover:opacity-100 md:h-11 md:min-h-11"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-0 z-10 h-11 w-11 bg-transparent p-0 opacity-50 hover:opacity-100 md:h-11 md:min-h-11"
        ),
        month_grid: "w-full border-collapse space-x-1",
        weekdays: "flex",
        weekday:
          "w-11 rounded-md text-[0.8rem] font-normal text-muted-foreground",
        week: "flex w-full mt-2",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50",
          "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-11 w-11 p-0 font-normal aria-selected:opacity-100 md:h-11 md:min-h-11"
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
        // Stable, locale-independent hook for tests and automation. The
        // accessible name is localized prose, so it is not addressable.
        DayButton: ({ day, modifiers: _modifiers, ...buttonProps }) => (
          <button {...buttonProps} data-date={formatISO(day.date)} />
        ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
