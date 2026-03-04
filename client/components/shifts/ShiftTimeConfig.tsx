import React from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import type { ShiftSlot } from "./shiftTypes";

interface ShiftTimeConfigProps {
  slots: ShiftSlot[];
  onChange: (slots: ShiftSlot[]) => void;
}

export default function ShiftTimeConfig({ slots, onChange }: ShiftTimeConfigProps) {
  const updateSlot = (id: string, patch: Partial<ShiftSlot>) => {
    onChange(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  return (
    <div className="space-y-2">
      {slots.map((slot) => (
        <div
          key={slot.id}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors",
            slot.enabled
              ? "border-border/50 bg-card"
              : "border-border/30 bg-muted/30 opacity-60"
          )}
        >
          <Switch
            checked={slot.enabled}
            onCheckedChange={(checked) => updateSlot(slot.id, { enabled: checked })}
            className="scale-90"
          />
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", slot.color)} />
          <span className="text-sm font-medium w-20 flex-shrink-0">{slot.label}</span>
          <Input
            type="time"
            value={slot.startTime}
            onChange={(e) => updateSlot(slot.id, { startTime: e.target.value })}
            disabled={!slot.enabled}
            className="h-8 w-[100px] text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="time"
            value={slot.endTime}
            onChange={(e) => updateSlot(slot.id, { endTime: e.target.value })}
            disabled={!slot.enabled}
            className="h-8 w-[100px] text-xs"
          />
        </div>
      ))}
    </div>
  );
}
