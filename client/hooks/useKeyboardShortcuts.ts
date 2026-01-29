/**
 * useKeyboardShortcuts - Global keyboard shortcuts for power users
 * Enables quick navigation and actions without mouse
 */

import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface ShortcutConfig {
  /** Enable shortcuts (default: true) */
  enabled?: boolean;
  /** Callback when shortcut dialog should open */
  onShowHelp?: () => void;
}

/**
 * Global keyboard shortcuts:
 *
 * Navigation (g + key):
 * - g d - Go to Dashboard
 * - g e - Go to Employees
 * - g p - Go to Payroll
 * - g r - Go to Reports
 * - g s - Go to Settings
 *
 * Actions (Cmd/Ctrl + key):
 * - Cmd+K - Open command palette (future)
 * - Cmd+/ - Show keyboard shortcuts help
 *
 * Quick Actions:
 * - n e - New employee
 * - n l - New leave request
 */
export function useKeyboardShortcuts(config: ShortcutConfig = {}) {
  const { enabled = true, onShowHelp } = config;
  const navigate = useNavigate();

  // Track if 'g' or 'n' was pressed for two-key shortcuts
  let pendingPrefix: string | null = null;
  let pendingTimeout: NodeJS.Timeout | null = null;

  const clearPending = useCallback(() => {
    pendingPrefix = null;
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if user is typing in an input/textarea
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    const isMeta = event.metaKey || event.ctrlKey;

    // Meta key shortcuts
    if (isMeta) {
      switch (key) {
        case "/":
          event.preventDefault();
          onShowHelp?.();
          return;
        case "k":
          event.preventDefault();
          // Future: Open command palette
          return;
      }
    }

    // Two-key navigation shortcuts (g + key)
    if (pendingPrefix === "g") {
      clearPending();
      event.preventDefault();

      switch (key) {
        case "d":
          navigate("/");
          return;
        case "e":
          navigate("/people/employees");
          return;
        case "p":
          navigate("/payroll");
          return;
        case "r":
          navigate("/reports");
          return;
        case "s":
          navigate("/settings");
          return;
        case "a":
          navigate("/accounting");
          return;
      }
    }

    // Two-key action shortcuts (n + key = new)
    if (pendingPrefix === "n") {
      clearPending();
      event.preventDefault();

      switch (key) {
        case "e":
          navigate("/people/add");
          return;
        case "l":
          navigate("/people/leave");
          return;
        case "j":
          navigate("/people/jobs");
          return;
      }
    }

    // Start two-key sequence
    if (key === "g" || key === "n") {
      pendingPrefix = key;
      // Clear after 1 second if second key not pressed
      pendingTimeout = setTimeout(clearPending, 1000);
      return;
    }

    // Single key shortcuts
    if (key === "?" && !isMeta) {
      onShowHelp?.();
    }
  }, [enabled, navigate, onShowHelp, clearPending]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearPending();
    };
  }, [enabled, handleKeyDown, clearPending]);
}

/**
 * Shortcut definitions for help dialog
 */
export const KEYBOARD_SHORTCUTS = [
  {
    category: "Navigation",
    shortcuts: [
      { keys: ["g", "d"], description: "Go to Dashboard" },
      { keys: ["g", "e"], description: "Go to Employees" },
      { keys: ["g", "p"], description: "Go to Payroll" },
      { keys: ["g", "r"], description: "Go to Reports" },
      { keys: ["g", "s"], description: "Go to Settings" },
      { keys: ["g", "a"], description: "Go to Accounting" },
    ],
  },
  {
    category: "Quick Actions",
    shortcuts: [
      { keys: ["n", "e"], description: "New Employee" },
      { keys: ["n", "l"], description: "New Leave Request" },
      { keys: ["n", "j"], description: "New Job Posting" },
    ],
  },
  {
    category: "General",
    shortcuts: [
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Cmd", "/"], description: "Show keyboard shortcuts" },
    ],
  },
];

export default useKeyboardShortcuts;
