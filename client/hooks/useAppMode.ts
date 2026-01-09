import { useState, useEffect } from "react";
import { useFirebase } from "@/contexts/FirebaseContext";
import {
  getAppMode,
  getModeColor,
  getModeLabel,
  getModeDescription,
  getModeBgClass,
  getModeTextClass,
  getModeBorderClass,
  getModeEmoji,
  AppMode,
  ModeColor,
} from "@/lib/appMode";

export interface AppModeState {
  mode: AppMode;
  color: ModeColor;
  label: string;
  description: string;
  emoji: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  isConnected: boolean;
  isLoading: boolean;
}

/**
 * Hook to get the current app mode with automatic detection based on Firebase connection state
 * Updates reactively when Firebase connection state changes
 * @returns AppModeState with current mode info and connection state
 */
export function useAppMode(): AppModeState {
  const { isConnected } = useFirebase();
  const [isLoading, setIsLoading] = useState(true);

  // Get the current mode based on Firebase connection
  const mode = getAppMode(isConnected);

  // Derive all mode info from the mode
  useEffect(() => {
    // Mark as loaded after first render
    setIsLoading(false);
  }, []);

  return {
    mode,
    color: getModeColor(mode),
    label: getModeLabel(mode),
    description: getModeDescription(mode),
    emoji: getModeEmoji(mode),
    bgClass: getModeBgClass(mode),
    textClass: getModeTextClass(mode),
    borderClass: getModeBorderClass(mode),
    isConnected,
    isLoading,
  };
}

/**
 * Hook to get just the mode color (useful for Avatar components)
 * @returns The current ModeColor
 */
export function useModeColor(): ModeColor {
  const { mode, color } = useAppMode();
  return color;
}

/**
 * Hook to get just the Tailwind background class
 * @returns The background class string
 */
export function useModeBgClass(): string {
  const { bgClass } = useAppMode();
  return bgClass;
}

/**
 * Hook to determine if user can switch to a specific mode
 * For now, returns true for all modes in development
 * @param targetMode - The mode to check
 * @returns true if the mode can be switched to
 */
export function useCanSwitchMode(targetMode: AppMode): boolean {
  const { mode } = useAppMode();

  // Can't switch to the current mode
  if (targetMode === mode) {
    return false;
  }

  // Production mode requires actual Firebase connection
  // In development, we allow all switches, but UI will warn about requirements
  return true;
}
