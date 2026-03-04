import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Loader2 } from "lucide-react";
import type { ShiftSlot } from "./shiftTypes";

interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
}

interface StaffAssignPopoverProps {
  employees: Employee[];
  assignedEmployeeIds: string[];
  date: string;
  slot: ShiftSlot;
  location: string;
  onAssign: (employeeId: string, employee: Employee) => Promise<void>;
  onUnassign: (shiftId: string) => Promise<void>;
  /** Map of employeeId -> shiftId for currently assigned shifts in this cell */
  assignedShiftMap: Record<string, string>;
}

export default function StaffAssignPopover({
  employees,
  assignedEmployeeIds,
  date,
  slot,
  location,
  onAssign,
  onUnassign,
  assignedShiftMap,
}: StaffAssignPopoverProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = employees.filter((emp) =>
    emp.name.toLowerCase().includes(filter.toLowerCase())
  );

  const handleToggle = async (emp: Employee) => {
    setLoading(emp.id);
    try {
      if (assignedEmployeeIds.includes(emp.id)) {
        const shiftId = assignedShiftMap[emp.id];
        if (shiftId) await onUnassign(shiftId);
      } else {
        await onAssign(emp.id, emp);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <UserPlus className="h-3 w-3" />
          +/- Staff
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <div className="text-xs font-semibold text-foreground">{slot.label} Shift</div>
          <div className="text-[10px] text-muted-foreground">
            {date} &middot; {slot.startTime}–{slot.endTime} &middot; {location}
          </div>
        </div>
        <div className="p-2 border-b">
          <input
            type="text"
            placeholder="Filter staff..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No employees found
            </div>
          ) : (
            filtered.map((emp) => {
              const isAssigned = assignedEmployeeIds.includes(emp.id);
              const isLoading = loading === emp.id;

              return (
                <button
                  key={emp.id}
                  onClick={() => handleToggle(emp)}
                  disabled={isLoading}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                    "hover:bg-accent disabled:opacity-50",
                    isAssigned && "bg-cyan-50/50 dark:bg-cyan-950/20"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Checkbox
                      checked={isAssigned}
                      className="pointer-events-none data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{emp.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {emp.position}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
