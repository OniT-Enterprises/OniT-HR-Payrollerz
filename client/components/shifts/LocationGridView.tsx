import React, { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Users, AlertTriangle } from "lucide-react";
import {
  getTodayTL,
  getWeekStartTL,
  addDaysISO,
  parseDateISO,
} from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/I18nProvider";
import { calcShiftHours, type ShiftRecord, type ShiftSlot } from "@/services/shiftService";
import type { WorkLocation } from "@/types/settings";

import LocationSelector, { type LocationItem } from "./LocationSelector";
import ShiftTimeConfig from "./ShiftTimeConfig";
import StaffAssignPopover from "./StaffAssignPopover";

interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  maxHoursPerWeek?: number;
}

// Timor-Leste Labour Law standard maximum working hours per week
const TL_MAX_WEEKLY_HOURS = 44;

interface LocationGridViewProps {
  employees: Employee[];
  shifts: ShiftRecord[];
  selectedWeek: string;
  locations: WorkLocation[];
  slots: ShiftSlot[];
  onSlotsChange: (slots: ShiftSlot[]) => void;
  onCreateShift: (data: Omit<ShiftRecord, "id" | "tenantId" | "createdAt" | "updatedAt">) => Promise<string>;
  onDeleteShift: (shiftId: string) => Promise<void>;
  onSelectWeek: (week: string) => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Pick an icon type for a work location */
function classifyLocation(loc: WorkLocation): LocationItem["type"] {
  const lower = loc.name.toLowerCase();
  if (lower.includes("warehouse") || lower.includes("armazém") || lower.includes("armazen")) return "warehouse";
  if (lower.includes("remote") || lower.includes("remotu")) return "remote";
  if (loc.isHeadquarters) return "office";
  return "site";
}

/** Is HH:MM `time` within [start, end), wrapping past midnight when start > end */
function timeInSlot(time: string, start: string, end: string): boolean {
  if (start === end) return time === start;
  if (start < end) return time >= start && time < end;
  return time >= start || time < end; // overnight slot, e.g. 22:00–06:00
}

export default function LocationGridView({
  employees,
  shifts,
  selectedWeek,
  locations,
  slots,
  onSlotsChange,
  onCreateShift,
  onDeleteShift,
  onSelectWeek,
  goToPreviousWeek,
  goToNextWeek,
}: LocationGridViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const [pickedLocation, setPickedLocation] = useState("");
  const [slotConfigOpen, setSlotConfigOpen] = useState(false);

  // Fall back to the first location while none is picked (or the picked one was removed)
  const selectedLocation = locations.some((l) => l.name === pickedLocation)
    ? pickedLocation
    : locations[0]?.name ?? "";

  // Gear on a location card: select that location and toggle the slot config panel
  const handleOpenSettings = useCallback(
    (location: string) => {
      setPickedLocation(location);
      setSlotConfigOpen((open) => (location === selectedLocation ? !open : true));
    },
    [selectedLocation]
  );

  const slotLabel = useCallback(
    (slot: ShiftSlot) => {
      const key = `timeLeave.shiftScheduling.locationView.slots.${slot.id}`;
      const translated = t(key);
      return translated === key ? slot.label : translated;
    },
    [t]
  );

  const locationItems: LocationItem[] = useMemo(
    () =>
      locations.map((loc) => ({
        name: loc.name,
        label: loc.name,
        sublabel: loc.isHeadquarters
          ? t("timeLeave.shiftScheduling.locationView.headquarters")
          : loc.city || undefined,
        type: classifyLocation(loc),
      })),
    [locations, t]
  );

  const activeSlots = useMemo(() => slots.filter((s) => s.enabled), [slots]);

  const weekDates = useMemo(() => {
    const todayStr = getTodayTL();
    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDaysISO(selectedWeek, i);
      const d = parseDateISO(dateStr);
      return {
        dateStr,
        dayName: DAY_NAMES[d.getUTCDay()],
        dayNum: d.getUTCDate(),
        monthName: MONTH_NAMES[d.getUTCMonth()],
        isToday: dateStr === todayStr,
      };
    });
  }, [selectedWeek]);

  // Which quick-tab (if any) matches the selected week
  const thisWeekStart = getWeekStartTL();
  const nextWeekStart = addDaysISO(thisWeekStart, 7);
  const weekTab: "this" | "next" | null =
    selectedWeek === thisWeekStart ? "this" : selectedWeek === nextWeekStart ? "next" : null;

  const locationShifts = useMemo(
    () => shifts.filter((s) => s.location === selectedLocation),
    [shifts, selectedLocation]
  );

  // Weekly hours per employee across ALL locations, for overtime warnings
  const weeklyHoursByEmployee = useMemo(() => {
    const totals = new Map<string, number>();
    shifts.forEach((s) => {
      if (s.status === "cancelled") return;
      totals.set(s.employeeId, (totals.get(s.employeeId) ?? 0) + s.hours);
    });
    return totals;
  }, [shifts]);

  const employeesById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  const isOvertime = useCallback(
    (employeeId: string) => {
      const max = employeesById.get(employeeId)?.maxHoursPerWeek ?? TL_MAX_WEEKLY_HOURS;
      return (weeklyHoursByEmployee.get(employeeId) ?? 0) > max;
    },
    [employeesById, weeklyHoursByEmployee]
  );

  const getSlotForShift = useCallback(
    (shift: ShiftRecord): ShiftSlot | undefined => {
      if (shift.slotId) {
        const byId = activeSlots.find((slot) => slot.id === shift.slotId);
        if (byId) return byId;
      }
      // Legacy shifts and dialog-created shifts: match by time range
      return activeSlots.find((slot) =>
        timeInSlot(shift.startTime, slot.startTime, slot.endTime)
      );
    },
    [activeSlots]
  );

  const getCellShifts = useCallback(
    (dateStr: string, slotId: string) => {
      return locationShifts.filter(
        (s) => s.date === dateStr && getSlotForShift(s)?.id === slotId
      );
    },
    [locationShifts, getSlotForShift]
  );

  const handleAssign = useCallback(
    async (employeeId: string, emp: { name: string; department: string; position: string }, dateStr: string, slot: ShiftSlot) => {
      try {
        await onCreateShift({
          employeeId,
          employeeName: emp.name,
          department: emp.department,
          position: emp.position,
          date: dateStr,
          startTime: slot.startTime,
          endTime: slot.endTime,
          hours: calcShiftHours(slot.startTime, slot.endTime),
          status: "draft",
          location: selectedLocation,
          slotId: slot.id,
          notes: "",
          createdBy: user?.email || "unknown",
        });
        toast({
          title: t("timeLeave.shiftScheduling.locationView.assignedTitle"),
          description: t("timeLeave.shiftScheduling.locationView.assignedDesc", {
            name: emp.name,
            slot: slotLabel(slot),
          }),
        });
      } catch {
        toast({
          title: t("timeLeave.shiftScheduling.toast.errorTitle"),
          description: t("timeLeave.shiftScheduling.locationView.assignError"),
          variant: "destructive",
        });
      }
    },
    [onCreateShift, selectedLocation, user, toast, t, slotLabel]
  );

  const handleUnassign = useCallback(
    async (shiftId: string) => {
      try {
        await onDeleteShift(shiftId);
        toast({
          title: t("timeLeave.shiftScheduling.locationView.removedTitle"),
          description: t("timeLeave.shiftScheduling.locationView.removedDesc"),
        });
      } catch {
        toast({
          title: t("timeLeave.shiftScheduling.toast.errorTitle"),
          description: t("timeLeave.shiftScheduling.locationView.removeError"),
          variant: "destructive",
        });
      }
    },
    [onDeleteShift, toast, t]
  );

  return (
    <div className="space-y-4">
      {/* Top section: Location selector; shift slot config folds away behind the gear */}
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {t("timeLeave.shiftScheduling.controls.location")}
          </div>
          <LocationSelector
            locations={locationItems}
            selected={selectedLocation}
            onSelect={setPickedLocation}
            onOpenSettings={handleOpenSettings}
            settingsOpen={slotConfigOpen}
            settingsLabel={t("timeLeave.shiftScheduling.locationView.shiftSlots")}
          />
        </div>
        {slotConfigOpen && (
          <div className="min-w-0 rounded-xl border border-border/50 bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("timeLeave.shiftScheduling.locationView.shiftSlots")}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSlotConfigOpen(false)}
              >
                {t("timeLeave.shiftScheduling.locationView.done")}
              </Button>
            </div>
            <ShiftTimeConfig slots={slots} onChange={onSlotsChange} />
          </div>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => onSelectWeek(thisWeekStart)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              weekTab === "this"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("timeLeave.shiftScheduling.locationView.thisWeek")}
          </button>
          <button
            onClick={() => onSelectWeek(nextWeekStart)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              weekTab === "next"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("timeLeave.shiftScheduling.locationView.nextWeek")}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("common.previous")}
            onClick={goToPreviousWeek}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground px-1 tabular-nums whitespace-nowrap">
            {weekDates[0]?.dayNum} {weekDates[0]?.monthName} – {weekDates[6]?.dayNum} {weekDates[6]?.monthName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("common.next")}
            onClick={goToNextWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8"
          onClick={() => onSelectWeek(thisWeekStart)}
        >
          {t("timeLeave.attendance.actions.today")}
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          {t("timeLeave.shiftScheduling.locationView.shiftsAt", {
            count: locationShifts.length,
            location: selectedLocation,
          })}
        </span>
      </div>

      {/* Grid: day rows × shift-slot columns */}
      {activeSlots.length === 0 ? (
        <div className="py-16 text-center border rounded-xl bg-card">
          <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t("timeLeave.shiftScheduling.locationView.noSlots")}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t("timeLeave.shiftScheduling.locationView.noSlotsHint")}
          </p>
          <Button size="sm" className="mt-4" onClick={() => setSlotConfigOpen(true)}>
            {t("timeLeave.shiftScheduling.locationView.configureSlots")}
          </Button>
        </div>
      ) : (
        <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border/30 w-24">
                  {t("timeLeave.shiftScheduling.locationView.day")}
                </th>
                {activeSlots.map((slot) => (
                  <th
                    key={slot.id}
                    className="px-3 py-3 text-center border-b border-r border-border/30 last:border-r-0"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", slot.color)} />
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {slotLabel(slot)}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {slot.startTime}–{slot.endTime}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekDates.map((day) => (
                <tr
                  key={day.dateStr}
                  className={cn(
                    "border-b border-border/20 last:border-b-0 hover:bg-muted/10 transition-colors",
                    day.isToday && "bg-cyan-50/30 dark:bg-cyan-950/10"
                  )}
                >
                  {/* Day label — compact */}
                  <td className="px-3 py-2.5 border-r border-border/30 w-24">
                    <div
                      className={cn(
                        "text-xs font-semibold uppercase",
                        day.isToday ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground"
                      )}
                    >
                      {day.dayName}
                    </div>
                    <div
                      className={cn(
                        "text-base font-bold leading-tight",
                        day.isToday ? "text-cyan-600 dark:text-cyan-400" : "text-foreground"
                      )}
                    >
                      {day.dayNum}
                    </div>
                  </td>

                  {/* Shift slot cells */}
                  {activeSlots.map((slot) => {
                    const cellShifts = getCellShifts(day.dateStr, slot.id);
                    const assignedIds = cellShifts.map((s) => s.employeeId);
                    const shiftMap: Record<string, string> = {};
                    cellShifts.forEach((s) => {
                      if (s.id) shiftMap[s.employeeId] = s.id;
                    });
                    const overtimeNames = cellShifts
                      .filter((s) => isOvertime(s.employeeId))
                      .map((s) => s.employeeName?.split(" ")[0] || "—");

                    return (
                      <td
                        key={slot.id}
                        className="px-2 py-2 border-r border-border/30 last:border-r-0 align-top"
                      >
                        <div className="min-h-[48px]">
                          {/* Status row: edit · staff count · overtime warning */}
                          <div className="flex items-center gap-1.5">
                            <StaffAssignPopover
                              employees={employees}
                              assignedEmployeeIds={assignedIds}
                              assignedShiftMap={shiftMap}
                              date={day.dateStr}
                              slot={slot}
                              slotLabel={slotLabel(slot)}
                              location={selectedLocation}
                              onAssign={(empId, emp) => handleAssign(empId, emp, day.dateStr, slot)}
                              onUnassign={handleUnassign}
                            />
                            <span
                              className={cn(
                                "flex items-center gap-1 text-[11px] tabular-nums",
                                assignedIds.length > 0 ? "text-foreground font-medium" : "text-muted-foreground/50"
                              )}
                              title={t("timeLeave.shiftScheduling.locationView.staffCount", {
                                count: assignedIds.length,
                              })}
                            >
                              <Users className="h-3 w-3" />
                              {assignedIds.length}
                            </span>
                            {overtimeNames.length > 0 && (
                              <span
                                title={t("timeLeave.shiftScheduling.locationView.overtimeWarning", {
                                  max: TL_MAX_WEEKLY_HOURS,
                                  names: overtimeNames.join(", "),
                                })}
                              >
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              </span>
                            )}
                          </div>

                          {/* Thin separator + assigned staff pills */}
                          {cellShifts.length > 0 && (
                            <>
                              <div className="border-t border-border/40 my-1.5" />
                              <div className="flex flex-wrap gap-1">
                                {cellShifts.map((shift) => (
                                  <Badge
                                    key={shift.id}
                                    variant="secondary"
                                    className={cn(
                                      "text-[10px] py-0 px-2 font-medium rounded-full border gap-1",
                                      shift.status === "draft" && "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
                                      shift.status === "published" && "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
                                      shift.status === "confirmed" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
                                      shift.status === "cancelled" && "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 line-through"
                                    )}
                                  >
                                    {shift.employeeName?.split(" ")[0] || "—"}
                                    {isOvertime(shift.employeeId) && (
                                      <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
          {t("timeLeave.shiftScheduling.status.draft")}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          {t("timeLeave.shiftScheduling.status.published")}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          {t("timeLeave.shiftScheduling.status.confirmed")}
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          {t("timeLeave.shiftScheduling.locationView.overtime")}
        </div>
      </div>
    </div>
  );
}
