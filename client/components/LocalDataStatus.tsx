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

interface StatsData {
  employees: number;
  activeEmployees: number;
  departments: number;
  jobs: number;
  openJobs: number;
  candidates: number;
}

export const LocalDataStatus: React.FC = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<StatsData>({
    employees: 0,
    activeEmployees: 0,
    departments: 0,
    jobs: 0,
    openJobs: 0,
    candidates: 0,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSize, setDataSize] = useState(0);

  useEffect(() => {
    refreshStats();
  }, []);

  const refreshStats = async () => {
    try {
      setIsLoading(true);
      const newStats = await getStats();
      setStats(newStats);

      // Calculate approximate data size
      const data = await exportData();
      const size = JSON.stringify(data).length;
      setDataSize(size);
    } catch (error) {
      console.error("Error refreshing stats:", error);
      toast({
        title: "Error",
        description: "Failed to load statistics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportData();
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

      toast({
        title: "Export Successful",
        description: "Your data has been exported successfully",
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Database Status</CardTitle>
          </div>
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            SQLite Connected
          </Badge>
        </div>
        <CardDescription>
          Your HR data is stored in SQLite. Local development database ready for Firestore migration!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50">
          <Zap className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>SQLite Database Active:</strong> All data is stored in <code className="bg-blue-100 px-1 rounded">payroll.db</code> file.
            Fast local development, easy migration to Firestore when ready!
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
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Loading..." : "Refresh"}
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
        </div>

        {/* Detailed Info */}
        {showDetails && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Technical Details:</h4>
            <ul className="text-sm space-y-1 text-gray-600">
              <li>
                • Database file: <code className="bg-white px-1 rounded text-blue-600 font-mono">payroll.db</code>
              </li>
              <li>• Data size: {(dataSize / 1024).toFixed(2)} KB</li>
              <li>• Server: Express.js with TypeScript</li>
              <li>• ORM: better-sqlite3 (synchronous, fast)</li>
              <li>• API endpoints: <code className="bg-white px-1 rounded text-blue-600 font-mono">/api/employees, /api/departments, /api/jobs, /api/candidates</code></li>
              <li>• Firestore-compatible schema for easy migration</li>
              <li>
                • Current data: {stats.departments} departments, {stats.employees} employees, {stats.jobs} jobs, {stats.candidates} candidates
              </li>
            </ul>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-2">
          <div>
            <strong>Benefits:</strong>
          </div>
          <ul className="ml-4 space-y-1">
            <li>✅ <strong>Fast:</strong> Synchronous SQLite queries for instant responses</li>
            <li>✅ <strong>Real Database:</strong> Actual database file you can backup and inspect</li>
            <li>✅ <strong>Works Offline:</strong> No internet needed for development</li>
            <li>✅ <strong>Firestore Ready:</strong> Schema designed for easy cloud migration</li>
            <li>✅ <strong>Scalable:</strong> Start local, move to Firestore without code changes</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
