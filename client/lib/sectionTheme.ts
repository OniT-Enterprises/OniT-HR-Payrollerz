/**
 * Section Theme Configuration
 * Defines color theming for each major section of the app
 */

export type SectionId = "dashboard" | "people" | "scheduling" | "payroll" | "money" | "accounting" | "reports";

interface SectionTheme {
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
    text: "text-primary dark:text-primary",
    textMuted: "text-primary/70 dark:text-primary/70",
    bg: "bg-primary/10 dark:bg-primary/20",
    bgSubtle: "bg-primary/5 dark:bg-primary/10",
    border: "border-primary/30 dark:border-primary/30",
    borderLeft: "border-l-4 border-l-primary",
    gradient: "from-primary to-primary",
    ring: "ring-primary",
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
  scheduling: {
    id: "scheduling",
    text: "text-cyan-600 dark:text-cyan-400",
    textMuted: "text-cyan-500 dark:text-cyan-500",
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    bgSubtle: "bg-cyan-50 dark:bg-cyan-950/30",
    border: "border-cyan-300 dark:border-cyan-800",
    borderLeft: "border-l-4 border-l-cyan-500",
    gradient: "from-cyan-500 to-teal-500",
    ring: "ring-cyan-500",
  },
  payroll: {
    id: "payroll",
    text: "text-primary dark:text-primary",
    textMuted: "text-primary/70 dark:text-primary/70",
    bg: "bg-primary/10 dark:bg-primary/20",
    bgSubtle: "bg-primary/5 dark:bg-primary/10",
    border: "border-primary/30 dark:border-primary/30",
    borderLeft: "border-l-4 border-l-primary",
    gradient: "from-primary to-primary",
    ring: "ring-primary",
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
  dashboard: "text-primary",
  people: "text-blue-500",
  scheduling: "text-cyan-500",
  payroll: "text-primary",
  money: "text-indigo-500",
  accounting: "text-orange-500",
  reports: "text-violet-500",
};

/**
 * Active indicator colors for navigation
 */
export const navActiveIndicator: Record<SectionId, string> = {
  dashboard: "bg-primary",
  people: "bg-blue-500",
  scheduling: "bg-cyan-500",
  payroll: "bg-primary",
  money: "bg-indigo-500",
  accounting: "bg-orange-500",
  reports: "bg-violet-500",
};

/**
 * Tree-line border colors for sidebar navigation (30% opacity)
 * Static classes so Tailwind can detect them at build time.
 */
export const navTreeLine: Record<SectionId, string> = {
  dashboard: "border-primary/30",
  people: "border-blue-500/30",
  scheduling: "border-cyan-500/30",
  payroll: "border-primary/30",
  money: "border-indigo-500/30",
  accounting: "border-orange-500/30",
  reports: "border-violet-500/30",
};
