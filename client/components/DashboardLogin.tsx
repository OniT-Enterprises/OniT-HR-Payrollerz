import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { signInWithEmail, signInDev, getAuthStatus } from "../lib/devAuth";
import { autoSetupTenantForUser } from "../lib/tenantSetup";
import { LogIn, User, Building } from "lucide-react";

export const DashboardLogin: React.FC = () => {
  const [authStatus, setAuthStatus] = useState(getAuthStatus());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Monitor auth status
  useEffect(() => {
    const interval = setInterval(() => {
      setAuthStatus(getAuthStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setMessage("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    setMessage("Signing in...");

    try {
      const user = await signInWithEmail(email, password);
      if (user) {
        setMessage("✅ Signed in successfully! Setting up your workspace...");
        setAuthStatus(getAuthStatus());

        // Auto-setup tenant
        const success = await autoSetupTenantForUser(
          user.uid,
          user.email || "user@example.com",
        );
        if (success) {
          setMessage("✅ Workspace created! Refreshing page...");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setMessage(
            "⚠️ Signed in but failed to create workspace. Try refreshing the page.",
          );
        }
      }
    } catch (error: any) {
      let userMessage = `❌ Sign in failed: ${error.message}`;

      if (error.code === "auth/user-not-found") {
        userMessage = "❌ No account found with this email address";
      } else if (error.code === "auth/wrong-password") {
        userMessage = "❌ Incorrect password";
      } else if (error.code === "auth/invalid-email") {
        userMessage = "❌ Invalid email format";
      }

      setMessage(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsLoading(true);
    setMessage("Signing in anonymously...");

    try {
      const user = await signInDev();
      if (user) {
        setMessage("✅ Signed in! Setting up demo workspace...");
        setAuthStatus(getAuthStatus());

        // Auto-setup tenant
        const success = await autoSetupTenantForUser(
          user.uid,
          "demo@example.com",
        );
        if (success) {
          setMessage("✅ Demo workspace created! Refreshing page...");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setMessage(
            "⚠️ Signed in but failed to create workspace. Try refreshing the page.",
          );
        }
      }
    } catch (error: any) {
      setMessage(`❌ Anonymous sign in failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // If user is signed in, show status
  if (authStatus.isSignedIn) {
    return (
      <Card className="mb-6 border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              Signed In
            </Badge>
            <span className="text-sm text-green-700">
              {authStatus.email ||
                `User: ${authStatus.uid?.substring(0, 8)}...`}
            </span>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
            >
              Refresh to Load Workspace
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <LogIn className="h-5 w-5" />
          Sign In Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            You need to sign in to access your HR workspace. This will create
            your company tenant and enable all features.
          </AlertDescription>
        </Alert>

        {!showForm ? (
          <div className="flex gap-3">
            <Button
              onClick={() => setShowForm(true)}
              className="flex-1 flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              Sign In with Email
            </Button>
            <Button
              onClick={handleAnonymousSignIn}
              variant="outline"
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Building className="h-4 w-4" />
              {isLoading ? "Creating..." : "Try Demo"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleEmailSignIn()}
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleEmailSignIn}
                disabled={!email || !password || isLoading}
                className="flex-1"
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
              <Button
                onClick={() => {
                  setShowForm(false);
                  setEmail("");
                  setPassword("");
                  setMessage("");
                }}
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

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
