import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  signInDev,
  signOutDev,
  getAuthStatus,
  signInWithEmail,
} from "../lib/devAuth";
import { autoSetupTenantForUser } from "../lib/tenantSetup";
import { auth } from "../lib/firebase";

export const DevAuthControl: React.FC = () => {
  const [authStatus, setAuthStatus] = useState(getAuthStatus());
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setAuthStatus(getAuthStatus());
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const user = await signInDev();
      if (user) {
        setMessage(
          `✅ Signed in successfully! User ID: ${user.uid.substring(0, 8)}...`,
        );
      } else {
        setMessage("❌ Sign in failed - check console for details");
      }
    } catch (error: any) {
      setMessage(`❌ Sign in error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      await signOutDev();
      setMessage("✅ Signed out successfully");
      setShowEmailForm(false);
      setEmail("");
      setPassword("");
    } catch (error: any) {
      setMessage(`❌ Sign out error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!email || !password) {
      setMessage("❌ Please enter both email and password");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const user = await signInWithEmail(email, password);
      if (user) {
        setMessage(`✅ Signed in successfully with ${user.email}!`);
        setShowEmailForm(false);
        setPassword(""); // Clear password for security
      } else {
        setMessage("❌ Sign in failed - check console for details");
      }
    } catch (error: any) {
      let userMessage = `❌ Sign in failed: ${error.message}`;

      // Provide user-friendly error messages
      if (error.code === "auth/user-not-found") {
        userMessage = "❌ No account found with this email address";
      } else if (error.code === "auth/wrong-password") {
        userMessage = "❌ Incorrect password";
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

  const handleSetupTenant = async () => {
    if (!authStatus.isSignedIn || !authStatus.user) {
      setMessage("❌ Please sign in first");
      return;
    }

    setIsLoading(true);
    setMessage("🏢 Setting up your tenant...");

    try {
      const success = await autoSetupTenantForUser(
        authStatus.user.uid,
        authStatus.user.email || "user@example.com",
      );

      if (success) {
        setMessage(
          "✅ Tenant setup completed! Refresh the page to see your new company.",
        );
      } else {
        setMessage("❌ Failed to setup tenant. Check console for details.");
      }
    } catch (error: any) {
      setMessage(`❌ Tenant setup error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (authStatus.isSignedIn) {
      return <Badge variant="default">SIGNED IN</Badge>;
    } else {
      return <Badge variant="destructive">NOT SIGNED IN</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Development Authentication</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            {authStatus.isSignedIn ? (
              <>
                <strong>Status:</strong> Authenticated as{" "}
                {authStatus.isAnonymous ? "Anonymous User" : authStatus.email}
                <br />
                <strong>User ID:</strong> {authStatus.uid?.substring(0, 16)}...
              </>
            ) : (
              <>
                <strong>Status:</strong> Not authenticated. You need to sign in
                to access Firebase data.
                <br />
                This will enable database operations and fix permission errors.
              </>
            )}
          </AlertDescription>
        </Alert>

        {!authStatus.isSignedIn && (
          <>
            {!showEmailForm ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleSignIn}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Signing In..." : "Sign In (Anonymous)"}
                </Button>
                <Button
                  onClick={() => setShowEmailForm(true)}
                  variant="outline"
                  disabled={isLoading}
                  className="flex-1"
                >
                  Sign In with Email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isLoading || !email || !password}
                    className="flex-1"
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowEmailForm(false);
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
              </form>
            )}
          </>
        )}

        {authStatus.isSignedIn && (
          <div className="space-y-2">
            <Button
              onClick={handleSetupTenant}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Setting up..." : "Setup My Company/Tenant"}
            </Button>
            <Button
              onClick={handleSignOut}
              variant="outline"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Signing Out..." : "Sign Out"}
            </Button>
          </div>
        )}

        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground">
          <strong>Note:</strong> This uses Firebase Anonymous Authentication for
          development. After signing in, Firebase operations should work if
          Firestore rules allow anonymous users.
        </div>
      </CardContent>
    </Card>
  );
};
