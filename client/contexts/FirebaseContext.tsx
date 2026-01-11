import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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

  const checkConnection = async () => {
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
      console.log("✅ Firebase connected");
    } catch (err: any) {
      // Permission denied is actually a successful connection - Firebase is reachable
      if (err.code === "permission-denied") {
        setIsConnected(true);
        setError(null);
        console.log("✅ Firebase connected (auth required for data)");
      } else {
        console.error("Firebase connection error:", err);
        setError(err.message || "Connection failed");
        setIsConnected(false);
      }
    }
  };

  const retryConnection = async () => {
    setError(null);
    await checkConnection();
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
      setError("Device is offline");
    };

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
    retryConnection,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};
