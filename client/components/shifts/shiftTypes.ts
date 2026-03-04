export interface ShiftSlot {
  id: string;
  label: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  color: string; // dot color class
}

export const defaultShiftSlots: ShiftSlot[] = [
  { id: "morning", label: "Morning", enabled: true, startTime: "06:00", endTime: "14:00", color: "bg-orange-500" },
  { id: "afternoon", label: "Afternoon", enabled: true, startTime: "14:00", endTime: "22:00", color: "bg-red-500" },
  { id: "night", label: "Night", enabled: false, startTime: "22:00", endTime: "06:00", color: "bg-purple-500" },
];
