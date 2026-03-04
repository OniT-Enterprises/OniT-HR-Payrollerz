import React, { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { toDateStringTL } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { ShiftRecord } from "@/services/shiftService";

import LocationSelector, { type LocationItem } from "./LocationSelector";
import ShiftTimeConfig from "./ShiftTimeConfig";
import { type ShiftSlot, defaultShiftSlots } from "./shiftTypes";
import StaffAssignPopover from "./StaffAssignPopover";

interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
}

interface LocationGridViewProps {
  employees: Employee[];
  shifts: ShiftRecord[];
  selectedWeek: string;
  locations: string[];
  getLocationLabel: (loc: string) => string;
  onCreateShift: (data: Omit<ShiftRecord, "id" | "tenantId" | "createdAt" | "updatedAt">) => Promise<string>;
  onDeleteShift: (shiftId: string) => Promise<void>;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Classify a location string into a type for the icon */
function classifyLocation(name: string): LocationItem["type"] {
  const lower = name.toLowerCase();
  if (lower.includes("warehouse")) return "warehouse";
  if (lower.includes("remote")) return "remote";
  if (lower.includes("client") || lower.includes("site")) return "site";
  return "office";
}

/** Calculate hours between two HH:MM strings (handles overnight) */
function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

export default function LocationGridView({
  employees,
  shifts,
  selectedWeek,
  locations,
  getLocationLabel,
  onCreateShift,
  onDeleteShift,
  goToPreviousWeek,
  goToNextWeek,
  goToCurrentWeek,
}: LocationGridViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedLocation, setSelectedLocation] = useState(locations[0] || "");
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>(defaultShiftSlots);
  const [weekTab, setWeekTab] = useState<"this" | "next">("this");

  const locationItems: LocationItem[] = useMemo(
    () =>
      locations.map((loc) => ({
        name: loc,
        label: getLocationLabel(loc),
        type: classifyLocation(loc),
      })),
    [locations, getLocationLabel]
  );

  const activeSlots = useMemo(() => shiftSlots.filter((s) => s.enabled), [shiftSlots]);

  // Week dates array — use plain JS for day/month names to avoid formatDateTL defaults
  const weekDates = useMemo(() => {
    const start = new Date(selectedWeek);
    const todayStr = toDateStringTL(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = toDateStringTL(d);
      return {
        dateStr,
        dayName: DAY_NAMES[d.getDay()],
        dayNum: d.getDate(),
        monthName: MONTH_NAMES[d.getMonth()],
        isToday: dateStr === todayStr,
      };
    });
  }, [selectedWeek]);

  const locationShifts = useMemo(
    () => shifts.filter((s) => s.location === selectedLocation),
    [shifts, selectedLocation]
  );

  const getSlotForShift = useCallback(
    (shift: ShiftRecord): ShiftSlot | undefined => {
      return activeSlots.find((slot) => slot.startTime === shift.startTime);
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

  const getCellAssignments = useCallback(
    (dateStr: string, slotId: string) => {
      const cellShifts = getCellShifts(dateStr, slotId);
      const assignedIds = cellShifts.map((s) => s.employeeId);
      const shiftMap: Record<string, string> = {};
      cellShifts.forEach((s) => {
        if (s.id) shiftMap[s.employeeId] = s.id;
      });
      return { assignedIds, shiftMap };
    },
    [getCellShifts]
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
          hours: calcHours(slot.startTime, slot.endTime),
          status: "draft",
          location: selectedLocation,
          notes: "",
          createdBy: user?.email || "unknown",
        });
        toast({ title: "Shift assigned", description: `${emp.name} added to ${slot.label} shift` });
      } catch {
        toast({ title: "Error", description: "Failed to assign shift", variant: "destructive" });
      }
    },
    [onCreateShift, selectedLocation, user, toast]
  );

  const handleUnassign = useCallback(
    async (shiftId: string) => {
      try {
        await onDeleteShift(shiftId);
        toast({ title: "Shift removed", description: "Employee unassigned" });
      } catch {
        toast({ title: "Error", description: "Failed to remove shift", variant: "destructive" });
      }
    },
    [onDeleteShift, toast]
  );

  const handleWeekTab = (tab: "this" | "next") => {
    setWeekTab(tab);
    if (tab === "this") {
      goToCurrentWeek();
    } else {
      goToNextWeek();
    }
  };

  return (
    <div className="space-y-4">
      {/* Top section: Location selector + Shift time config — stack on smaller screens */}
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Location
          </div>
          <LocationSelector
            locations={locationItems}
            selected={selectedLocation}
            onSelect={setSelectedLocation}
          />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Shift Slots
          </div>
          <ShiftTimeConfig slots={shiftSlots} onChange={setShiftSlots} />
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => handleWeekTab("this")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              weekTab === "this"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            This Week
          </button>
          <button
            onClick={() => handleWeekTab("next")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              weekTab === "next"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Next Week
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground px-1 tabular-nums whitespace-nowrap">
            {weekDates[0]?.dayNum} {weekDates[0]?.monthName} – {weekDates[6]?.dayNum} {weekDates[6]?.monthName}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="ghost" size="sm" className="text-xs h-8" onClick={goToCurrentWeek}>
          Today
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          {locationShifts.length} shift{locationShifts.length !== 1 ? "s" : ""} at{" "}
          {getLocationLabel(selectedLocation)}
        </span>
      </div>

      {/* Grid: day rows × shift-slot columns */}
      {activeSlots.length === 0 ? (
        <div className="py-16 text-center border rounded-xl bg-card">
          <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No shift slots enabled</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Toggle at least one shift slot above to see the grid
          </p>
        </div>
      ) : (
        <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-r border-border/30 w-24">
                  Day
                </th>
                {activeSlots.map((slot) => (
                  <th
                    key={slot.id}
                    className="px-3 py-3 text-center border-b border-r border-border/30 last:border-r-0"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", slot.color)} />
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {slot.label}
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
                    const { assignedIds, shiftMap } = getCellAssignments(day.dateStr, slot.id);

                    return (
                      <td
                        key={slot.id}
                        className="px-2 py-2 border-r border-border/30 last:border-r-0 align-top"
                      >
                        <div className="min-h-[48px] space-y-1">
                          {assignedIds.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {getCellShifts(day.dateStr, slot.id).map((shift) => (
                                <Badge
                                  key={shift.id}
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] py-0 px-1.5 font-medium",
                                    shift.status === "draft" && "bg-muted text-muted-foreground",
                                    shift.status === "published" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
                                    shift.status === "confirmed" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  )}
                                >
                                  {shift.employeeName?.split(" ")[0] || "Staff"}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <StaffAssignPopover
                            employees={employees}
                            assignedEmployeeIds={assignedIds}
                            assignedShiftMap={shiftMap}
                            date={day.dateStr}
                            slot={slot}
                            location={getLocationLabel(selectedLocation)}
                            onAssign={(empId, emp) => handleAssign(empId, emp, day.dateStr, slot)}
                            onUnassign={handleUnassign}
                          />
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
          <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
          Draft
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          Published
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          Confirmed
        </div>
      </div>
    </div>
  );
}
