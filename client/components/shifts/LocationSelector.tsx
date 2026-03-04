import React from "react";
import { cn } from "@/lib/utils";
import { Building2, Warehouse, Monitor, MapPin } from "lucide-react";

export interface LocationItem {
  name: string;
  label: string;
  type: "office" | "warehouse" | "remote" | "site";
}

interface LocationSelectorProps {
  locations: LocationItem[];
  selected: string;
  onSelect: (location: string) => void;
}

const iconMap = {
  office: Building2,
  warehouse: Warehouse,
  remote: Monitor,
  site: MapPin,
};

export default function LocationSelector({
  locations,
  selected,
  onSelect,
}: LocationSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {locations.map((loc) => {
        const Icon = iconMap[loc.type] || MapPin;
        const isSelected = selected === loc.name;

        return (
          <button
            key={loc.name}
            onClick={() => onSelect(loc.name)}
            className={cn(
              "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-200 text-left flex-shrink-0",
              "hover:shadow-md hover:-translate-y-px",
              isSelected
                ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 shadow-sm shadow-cyan-500/10"
                : "border-border/50 bg-card hover:border-border"
            )}
          >
            <div
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isSelected
                  ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div
                className={cn(
                  "text-sm font-semibold leading-tight",
                  isSelected ? "text-cyan-700 dark:text-cyan-300" : "text-foreground"
                )}
              >
                {loc.label}
              </div>
              <div className="text-[10px] text-muted-foreground capitalize">
                {loc.type}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
