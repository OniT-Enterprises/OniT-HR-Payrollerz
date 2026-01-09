import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { restoreFetch, checkFetchStatus } from "../lib/fetchRestore";

export const FetchDiagnostic: React.FC = () => {
  const [fetchStatus, setFetchStatus] = useState(checkFetchStatus());
  const [message, setMessage] = useState<string>("");

  const refreshStatus = () => {
    setFetchStatus(checkFetchStatus());
  };

  const handleRestoreFetch = () => {
    try {
      restoreFetch();
      setMessage("✅ Fetch function restored successfully");
      setTimeout(refreshStatus, 100);
    } catch (error: any) {
      setMessage(`❌ Error restoring fetch: ${error.message}`);
    }
  };

  const handleTestFetch = async () => {
    try {
      setMessage("🔍 Testing fetch...");
      const response = await fetch("https://httpbin.org/json");
      const data = await response.json();
      setMessage("✅ Fetch test successful - network requests are working");
    } catch (error: any) {
      setMessage(`❌ Fetch test failed: ${error.message}`);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const getStatusBadge = () => {
    if (fetchStatus.isOverridden || fetchStatus.isCustom) {
      return <Badge variant="destructive">OVERRIDDEN</Badge>;
    } else {
      return <Badge variant="default">NORMAL</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Network Fetch Diagnostic</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <strong>Fetch Status:</strong>{" "}
            {fetchStatus.isOverridden ? "Overridden" : "Normal"}
            <br />
            <strong>Has Original:</strong>{" "}
            {fetchStatus.hasOriginal ? "Yes" : "No"}
            <br />
            <strong>Is Custom:</strong> {fetchStatus.isCustom ? "Yes" : "No"}
            <br />
            <strong>Is Native:</strong>{" "}
            {fetchStatus.fetchInfo.isNative ? "Yes" : "No"}
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={handleRestoreFetch}
            variant={fetchStatus.isOverridden ? "default" : "outline"}
          >
            Restore Fetch
          </Button>
          <Button onClick={handleTestFetch} variant="secondary">
            Test Fetch
          </Button>
          <Button onClick={refreshStatus} variant="outline">
            Refresh Status
          </Button>
        </div>

        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground">
          <strong>Note:</strong> If fetch is overridden, Firebase requests will
          fail with "Failed to fetch" errors. Use "Restore Fetch" to fix this
          issue.
        </div>
      </CardContent>
    </Card>
  );
};
