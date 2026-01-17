/**
 * Section Theme Configuration
 * Defines color theming for each major section of the app
 */

export type SectionId = "dashboard" | "people" | "payroll" | "money" | "accounting" | "reports";

export interface SectionTheme {
  id: SectionId;
  // Tailwind color classes
  text: string;           // Icon and accent text color
  textMuted: string;      // Lighter variant for secondary text
  bg: string;             // Background for badges, pills
  bgSubtle: string;       // Very subtle background tint
  border: string;         // Border accent color
  borderLeft: string;     // Left border for cards (4px accent)
  gradient: string;       // Gradient for headers/accents
  ring: string;           // Focus ring color
}

export const sectionThemes: Record<SectionId, SectionTheme> = {
  dashboard: {
    id: "dashboard",
    text: "text-slate-600 dark:text-slate-400",
    textMuted: "text-slate-500 dark:text-slate-500",
    bg: "bg-slate-100 dark:bg-slate-800",
    bgSubtle: "bg-slate-50 dark:bg-slate-900/50",
    border: "border-slate-300 dark:border-slate-700",
    borderLeft: "border-l-4 border-l-slate-500",
    gradient: "from-slate-500 to-slate-600",
    ring: "ring-slate-500",
  },
  people: {
    id: "people",
    text: "text-blue-600 dark:text-blue-400",
    textMuted: "text-blue-500 dark:text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    bgSubtle: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-300 dark:border-blue-800",
    borderLeft: "border-l-4 border-l-blue-500",
    gradient: "from-blue-500 to-blue-600",
    ring: "ring-blue-500",
  },
  payroll: {
    id: "payroll",
    text: "text-emerald-600 dark:text-emerald-400",
    textMuted: "text-emerald-500 dark:text-emerald-500",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    bgSubtle: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-300 dark:border-emerald-800",
    borderLeft: "border-l-4 border-l-emerald-500",
    gradient: "from-emerald-500 to-emerald-600",
    ring: "ring-emerald-500",
  },
  money: {
    id: "money",
    text: "text-teal-600 dark:text-teal-400",
    textMuted: "text-teal-500 dark:text-teal-500",
    bg: "bg-teal-100 dark:bg-teal-900/30",
    bgSubtle: "bg-teal-50 dark:bg-teal-950/30",
    border: "border-teal-300 dark:border-teal-800",
    borderLeft: "border-l-4 border-l-teal-500",
    gradient: "from-teal-500 to-teal-600",
    ring: "ring-teal-500",
  },
  accounting: {
    id: "accounting",
    text: "text-amber-600 dark:text-amber-400",
    textMuted: "text-amber-500 dark:text-amber-500",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    bgSubtle: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-300 dark:border-amber-800",
    borderLeft: "border-l-4 border-l-amber-500",
    gradient: "from-amber-500 to-amber-600",
    ring: "ring-amber-500",
  },
  reports: {
    id: "reports",
    text: "text-purple-600 dark:text-purple-400",
    textMuted: "text-purple-500 dark:text-purple-500",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    bgSubtle: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-300 dark:border-purple-800",
    borderLeft: "border-l-4 border-l-purple-500",
    gradient: "from-purple-500 to-purple-600",
    ring: "ring-purple-500",
  },
};

/**
 * Get section theme based on current path
 */
export function getSectionFromPath(pathname: string): SectionId {
  if (pathname.startsWith("/people") || pathname.startsWith("/staff") || pathname.startsWith("/hiring")) {
    return "people";
  }
  if (pathname.startsWith("/payroll")) {
    return "payroll";
  }
  if (pathname.startsWith("/money")) {
    return "money";
  }
  if (pathname.startsWith("/accounting")) {
    return "accounting";
  }
  if (pathname.startsWith("/reports")) {
    return "reports";
  }
  return "dashboard";
}

/**
 * Get theme for current section
 */
export function getThemeFromPath(pathname: string): SectionTheme {
  return sectionThemes[getSectionFromPath(pathname)];
}

/**
 * Navigation item colors (for MainNavigation)
 */
export const navColors: Record<SectionId, string> = {
  dashboard: "text-slate-600 dark:text-slate-400",
  people: "text-blue-500",
  payroll: "text-emerald-500",
  money: "text-teal-500",
  accounting: "text-amber-500",
  reports: "text-purple-500",
};

/**
 * Active indicator colors for navigation
 */
export const navActiveIndicator: Record<SectionId, string> = {
  dashboard: "bg-slate-500",
  people: "bg-blue-500",
  payroll: "bg-emerald-500",
  money: "bg-teal-500",
  accounting: "bg-amber-500",
  reports: "bg-purple-500",
};
