import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LeaveRequest, LeaveType } from "@/services/leaveService";
import type { Department } from "@/services/departmentService";
import { getTLPublicHolidays, type TLHoliday } from "@/lib/payroll/tl-holidays";

type ViewMode = "week" | "month";

interface LeaveCalendarProps {
  requests: LeaveRequest[];
  departments: Department[];
}

const LEAVE_TYPE_COLORS: Record<LeaveType | string, { bg: string; text: string; border: string }> = {
  annual: { bg: "bg-cyan-500/20", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-500/40" },
  sick: { bg: "bg-red-500/20", text: "text-red-700 dark:text-red-300", border: "border-red-500/40" },
  maternity: { bg: "bg-pink-500/20", text: "text-pink-700 dark:text-pink-300", border: "border-pink-500/40" },
  paternity: { bg: "bg-blue-500/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-500/40" },
  bereavement: { bg: "bg-gray-500/20", text: "text-gray-700 dark:text-gray-300", border: "border-gray-500/40" },
  unpaid: { bg: "bg-orange-500/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500/40" },
  marriage: { bg: "bg-rose-500/20", text: "text-rose-700 dark:text-rose-300", border: "border-rose-500/40" },
  study: { bg: "bg-violet-500/20", text: "text-violet-700 dark:text-violet-300", border: "border-violet-500/40" },
  custom: { bg: "bg-gray-400/20", text: "text-gray-600 dark:text-gray-400", border: "border-gray-400/40" },
};

const PENDING_STYLES = "opacity-60 border-dashed";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0=Sun
  const days: Date[] = [];

  // Fill in days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }

  // Current month days
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }

  // Fill remaining to complete last week
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }

  return days;
}

