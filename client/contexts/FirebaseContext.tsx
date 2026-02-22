import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

interface FirebaseContextType {
  isOnline: boolean;
  isConnected: boolean;
  error: string | null;
  retryConnection: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(
  undefined,
);

// eslint-disable-next-line react-refresh/only-export-components
const useFirebase = () => {
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
  // Assume connected when online - actual connection verified lazily on first query
  const [isConnected, setIsConnected] = useState(navigator.onLine);
  const [error, setError] = useState<string | null>(null);

  // Only verify connection when explicitly requested (e.g., after error)
  const checkConnection = useCallback(async () => {
    try {
      if (!navigator.onLine) {
        setError("No internet connection");
        setIsConnected(false);
        return;
      }

      // Test Firestore connection with a simple query
      const testQuery = query(collection(db, "_connection_test"), limit(1));
      await getDocs(testQuery);

      setIsConnected(true);
      setError(null);
    } catch (err: any) {
      // Permission denied is actually a successful connection - Firebase is reachable
      if (err.code === "permission-denied") {
        setIsConnected(true);
        setError(null);
      } else {
        console.error("Firebase connection error:", err);
        setError(err.message || "Connection failed");
        setIsConnected(false);
      }
    }
  }, []);

  const retryConnection = useCallback(async () => {
    setError(null);
    await checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsConnected(true);
      setError(null);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
      setError("Device is offline");
    };

    // No startup connection check - assume connected when online
    // Connection will be verified naturally on first actual data fetch

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
    retryConnection,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};
