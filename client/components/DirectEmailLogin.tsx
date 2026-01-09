import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { signInWithEmail, signOutDev, getAuthStatus } from "../lib/devAuth";
import { autoSetupTenantForUser } from "../lib/tenantSetup";
import { LogIn, User, Mail } from "lucide-react";

export const DirectEmailLogin: React.FC = () => {
  const [authStatus, setAuthStatus] = useState(getAuthStatus());
  const [email, setEmail] = useState("celestinod@gmail.com"); // Pre-filled
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Monitor auth status
  useEffect(() => {
    const interval = setInterval(() => {
      setAuthStatus(getAuthStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    setIsLoading(true);
    setMessage("Signing out current user...");

    try {
      await signOutDev();
      setAuthStatus(getAuthStatus());
      setMessage("✅ Signed out successfully! Now sign in with your email.");
    } catch (error: any) {
      setMessage(`❌ Sign out error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setMessage("Please enter your password for celestinod@gmail.com");
      return;
    }

    setIsLoading(true);
    setMessage("🔐 Signing in with your email account...");

    try {
      const user = await signInWithEmail(email, password);
      if (user) {
        setMessage(
          "✅ Successfully signed in as " +
            user.email +
            "! Setting up your workspace...",
        );
        setAuthStatus(getAuthStatus());

        // Auto-setup tenant with the user's actual email
        const success = await autoSetupTenantForUser(
          user.uid,
          user.email || email,
        );
        if (success) {
          setMessage(
            "✅ Workspace created for " + user.email + "! Refreshing page...",
          );
          setTimeout(() => window.location.reload(), 2000);
        } else {
          setMessage(
            "✅ Signed in as " +
              user.email +
              " but failed to create workspace. Try refreshing the page.",
          );
        }
      }
    } catch (error: any) {
      let userMessage = `❌ Sign in failed: ${error.message}`;

      if (error.code === "auth/user-not-found") {
        userMessage =
          "❌ No account found for celestinod@gmail.com. Check Firebase Console Authentication.";
      } else if (error.code === "auth/wrong-password") {
        userMessage = "❌ Incorrect password for celestinod@gmail.com";
      } else if (error.code === "auth/invalid-email") {
        userMessage = "❌ Invalid email format";
      } else if (error.code === "auth/user-disabled") {
        userMessage = "❌ This account has been disabled";
      }

      setMessage(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <Mail className="h-5 w-5" />
          Sign In as celestinod@gmail.com
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            You're currently signed in as an anonymous user. Sign in with your
            actual email account: <strong>celestinod@gmail.com</strong>
          </AlertDescription>
        </Alert>

        {authStatus.isSignedIn && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Current user:</strong>{" "}
              {authStatus.email ||
                `Anonymous (${authStatus.uid?.substring(0, 8)}...)`}
            </p>
            <Button
              onClick={handleSignOut}
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="mt-2"
            >
              {isLoading ? "Signing Out..." : "Sign Out Current User"}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={true} // Keep it fixed to their email
              className="bg-gray-100"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleEmailSignIn()}
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleEmailSignIn}
            disabled={!password || isLoading}
            className="w-full flex items-center gap-2"
          >
            <LogIn className="h-4 w-4" />
            {isLoading ? "Signing In..." : "Sign In as celestinod@gmail.com"}
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
