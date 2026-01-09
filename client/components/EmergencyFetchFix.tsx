import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import {
  emergencyRestoreFetch,
  forceDisableAllFirebaseBlocking,
} from "../lib/emergencyFetchFix";
import { AlertTriangle, Wrench } from "lucide-react";

export const EmergencyFetchFix: React.FC = () => {
  const [message, setMessage] = useState("");

  const handleEmergencyFix = () => {
    try {
      setMessage("🚨 Running emergency fetch fix...");
      forceDisableAllFirebaseBlocking();
      setMessage(
        "✅ Emergency fix completed! Try your Firebase operations now.",
      );
    } catch (error: any) {
      setMessage(`❌ Fix failed: ${error.message}`);
    }
  };

  const handleTestFetch = async () => {
    try {
      setMessage("🔍 Testing fetch function...");
      const response = await fetch("https://httpbin.org/json");
      const data = await response.json();
      setMessage("✅ Fetch test successful - network requests are working");
    } catch (error: any) {
      setMessage(`❌ Fetch test failed: ${error.message}`);
    }
  };

  return (
    <Card className="mb-4 border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <AlertTriangle className="h-5 w-5" />
          Emergency Network Fix
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertDescription>
            If you're getting "Failed to fetch" errors when trying to save data,
            click the emergency fix below.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={handleEmergencyFix}
            className="flex items-center gap-2"
          >
            <Wrench className="h-4 w-4" />
            Emergency Fix
          </Button>
          <Button onClick={handleTestFetch} variant="outline">
            Test Network
          </Button>
          <Button onClick={() => window.location.reload()} variant="secondary">
            Refresh Page
          </Button>
        </div>

        {message && (
          <Alert
            className={
              message.includes("✅")
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
          >
            <AlertDescription
              className={
                message.includes("✅") ? "text-green-700" : "text-red-700"
              }
            >
              {message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
