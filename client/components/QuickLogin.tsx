import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { signInWithEmail, signInDev, getAuthStatus } from "../lib/devAuth";
import { LogIn, User } from "lucide-react";

export const QuickLogin: React.FC = () => {
  const [authStatus, setAuthStatus] = useState(getAuthStatus());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleQuickSignIn = async () => {
    if (!email || !password) return;

    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
      setAuthStatus(getAuthStatus());
      setShowForm(false);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Quick sign in failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsLoading(true);
    try {
      await signInDev();
      setAuthStatus(getAuthStatus());
    } catch (error) {
      console.error("Anonymous sign in failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for auth changes
  React.useEffect(() => {
    const interval = setInterval(() => {
      setAuthStatus(getAuthStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (authStatus.isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default" className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {authStatus.email || "Signed In"}
        </Badge>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setShowForm(true)}
          variant="ghost"
          size="sm"
          className="flex items-center gap-1"
        >
          <LogIn className="h-4 w-4" />
          Sign In
        </Button>
        <Button
          onClick={handleAnonymousSignIn}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? "..." : "Guest"}
        </Button>
      </div>
    );
  }

  return (
    <Card className="absolute top-16 right-0 w-72 z-50">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size="sm"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleQuickSignIn()}
            size="sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleQuickSignIn}
            disabled={!email || !password || isLoading}
            size="sm"
            className="flex-1"
          >
            {isLoading ? "..." : "Sign In"}
          </Button>
          <Button
            onClick={() => setShowForm(false)}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
