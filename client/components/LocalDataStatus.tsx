import React, { useState } from "react";
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
  Database,
  Info,
  Zap,
  ExternalLink,
} from "lucide-react";

export const LocalDataStatus: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);

  const emulatorPorts = {
    firestore: 8080,
    auth: 9099,
    ui: 4000,
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Database Status</CardTitle>
          </div>
          <Badge variant="outline" className="text-orange-600">
            <Zap className="h-3 w-3 mr-1" />
            Firebase Emulator
          </Badge>
        </div>
        <CardDescription>
          Your HR data is stored in Firebase Firestore emulator. Local development environment running locally.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-orange-200 bg-orange-50">
          <Zap className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-900">
            <strong>Firebase Emulator Active:</strong> All data is stored in the local Firestore emulator.
            Start with <code className="bg-orange-100 px-1 rounded">npm run emulators:ui</code> to access the emulator UI.
          </AlertDescription>
        </Alert>

        {/* Emulator Ports Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-mono text-blue-600 font-medium mb-1">
              localhost:{emulatorPorts.firestore}
            </div>
            <div className="text-sm text-blue-700">Firestore Emulator</div>
          </div>

          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-sm font-mono text-purple-600 font-medium mb-1">
              localhost:{emulatorPorts.auth}
            </div>
            <div className="text-sm text-purple-700">Auth Emulator</div>
          </div>

          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm font-mono text-green-600 font-medium mb-1">
              localhost:{emulatorPorts.ui}
            </div>
            <div className="text-sm text-green-700">Emulator UI</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("http://localhost:4000", "_blank")}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open Emulator UI
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
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div>
              <h4 className="font-medium mb-2">Quick Start:</h4>
              <ol className="text-sm space-y-2 text-gray-600 ml-4 list-decimal">
                <li>Run <code className="bg-white px-1 rounded text-blue-600 font-mono">npm run emulators:ui</code></li>
                <li>Open <code className="bg-white px-1 rounded text-blue-600 font-mono">http://localhost:4000</code> in your browser</li>
                <li>View and manage Firestore collections and documents</li>
                <li>Data automatically persists in <code className="bg-white px-1 rounded text-blue-600 font-mono">firebaseemulator_payroll/</code></li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium mb-2">Useful Commands:</h4>
              <ul className="text-sm space-y-1 text-gray-600 ml-4 space-y-2">
                <li>• <code className="bg-white px-1 rounded text-blue-600 font-mono">npm run seed:dev</code> - Populate with test data</li>
                <li>• <code className="bg-white px-1 rounded text-blue-600 font-mono">npm run reset:emulator</code> - Clear all emulator data</li>
                <li>• <code className="bg-white px-1 rounded text-blue-600 font-mono">npm run emulators</code> - Start only Firestore & Auth (no UI)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Environment Configuration:</h4>
              <ul className="text-sm space-y-1 text-gray-600 ml-4 space-y-2">
                <li>• Config file: <code className="bg-white px-1 rounded text-blue-600 font-mono">.env.emulator</code></li>
                <li>• Firestore Rules: <code className="bg-white px-1 rounded text-blue-600 font-mono">firestore.rules</code></li>
                <li>• Data persists: <code className="bg-white px-1 rounded text-blue-600 font-mono">firebaseemulator_payroll/</code> directory</li>
              </ul>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-2">
          <div>
            <strong>Benefits:</strong>
          </div>
          <ul className="ml-4 space-y-1">
            <li>✅ <strong>Local Development:</strong> No internet needed to develop</li>
            <li>✅ <strong>Data Persistence:</strong> Automatic save and restore between sessions</li>
            <li>✅ <strong>Real Firestore:</strong> Identical to production Firestore behavior</li>
            <li>✅ <strong>Easy Testing:</strong> Reset data with one command</li>
            <li>✅ <strong>Visual Management:</strong> Browse and edit data via Emulator UI</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
