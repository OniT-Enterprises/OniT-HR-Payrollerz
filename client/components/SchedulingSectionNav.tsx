/**
 * SchedulingSectionNav — Persistent sub-navigation for scheduling work pages.
 * Shows the 4 scheduling sections as tab-like links so the user always
 * knows where they are and can switch without going back to the hub.
 */

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Clock, Calendar, CalendarDays, UserCheck } from "lucide-react";

const sections = [
  { label: "Time Tracking", path: "/scheduling/time-tracking", icon: Clock },
  { label: "Attendance", path: "/scheduling/attendance", icon: Calendar },
  { label: "Leave Requests", path: "/scheduling/leave", icon: CalendarDays },
  { label: "Shift Schedules", path: "/scheduling/schedules", icon: UserCheck },
] as const;

export default function SchedulingSectionNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Scheduling sections">
          {sections.map((s) => {
            const active = pathname.startsWith(s.path);
            return (
              <button
                key={s.path}
                onClick={() => navigate(s.path)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                  border-b-2 transition-colors
                  ${active
                    ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }
                `}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
