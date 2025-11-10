import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getStats,
  exportData,
} from "@/lib/sqliteApiService";
import {
  Database,
  Download,
  RefreshCw,
  CheckCircle,
  Info,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const LocalDataStatus: React.FC = () => {
  const [stats, setStats] = useState(getStats());
  const [showDetails, setShowDetails] = useState(false);

  const refreshStats = () => {
    setStats(getStats());
  };

  const handleExportData = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hr-data-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (
      confirm(
        "Are you sure you want to clear all local data? This cannot be undone.",
      )
    ) {
      clearAllData();
      // Re-initialize with sample data
      initializeData();
      refreshStats();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Local Data Status</CardTitle>
          </div>
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        </div>
        <CardDescription>
          Your HR data is stored locally in your browser. No external database
          required!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Local Development Mode:</strong> All data is stored in your
            browser's localStorage. Data persists between sessions but is
            specific to this browser.
          </AlertDescription>
        </Alert>

        {/* Stats Display */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {stats.departments}
            </div>
            <div className="text-sm text-blue-700">Departments</div>
          </div>

          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {stats.activeEmployees}
            </div>
            <div className="text-sm text-green-700">Active Employees</div>
          </div>

          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {stats.openJobs}
            </div>
            <div className="text-sm text-purple-700">Open Jobs</div>
          </div>

          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {stats.candidates}
            </div>
            <div className="text-sm text-orange-700">Candidates</div>
          </div>

          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">
              {stats.employees}
            </div>
            <div className="text-sm text-gray-700">Total Employees</div>
          </div>

          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.jobs}
            </div>
            <div className="text-sm text-yellow-700">Total Jobs</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStats}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Data
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2"
          >
            <Info className="h-4 w-4" />
            {showDetails ? "Hide" : "Show"} Details
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearData}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Reset Data
          </Button>
        </div>

        {/* Detailed Info */}
        {showDetails && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Technical Details:</h4>
            <ul className="text-sm space-y-1 text-gray-600">
              <li>
                • Data stored in browser localStorage (
                {(JSON.stringify(exportData()).length / 1024).toFixed(1)} KB)
              </li>
              <li>• Automatic data initialization on first load</li>
              <li>• No external dependencies or API calls</li>
              <li>• Data persists between browser sessions</li>
              <li>• Export/import functionality available</li>
              <li>
                • Sample data includes {stats.departments} departments and{" "}
                {stats.employees} employees
              </li>
            </ul>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <strong>Benefits:</strong> Fast, reliable, works offline, no database
          setup required. Perfect for development and prototyping.
        </div>
      </CardContent>
    </Card>
  );
};
