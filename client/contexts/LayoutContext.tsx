import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ComponentType,
} from "react";

export interface LayoutPageHeader {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
  iconColor?: string;
}

interface LayoutContextValue {
  /** Whether the sidebar layout is active (used by MainNavigation/ModuleSectionNav to no-op) */
  active: true;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  toggleCollapsed: () => void;
  pageHeader: LayoutPageHeader | null;
  setPageHeader: (header: LayoutPageHeader | null) => void;
  clearPageHeader: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

const COLLAPSED_KEY = "meza-sidebar-collapsed";

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pageHeader, setPageHeader] = useState<LayoutPageHeader | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      // ignore persistence failures
    }
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const toggleCollapsed = useCallback(() => setSidebarCollapsed((v) => !v), []);
  const clearPageHeader = useCallback(() => setPageHeader(null), []);

  return (
    <LayoutContext.Provider
      value={{
        active: true,
        sidebarOpen,
        setSidebarOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        toggleCollapsed,
        pageHeader,
        setPageHeader,
        clearPageHeader,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}

/** Safe check — returns null if no layout is active (used by MainNavigation no-op) */
// eslint-disable-next-line react-refresh/only-export-components
export function useLayoutOptional() {
  return useContext(LayoutContext);
}
