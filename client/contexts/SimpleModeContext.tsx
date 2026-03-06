import React, { createContext, useContext, useState } from "react";

interface SimpleModeContextType {
  isSimple: boolean;
  toggleSimpleMode: () => void;
}

const SimpleModeContext = createContext<SimpleModeContextType | undefined>(undefined);

export function SimpleModeProvider({ children }: { children: React.ReactNode }) {
  const [isSimple, setIsSimple] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("simpleMode") === "true";
    }
    return false;
  });

  const toggleSimpleMode = () => {
    setIsSimple((prev) => {
      const next = !prev;
      localStorage.setItem("simpleMode", String(next));
      return next;
    });
  };

  return (
    <SimpleModeContext.Provider value={{ isSimple, toggleSimpleMode }}>
      {children}
    </SimpleModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSimpleMode() {
  const context = useContext(SimpleModeContext);
  if (context === undefined) {
    throw new Error("useSimpleMode must be used within a SimpleModeProvider");
  }
  return context;
}
