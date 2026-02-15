import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, Building2, CheckCircle2, AlertTriangle } from "lucide-react";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import { PLAN_LIMITS } from "@/types/tenant";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminSetup() {
  const navigate = useNavigate();
  const { user, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadySetup, setAlreadySetup] = useState(false);

  // Company/Tenant info
  const [companyName, setCompanyName] = useState("Meza Demo Company");
  const [companySlug, setCompanySlug] = useState("meza-demo");

  // Check if bootstrap has already occurred
  useEffect(() => {
    async function checkBootstrap() {
      if (!db) {
        setChecking(false);
        return;
      }

      try {
        const bootstrapRef = doc(db, "_bootstrap", "initialized");
        const bootstrapSnap = await getDoc(bootstrapRef);

        if (bootstrapSnap.exists()) {
          setAlreadySetup(true);
        }
      } catch {
        // Ignore bootstrap check errors
      } finally {
        setChecking(false);
      }
    }

    checkBootstrap();
  }, []);

  const handleSetup = async () => {
    if (!user || !db) {
      setError("You must be logged in to set up admin access");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create or update user profile with superadmin
      const userRef = doc(db, paths.user(user.uid));
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // Update existing profile to superadmin
        const existingTenants = userSnap.data()?.tenantIds || [];
        await setDoc(userRef, {
          isSuperAdmin: true,
          tenantIds: existingTenants.includes(companySlug)
            ? existingTenants
            : [...existingTenants, companySlug],
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        // Create new profile
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split("@")[0] || "Admin",
          isSuperAdmin: true,
          tenantIds: [companySlug],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 2. Create demo tenant
      const tenantRef = doc(db, paths.tenant(companySlug));
      await setDoc(tenantRef, {
        id: companySlug,
        name: companyName,
        slug: companySlug,
        status: "active",
        plan: "professional",
        limits: PLAN_LIMITS.professional,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        billingEmail: user.email,
        features: {
          hiring: true,
          timeleave: true,
          performance: true,
          payroll: true,
          reports: true,
        },
        settings: {
          timezone: "Asia/Dili",
          currency: "USD",
          dateFormat: "DD/MM/YYYY",
        },
      });

      // 3. Create owner membership
      const memberRef = doc(db, paths.member(companySlug, user.uid));
      await setDoc(memberRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0] || "Admin",
        role: "owner",
        modules: ["hiring", "staff", "timeleave", "performance", "payroll", "reports"],
        joinedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        permissions: {
          admin: true,
          write: true,
          read: true,
        },
      });

      // 4. Mark bootstrap as complete (prevents future bootstrap)
      const bootstrapRef = doc(db, "_bootstrap", "initialized");
      await setDoc(bootstrapRef, {
        initializedAt: serverTimestamp(),
        initializedBy: user.uid,
        initializedEmail: user.email,
      });

      // 5. Refresh user profile in auth context
      if (refreshUserProfile) {
        await refreshUserProfile();
      }

      setSuccess(true);

      // Navigate to dashboard after short delay
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err: any) {
      console.error("Setup error:", err);
      setError(err.message || "Failed to complete setup");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Login Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need to be logged in to set up admin access.
            </p>
            <Button onClick={() => navigate("/auth/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadySetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Already Configured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Admin access has already been configured for this system.
              If you need admin access, contact an existing superadmin.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/images/meza-logo-dark-on-light.png"
              alt="Meza"
              className="h-10 w-auto"
            />
            <span className="text-xs text-muted-foreground">Admin Setup</span>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Initial Admin Setup
            </CardTitle>
            <CardDescription>
              Set up the first superadmin account and create your demo company.
              This can only be done once.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Setup Complete!</h3>
                <p className="text-muted-foreground mb-4">
                  You are now a superadmin. Redirecting to dashboard...
                </p>
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current User Info */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Logged in as:</p>
                  <p className="font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This account will become the first superadmin
                  </p>
                </div>

                {/* Company Setup */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Demo Company</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your Company Name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companySlug">Company ID (slug)</Label>
                    <Input
                      id="companySlug"
                      value={companySlug}
                      onChange={(e) => setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                      placeholder="company-id"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used in URLs and as a unique identifier
                    </p>
                  </div>
                </div>

                {/* What happens */}
                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">This will:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Create your user profile as superadmin</li>
                    <li>Create a demo company with Professional plan</li>
                    <li>Make you the owner of the demo company</li>
                    <li>Lock bootstrap (no one else can use this page)</li>
                  </ul>
                </div>

                <Button
                  onClick={handleSetup}
                  disabled={loading || !companyName || !companySlug}
                  className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Complete Setup
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
