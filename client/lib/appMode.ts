/**
 * App Mode Utilities
 * Determines and manages the current development mode (Development, Emulator, Production)
 * Maps to avatar colors: Yellow (Dev), Blue (Emulator), Green (Production)
 */

export type AppMode = "development" | "emulator" | "production";
export type ModeColor = "yellow" | "blue" | "green";

interface ModeInfo {
  mode: AppMode;
  color: ModeColor;
  label: string;
  description: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

const MODE_CONFIGS: Record<AppMode, ModeInfo> = {
  development: {
    mode: "development",
    color: "yellow",
    label: "Development",
    description: "Local development with database. No Firebase connection.",
    bgClass: "bg-yellow-600",
    textClass: "text-yellow-600",
    borderClass: "border-yellow-200",
  },
  emulator: {
    mode: "emulator",
    color: "blue",
    label: "Emulator Mode",
    description: "Connected to local Firebase Emulator Suite. Testing with realistic Firebase behavior.",
    bgClass: "bg-blue-600",
    textClass: "text-blue-600",
    borderClass: "border-blue-200",
  },
  production: {
    mode: "production",
    color: "green",
    label: "Production",
    description: "Connected to real Firebase backend. All changes are synced to production.",
    bgClass: "bg-green-600",
    textClass: "text-green-600",
    borderClass: "border-green-200",
  },
};

/**
 * Determines the current app mode based on environment variables and runtime state
 * @param isConnectedToFirebase - Whether the app is currently connected to Firebase
 * @returns The current AppMode
 */
export function getAppMode(isConnectedToFirebase: boolean = false): AppMode {
  // Check if using emulator
  if (import.meta.env.VITE_USE_EMULATORS === "true") {
    return "emulator";
  }

  // Check if in dev mode without emulator
  if (import.meta.env.DEV) {
    return "development";
  }

  // If connected to Firebase (production) or fallback
  return isConnectedToFirebase ? "production" : "development";
}

/**
 * Get the color for a specific app mode
 * @param mode - The AppMode to get color for
 * @returns The ModeColor
 */
export function getModeColor(mode: AppMode): ModeColor {
  return MODE_CONFIGS[mode].color;
}

/**
 * Get the Tailwind background class for a mode
 * @param mode - The AppMode
 * @returns Tailwind class string
 */
export function getModeBgClass(mode: AppMode): string {
  return MODE_CONFIGS[mode].bgClass;
}

/**
 * Get the Tailwind text color class for a mode
 * @param mode - The AppMode
 * @returns Tailwind class string
 */
export function getModeTextClass(mode: AppMode): string {
  return MODE_CONFIGS[mode].textClass;
}

/**
 * Get the Tailwind border color class for a mode
 * @param mode - The AppMode
 * @returns Tailwind class string
 */
export function getModeBorderClass(mode: AppMode): string {
  return MODE_CONFIGS[mode].borderClass;
}

/**
 * Get the human-readable label for a mode
 * @param mode - The AppMode
 * @returns Label string
 */
export function getModeLabel(mode: AppMode): string {
  return MODE_CONFIGS[mode].label;
}

/**
 * Get the description for a mode
 * @param mode - The AppMode
 * @returns Description string
 */
export function getModeDescription(mode: AppMode): string {
  return MODE_CONFIGS[mode].description;
}

/**
 * Get all mode information for a specific mode
 * @param mode - The AppMode
 * @returns Full ModeInfo object
 */
export function getModeInfo(mode: AppMode): ModeInfo {
  return MODE_CONFIGS[mode];
}

/**
 * Get all available modes with their info
 * @returns Array of all ModeInfo objects
 */
export function getAllModes(): ModeInfo[] {
  return Object.values(MODE_CONFIGS);
}

/**
 * Get the emoji/icon representation of a mode
 * @param mode - The AppMode
 * @returns Emoji string
 */
export function getModeEmoji(mode: AppMode): string {
  const emojiMap: Record<AppMode, string> = {
    development: "🟡",
    emulator: "🔵",
    production: "🟢",
  };
  return emojiMap[mode];
}

/**
 * Get the stored mode preference from localStorage
 * @returns Stored AppMode or null if not set
 */
export function getStoredModePreference(): AppMode | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("appMode_preference");
  if (stored && ["development", "emulator", "production"].includes(stored)) {
    return stored as AppMode;
  }
  return null;
}

/**
 * Save a mode preference to localStorage
 * @param mode - The AppMode to save
 */
export function setStoredModePreference(mode: AppMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("appMode_preference", mode);
}

/**
 * Clear stored mode preference
 */
export function clearStoredModePreference(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("appMode_preference");
}
