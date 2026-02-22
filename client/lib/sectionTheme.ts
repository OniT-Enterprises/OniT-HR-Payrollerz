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
    text: "text-green-600 dark:text-green-400",
    textMuted: "text-green-500 dark:text-green-500",
    bg: "bg-green-100 dark:bg-green-900/30",
    bgSubtle: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-300 dark:border-green-800",
    borderLeft: "border-l-4 border-l-green-500",
    gradient: "from-green-500 to-emerald-500",
    ring: "ring-green-500",
  },
  money: {
    id: "money",
    text: "text-indigo-600 dark:text-indigo-400",
    textMuted: "text-indigo-500 dark:text-indigo-500",
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    bgSubtle: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-300 dark:border-indigo-800",
    borderLeft: "border-l-4 border-l-indigo-500",
    gradient: "from-indigo-500 to-indigo-600",
    ring: "ring-indigo-500",
  },
  accounting: {
    id: "accounting",
    text: "text-orange-600 dark:text-orange-400",
    textMuted: "text-orange-500 dark:text-orange-500",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    bgSubtle: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-300 dark:border-orange-800",
    borderLeft: "border-l-4 border-l-orange-500",
    gradient: "from-orange-500 to-amber-500",
    ring: "ring-orange-500",
  },
  reports: {
    id: "reports",
    text: "text-violet-600 dark:text-violet-400",
    textMuted: "text-violet-500 dark:text-violet-500",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    bgSubtle: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-300 dark:border-violet-800",
    borderLeft: "border-l-4 border-l-violet-500",
    gradient: "from-violet-500 to-purple-500",
    ring: "ring-violet-500",
  },
};

/**
 * Navigation item colors (for MainNavigation)
 */
export const navColors: Record<SectionId, string> = {
  dashboard: "text-slate-600 dark:text-slate-400",
  people: "text-blue-500",
  payroll: "text-green-500",
  money: "text-indigo-500",
  accounting: "text-orange-500",
  reports: "text-violet-500",
};

/**
 * Active indicator colors for navigation
 */
export const navActiveIndicator: Record<SectionId, string> = {
  dashboard: "bg-slate-500",
  people: "bg-blue-500",
  payroll: "bg-green-500",
  money: "bg-indigo-500",
  accounting: "bg-orange-500",
  reports: "bg-violet-500",
};
