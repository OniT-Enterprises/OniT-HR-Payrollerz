import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  isFirebaseReady,
  getFirebaseError,
} from "@/lib/firebase";
import { testFirebaseConnection, getFirebaseStatus } from "@/lib/firebaseManager";

interface FirebaseContextType {
  isOnline: boolean;
  isConnected: boolean;
  error: string | null;
  isUsingMockData: boolean;
  retryConnection: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(
  undefined,
);

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
};

interface FirebaseProviderProps {
  children: ReactNode;
}

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  const checkConnection = async () => {
    try {
      // Check network first
      if (!navigator.onLine) {
        console.warn("🌐 No network connection detected");
        setError("No internet connection");
        setIsConnected(false);
        setIsUsingMockData(true);
        return;
      }

      if (!isFirebaseReady()) {
        console.warn("⚠️ Firebase not ready");
        setError(getFirebaseError() || "Firebase not initialized");
        setIsConnected(false);
        setIsUsingMockData(true);
        return;
      }

      // Test connection to Firebase emulator
      let connected = false;
      try {
        connected = await testFirebaseConnection();
      } catch (connectionError: any) {
        console.warn("🔥 Firebase connection test failed:", connectionError);

        // Handle specific Firebase internal errors gracefully
        if (connectionError.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.warn("🚨 Firebase internal error detected - using fallback mode");
          setError("Firebase experiencing internal issues - using demo data");
        } else if (
          connectionError instanceof TypeError ||
          connectionError.message?.includes("Failed to fetch") ||
          connectionError.message?.includes("fetch")
        ) {
          console.warn("🌐 Network fetch error detected, using offline mode");
          setError("Network error - using demo data");
        } else {
          console.warn("🚫 Other connection error:", connectionError);
          setError("Connection failed - using demo data");
        }
        connected = false;
      }

      setIsConnected(connected);
      setIsUsingMockData(!connected);

      if (connected) {
        setError(null);
        console.log("✅ Firebase Emulator connection established");
      }
    } catch (err: any) {
      console.error("❌ Critical error in checkConnection:", err);

      // Ensure we always set safe fallback state
      setError("Connection check failed - using demo data");
      setIsConnected(false);
      setIsUsingMockData(true);
    }
  };

  const retryConnection = async () => {
    setError(null);
    await checkConnection();
  };

  useEffect(() => {
    console.log('🚀 FirebaseProvider initializing with Firebase Emulator');

    const handleOnline = () => {
      setIsOnline(true);
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
      setIsUsingMockData(true);
      setError('Device is offline');
    };

    // Initial connection check
    checkConnection();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const value: FirebaseContextType = {
    isOnline,
    isConnected,
    error,
    isUsingMockData,
    retryConnection,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};
