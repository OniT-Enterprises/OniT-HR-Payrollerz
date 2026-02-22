import React, { createContext, useContext, useState } from "react";

interface GuidanceContextType {
  guidanceEnabled: boolean;
  toggleGuidance: () => void;
}

const GuidanceContext = createContext<GuidanceContextType | undefined>(undefined);

export function GuidanceProvider({ children }: { children: React.ReactNode }) {
  const [guidanceEnabled, setGuidanceEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("guidanceEnabled");
      return stored === null ? true : stored === "true";
    }
    return true;
  });

  const toggleGuidance = () => {
    setGuidanceEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("guidanceEnabled", String(next));
      return next;
    });
  };

  return (
    <GuidanceContext.Provider value={{ guidanceEnabled, toggleGuidance }}>
      {children}
    </GuidanceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGuidance() {
  const context = useContext(GuidanceContext);
  if (context === undefined) {
    throw new Error("useGuidance must be used within a GuidanceProvider");
  }
  return context;
}