function getWeekDays(anchor: Date): Date[] {
  const day = anchor.getDay();
  const start = new Date(anchor);
  start.setDate(start.getDate() - day);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function getFirstName(name: string) {
  return name.split(" ")[0];
}

/* ─── Sub-components ─── */

function DayCell({
  day, idx, todayKey, viewMode, currentMonth, maxLeavesPerCell,
  holidayMap, leavesByDate,
}: {
  day: Date; idx: number; todayKey: string; viewMode: ViewMode;
  currentMonth: number; maxLeavesPerCell: number;
  holidayMap: Map<string, TLHoliday>;
  leavesByDate: Map<string, LeaveRequest[]>;
}) {
  const key = formatDateKey(day);
  const isToday = key === todayKey;
  const holiday = holidayMap.get(key);
  const leaves = leavesByDate.get(key) || [];
  const isOutside = viewMode === "month" && day.getMonth() !== currentMonth;
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

  return (
    <div
      key={`${key}-${idx}`}
      className={cn(
        "border border-border/30 p-1 min-h-[80px] transition-colors",
        viewMode === "week" && "min-h-[140px]",
        isOutside && "bg-muted/30",
        isWeekend && !isOutside && "bg-muted/20",
        holiday && "bg-red-500/5 dark:bg-red-500/10",
      )}
    >
      <div className="flex items-start justify-between mb-0.5">
        <span
          className={cn(
            "text-xs font-medium leading-5 w-5 h-5 flex items-center justify-center rounded-full",
            isToday && "bg-cyan-500 text-white font-bold",
            isOutside && "text-muted-foreground/40",
            !isToday && !isOutside && "text-foreground",
          )}
        >
          {day.getDate()}
        </span>
        {holiday && (
          <span className="text-[9px] leading-tight text-red-600 dark:text-red-400 font-medium truncate max-w-[90%] text-right">
            {holiday.nameTetun || holiday.name}
          </span>
        )}
      </div>
      <LeaveEntries leaves={leaves} maxShown={maxLeavesPerCell} />
    </div>
  );
}

function LeaveEntries({ leaves, maxShown }: { leaves: LeaveRequest[]; maxShown: number }) {
  return (
    <div className="space-y-0.5">
      {leaves.slice(0, maxShown).map((leave) => {
        const colors = LEAVE_TYPE_COLORS[leave.leaveType] || LEAVE_TYPE_COLORS.custom;
        const isPending = leave.status === "pending";
        return (
          <div
            key={leave.id}
            className={cn(
              "text-[10px] leading-tight px-1 py-0.5 rounded border truncate",
              colors.bg, colors.text, colors.border,
              isPending && PENDING_STYLES,
            )}
            title={`${leave.employeeName} — ${leave.leaveType}${isPending ? " (pending)" : ""}`}
          >
            {getFirstName(leave.employeeName)}
          </div>
        );
      })}
      {leaves.length > maxShown && (
        <span className="text-[9px] text-muted-foreground px-1">+{leaves.length - maxShown} more</span>
      )}
    </div>
  );
}

const LEGEND_ITEMS = [
  { type: "annual", label: "Annual" },
  { type: "sick", label: "Sick" },
  { type: "maternity", label: "Maternity" },
  { type: "paternity", label: "Paternity" },
  { type: "marriage", label: "Marriage" },
  { type: "unpaid", label: "Unpaid" },
] as const;

function CalendarLegend() {
  return (
    <div className="flex items-center gap-3 flex-wrap text-[10px]">
      {LEGEND_ITEMS.map(({ type, label }) => {
        const colors = LEAVE_TYPE_COLORS[type];
        return (
          <div key={type} className="flex items-center gap-1">
            <div className={cn("w-3 h-2 rounded-sm border", colors.bg, colors.border)} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-1 ml-2">
        <div className="w-3 h-2 rounded-sm border border-dashed border-gray-400 bg-gray-200/40" />
        <span className="text-muted-foreground">Pending</span>
      </div>
      <div className="flex items-center gap-1 ml-2">
        <div className="w-3 h-2 rounded-sm bg-red-500/10 border border-red-500/30" />
        <span className="text-muted-foreground">Holiday</span>
      </div>
    </div>
  );
}

function CalendarToolbar({
  viewMode, setViewMode, headerLabel,
  goPrev, goToday, goNext,
  departments, selectedDepartment, setSelectedDepartment,
}: {
  viewMode: ViewMode; setViewMode: (m: ViewMode) => void; headerLabel: string;
  goPrev: () => void; goToday: () => void; goNext: () => void;
  departments: Department[]; selectedDepartment: string;
  setSelectedDepartment: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={goPrev} className="h-8 w-8 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs px-3">Today</Button>
        <Button variant="outline" size="sm" onClick={goNext} className="h-8 w-8 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold ml-2">{headerLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border border-border/50 overflow-hidden">
          <button
            onClick={() => setViewMode("month")}
            className={cn(
              "px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "month" ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" : "text-muted-foreground hover:bg-muted",
            )}
          >Month</button>
          <button
            onClick={() => setViewMode("week")}
            className={cn(
              "px-3 py-1 text-xs font-medium transition-colors border-l border-border/50",
              viewMode === "week" ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" : "text-muted-foreground hover:bg-muted",
            )}
          >Week</button>
        </div>
      </div>
    </div>
  );
}

function getHeaderLabel(viewMode: ViewMode, currentDate: Date): string {
  if (viewMode === "month") {
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const weekDays = getWeekDays(currentDate);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(weekDays[0])} – ${fmt(weekDays[6])}, ${weekDays[6].getFullYear()}`;
}

/* ─── Main component ─── */

export default function LeaveCalendar({ requests, departments }: LeaveCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const filteredRequests = useMemo(() => {
    const visible = requests.filter((r) => r.status === "approved" || r.status === "pending");
    if (selectedDepartment === "all") return visible;
    return visible.filter((r) => r.departmentId === selectedDepartment || r.department === selectedDepartment);
  }, [requests, selectedDepartment]);

  const currentYear = currentDate.getFullYear();
  const holidayMap = useMemo(() => {
    const map = new Map<string, TLHoliday>();
    for (const y of [currentYear - 1, currentYear, currentYear + 1]) {
      for (const h of getTLPublicHolidays(y)) map.set(h.date, h);
    }
    return map;
  }, [currentYear]);

  const leavesByDate = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    for (const req of filteredRequests) {
      const start = new Date(req.startDate + "T00:00:00");
      const end = new Date(req.endDate + "T00:00:00");
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = formatDateKey(cursor);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(req);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [filteredRequests]);

  const days = useMemo(() => {
    return viewMode === "week" ? getWeekDays(currentDate) : getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
  }, [viewMode, currentDate]);

  const todayKey = formatDateKey(new Date());
  const maxLeavesPerCell = viewMode === "month" ? 3 : 6;
  const headerLabel = getHeaderLabel(viewMode, currentDate);

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === "month") d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === "month") d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  return (
    <div className="space-y-4">
      <CalendarToolbar
        viewMode={viewMode} setViewMode={setViewMode} headerLabel={headerLabel}
        goPrev={goPrev} goToday={goToday} goNext={goNext}
        departments={departments} selectedDepartment={selectedDepartment}
        setSelectedDepartment={setSelectedDepartment}
      />
      <CalendarLegend />
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50">
          {DAY_NAMES.map((name) => (
            <div key={name} className="text-center text-xs font-medium text-muted-foreground py-2 border-b border-border/30">
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => (
            <DayCell
              key={`${formatDateKey(day)}-${idx}`}
              day={day} idx={idx} todayKey={todayKey} viewMode={viewMode}
              currentMonth={currentDate.getMonth()} maxLeavesPerCell={maxLeavesPerCell}
              holidayMap={holidayMap} leavesByDate={leavesByDate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
