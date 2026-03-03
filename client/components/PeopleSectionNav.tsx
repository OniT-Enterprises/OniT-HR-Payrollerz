/**
 * PeopleSectionNav — Smart expanding sub-navigation for people pages.
 *
 * Modes:
 *   - (default) Smart auto mode: expands on leaf pages, collapsed on overview pages
 *   - "collapsed": Always shows Staff | Hiring | Performance only
 *   - "expanded": Only shows the active section's sub-pages (no other section anchors)
 *
 *   Staff overview:       [ Staff* | Hiring | Performance ]
 *   Staff leaf page:      [ Employees* | Announcements | Grievances | Hiring | Performance ]
 *   Hiring overview:      [ Staff | Hiring* | Performance ]
 *   Hiring leaf page:     [ Staff | Jobs* | Candidates | Interviews | Onboarding | Offboarding | Performance ]
 *   Performance overview: [ Staff | Hiring | Performance* ]
 *   Performance leaf:     [ Staff | Hiring | Goals* | Reviews | Training | Disciplinary ]
 */

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Users,
  Briefcase,
  Target,
  UserCheck,
  Calendar,
  UserPlus,
  UserMinus,
  Award,
  GraduationCap,
  Shield,
  Megaphone,
  MessageSquare,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Section {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;          // overview page path (anchor target)
  matchPaths: string[];  // all paths that belong to this section
  subPages: NavItem[];   // leaf pages shown when expanded
}

const sections: Section[] = [
  {
    id: "staff",
    label: "Staff",
    icon: Users,
    path: "/people/staff",
    matchPaths: ["/people/staff", "/people/employees", "/people/add", "/people/announcements", "/people/grievances"],
    subPages: [
      { label: "Employees", path: "/people/employees", icon: Users },
      { label: "Announcements", path: "/people/announcements", icon: Megaphone },
      { label: "Grievances", path: "/people/grievances", icon: MessageSquare },
    ],
  },
  {
    id: "hiring",
    label: "Hiring",
    icon: Briefcase,
    path: "/people/hiring",
    matchPaths: ["/people/hiring", "/people/jobs", "/people/candidates", "/people/interviews", "/people/onboarding", "/people/offboarding"],
    subPages: [
      { label: "Jobs", path: "/people/jobs", icon: Briefcase },
      { label: "Candidates", path: "/people/candidates", icon: UserCheck },
      { label: "Interviews", path: "/people/interviews", icon: Calendar },
      { label: "Onboarding", path: "/people/onboarding", icon: UserPlus },
      { label: "Offboarding", path: "/people/offboarding", icon: UserMinus },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    icon: Target,
    path: "/people/performance",
    matchPaths: ["/people/performance", "/people/goals", "/people/reviews", "/people/training", "/people/disciplinary"],
    subPages: [
      { label: "Goals", path: "/people/goals", icon: Target },
      { label: "Reviews", path: "/people/reviews", icon: Award },
      { label: "Training", path: "/people/training", icon: GraduationCap },
      { label: "Disciplinary", path: "/people/disciplinary", icon: Shield },
    ],
  },
];

function isPathActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(path + "/");
}

interface PeopleSectionNavProps {
  /** "collapsed" = always show section anchors only; "expanded" = always show sub-pages for active section */
  mode?: "collapsed" | "expanded";
}

export default function PeopleSectionNav({ mode }: PeopleSectionNavProps = {}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Find which section is active
  const activeSection = sections.find((s) =>
    s.matchPaths.some((mp) => isPathActive(pathname, mp))
  );

  // Build the flat list of tabs to render
  const tabs: { key: string; label: string; path: string; icon: React.ComponentType<{ className?: string }>; active: boolean; isAnchor: boolean }[] = [];

  for (const section of sections) {
    const isSectionActive = section.id === activeSection?.id;
    const isOnOverviewPage = pathname === section.path;

    // In "expanded" mode, skip non-active sections entirely (only show sub-pages)
    if (mode === "expanded" && !isSectionActive) continue;

    // Decide whether to expand this section
    const shouldExpand = mode === "expanded"
      ? section.subPages.length > 0
      : mode === "collapsed"
        ? false
        : isSectionActive && section.subPages.length > 0 && !isOnOverviewPage;

    if (shouldExpand) {
      for (const sub of section.subPages) {
        tabs.push({
          key: sub.path,
          label: sub.label,
          path: sub.path,
          icon: sub.icon,
          active: isPathActive(pathname, sub.path),
          isAnchor: false,
        });
      }
    } else {
      tabs.push({
        key: section.id,
        label: section.label,
        path: section.path,
        icon: section.icon,
        active: isSectionActive,
        isAnchor: true,
      });
    }
  }

  return (
    <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="People sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap
                border-b-2 transition-colors
                ${tab.active
                  ? "border-blue-500 text-blue-600 dark:text-blue-400 font-medium"
                  : tab.isAnchor
                    ? "border-transparent text-muted-foreground hover:text-foreground hover:border-border font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }
              `}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
