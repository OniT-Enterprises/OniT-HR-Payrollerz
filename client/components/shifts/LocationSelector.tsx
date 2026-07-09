import React from "react";
import { cn } from "@/lib/utils";
import { Building2, Warehouse, Monitor, MapPin, Settings } from "lucide-react";

export interface LocationItem {
  name: string;
  label: string;
  /** Secondary line under the name (city, or "Headquarters") */
  sublabel?: string;
  type: "office" | "warehouse" | "remote" | "site";
}

interface LocationSelectorProps {
  locations: LocationItem[];
  selected: string;
  onSelect: (location: string) => void;
  /** Called when the gear on a card is clicked (also selects that location) */
  onOpenSettings?: (location: string) => void;
  /** Whether the settings panel is currently open (highlights the selected card's gear) */
  settingsOpen?: boolean;
  /** Accessible label for the gear button */
  settingsLabel?: string;
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
  onOpenSettings,
  settingsOpen,
  settingsLabel,
}: LocationSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {locations.map((loc) => {
        const Icon = iconMap[loc.type] || MapPin;
        const isSelected = selected === loc.name;

        return (
          <div key={loc.name} className="relative shrink-0">
            <button
              onClick={() => onSelect(loc.name)}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-200 text-left whitespace-nowrap",
                "hover:shadow-md hover:-translate-y-px",
                onOpenSettings && "pr-9",
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
                {loc.sublabel && (
                  <div className="text-[10px] text-muted-foreground">{loc.sublabel}</div>
                )}
              </div>
            </button>
            {onOpenSettings && (
              <button
                onClick={() => onOpenSettings(loc.name)}
                aria-label={settingsLabel}
                title={settingsLabel}
                className={cn(
                  "absolute bottom-1 right-1 h-6 w-6 rounded-md flex items-center justify-center transition-colors",
                  settingsOpen && isSelected
                    ? "text-cyan-600 dark:text-cyan-400 bg-cyan-500/15"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-muted"
                )}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
