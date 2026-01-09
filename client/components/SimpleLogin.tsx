import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import {
  signInLocal,
  signOutLocal,
  getCurrentUser,
  isAuthenticated,
} from "../lib/localAuth";
import { LogIn, User, Building } from "lucide-react";

export const SimpleLogin: React.FC = () => {
  const [user, setUser] = useState(getCurrentUser());
  const [email, setEmail] = useState("celestinod@gmail.com"); // Pre-filled
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(!isAuthenticated());

  // Monitor auth status
  useEffect(() => {
    const checkAuth = () => {
      setUser(getCurrentUser());
      setShowForm(!isAuthenticated());
    };

    // Auto-sign in with Celestino for demo (if not already signed in)
    if (!isAuthenticated()) {
      console.log("🚀 Auto-signing in Celestino for demo...");
      signInLocal("celestinod@gmail.com");
      checkAuth();
    }

    // Check every second
    const interval = setInterval(checkAuth, 1000);

    // Initial check
    checkAuth();

    return () => clearInterval(interval);
  }, []);

  const handleSignIn = async () => {
    if (!email) {
      setMessage("Please enter an email address");
      return;
    }

    setIsLoading(true);
    setMessage("Signing in...");

    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newUser = signInLocal(email);
      if (newUser) {
        setUser(newUser);
        setMessage(`✅ Welcome back, ${newUser.name}!`);
        setShowForm(false);

        // Refresh page after successful login
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setMessage("❌ Failed to sign in");
      }
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    setMessage("Signing out...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      signOutLocal();
      setUser(null);
      setShowForm(true);
      setMessage("✅ Signed out successfully");

      // Refresh page after sign out
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (email: string) => {
    setEmail(email);
    handleSignIn();
  };

  // If user is signed in, show status
  if (user && isAuthenticated()) {
    return (
      <Card className="mb-6 border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Signed In
              </Badge>
              <div className="text-sm">
                <div className="font-medium">{user.name}</div>
                <div className="text-green-700">{user.email}</div>
              </div>
              <Badge variant="outline">{user.role}</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
              >
                Refresh
              </Button>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                {isLoading ? "Signing Out..." : "Sign Out"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show login form
  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <LogIn className="h-5 w-5" />
          Sign In to HR Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Welcome! Sign in to access your HR dashboard. No password required
            for development.
          </AlertDescription>
        </Alert>

        {showForm && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSignIn()}
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSignIn}
                disabled={!email || isLoading}
                className="flex-1 flex items-center gap-2"
              >
                <LogIn className="h-4 w-4" />
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-gray-600 mb-2">Quick Login:</p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => handleQuickLogin("celestinod@gmail.com")}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  Celestino
                </Button>
                <Button
                  onClick={() => handleQuickLogin("admin@company.com")}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  Admin
                </Button>
                <Button
                  onClick={() => handleQuickLogin("hr@company.com")}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  HR Manager
                </Button>
              </div>
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
