import React, { useState } from "react";
import { useAppMode } from "@/hooks/useAppMode";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getAllModes,
  getModeEmoji,
  setStoredModePreference,
  AppMode,
} from "@/lib/appMode";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export const ModeSelector: React.FC = () => {
  const appMode = useAppMode();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const allModes = getAllModes();

  const handleModeSwitch = (targetMode: AppMode) => {
    if (targetMode === appMode.mode) {
      return;
    }

    // Show warning about page reload requirement
    setIsLoading(true);
    setStoredModePreference(targetMode);

    toast({
      title: "Mode Preference Saved",
      description: `Switching to ${targetMode} mode. Refresh the page to apply changes.`,
    });

    // Simulate a delay, then reset loading state
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {/* Current Mode Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Development Mode</CardTitle>
              <CardDescription>
                Your application is running in {appMode.label} mode
              </CardDescription>
            </div>
            <div
              className={`px-4 py-2 rounded-lg ${appMode.bgClass} text-white font-semibold`}
            >
              {getModeEmoji(appMode.mode)} {appMode.label}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {appMode.description}
          </p>

          {appMode.mode === "development" && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-900">
                <strong>Development Mode:</strong> No Firebase connection. Using local database for development.
              </AlertDescription>
            </Alert>
          )}

          {appMode.mode === "emulator" && (
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <strong>Emulator Mode:</strong> Connected to local Firebase Emulator Suite at ports 8081 (Firestore), 9100 (Auth), 4001 (UI).
              </AlertDescription>
            </Alert>
          )}

          {appMode.mode === "production" && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                <strong>Production Mode:</strong> Connected to real Google Firebase backend. All changes are synced to production.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Mode Selection Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Switch Development Mode</CardTitle>
          <CardDescription>
            Select a development environment for your local testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {allModes.map((mode) => {
              const isActive = mode.mode === appMode.mode;
              const isYellow = mode.mode === "development";
              const isBlue = mode.mode === "emulator";
              const isGreen = mode.mode === "production";

              return (
                <div
                  key={mode.mode}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    isActive
                      ? isYellow
                        ? "border-yellow-600 bg-yellow-50"
                        : isBlue
                          ? "border-blue-600 bg-blue-50"
                          : "border-green-600 bg-green-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  {/* Emoji and Title */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{getModeEmoji(mode.mode)}</span>
                    <div>
                      <h3 className="font-semibold text-sm">{mode.label}</h3>
                      <p className="text-xs text-gray-600">
                        {mode.mode === "development"
                          ? "Local Development"
                          : mode.mode === "emulator"
                            ? "Firebase Emulator"
                            : "Google Cloud"}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-700 mb-3 line-clamp-2">
                    {mode.description}
                  </p>

                  {/* Features */}
                  <ul className="text-xs space-y-1 mb-4">
                    {mode.mode === "development" && (
                      <>
                        <li>✓ No internet required</li>
                        <li>✓ Local database</li>
                        <li>✓ Offline development</li>
                      </>
                    )}
                    {mode.mode === "emulator" && (
                      <>
                        <li>✓ Real Firebase behavior</li>
                        <li>✓ Isolated emulator</li>
                        <li>✓ Persistent data</li>
                      </>
                    )}
                    {mode.mode === "production" && (
                      <>
                        <li>✓ Production Firebase</li>
                        <li>✓ Real-time sync</li>
                        <li>✓ Cloud stored</li>
                      </>
                    )}
                  </ul>

                  {/* Status Badge and Button */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    {isActive ? (
                      <Badge variant="default" className="bg-green-600">
                        Active
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-500">Inactive</span>
                    )}

                    <Button
                      size="sm"
                      disabled={isActive || isLoading}
                      onClick={() => handleModeSwitch(mode.mode)}
                      variant={isActive ? "secondary" : "outline"}
                    >
                      {isActive
                        ? "Active"
                        : isLoading
                          ? "Saving..."
                          : "Switch"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info Banner */}
          <Alert className="mt-4 border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 text-sm">
              <strong>Note:</strong> Switching modes saves your preference and requires a page refresh to take effect. The next time you load the app, it will use your selected mode.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Environment Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Current Mode:</span>
              <span className="font-mono font-semibold">{appMode.mode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Environment:</span>
              <span className="font-mono font-semibold">
                {import.meta.env.DEV ? "Development" : "Production"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Using Emulators:</span>
              <span className="font-mono font-semibold">
                {import.meta.env.VITE_USE_EMULATORS === "true" ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Firebase Connected:</span>
              <span className="font-mono font-semibold">
                {appMode.isConnected ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModeSelector;
