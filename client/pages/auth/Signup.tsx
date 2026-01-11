import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Building2, Mail, Lock, User, ArrowRight, CheckCircle2 } from "lucide-react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { paths } from "@/lib/paths";
import { PLAN_LIMITS, TenantPlan } from "@/types/tenant";
import { SEO, seoConfig } from "@/components/SEO";

export default function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"account" | "organization">("account");

  // Account fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Organization fields
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 30);
  };

  const handleCompanyNameChange = (name: string) => {
    setCompanyName(name);
    setCompanySlug(generateSlug(name));
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!displayName.trim()) {
      setError("Please enter your name");
      return;
    }

    setStep("organization");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!companyName.trim()) {
      setError("Please enter your company name");
      setLoading(false);
      return;
    }

    try {
      // 1. Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Update user profile with display name
      await updateProfile(user, { displayName: displayName.trim() });

      // 3. Generate tenant ID
      const tenantId = companySlug || `tenant_${Date.now()}`;

      // 4. Create user profile document
      await setDoc(doc(db, paths.user(user.uid)), {
        uid: user.uid,
        email: user.email,
        displayName: displayName.trim(),
        isSuperAdmin: false,
        tenantIds: [tenantId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 5. Create tenant document
      const plan: TenantPlan = "free";
      await setDoc(doc(db, paths.tenant(tenantId)), {
        id: tenantId,
        name: companyName.trim(),
        slug: companySlug || tenantId,
        status: "active",
        plan,
        limits: PLAN_LIMITS[plan],
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        branding: {},
        features: {
          hiring: true,
          timeleave: true,
          performance: true,
          payroll: true,
          reports: true,
        },
        settings: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: "USD",
          dateFormat: "YYYY-MM-DD",
        },
      });

      // 6. Create owner membership
      await setDoc(doc(db, paths.member(tenantId, user.uid)), {
        uid: user.uid,
        email: user.email,
        displayName: displayName.trim(),
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

      // 7. Navigate to dashboard
      navigate("/");
    } catch (err: any) {
      console.error("Signup error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Please log in instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else {
        setError(err.message || "Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <SEO {...seoConfig.signup} />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-white text-lg font-bold">HR</span>
            </div>
            <span className="text-2xl font-bold text-foreground">OniT</span>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">
              {step === "account" ? "Create Your Account" : "Set Up Your Organization"}
            </CardTitle>
            <CardDescription className="text-center">
              {step === "account"
                ? "Start your free trial - no credit card required"
                : "Tell us about your company"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`flex items-center gap-2 ${step === "account" ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === "account"
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary"
                }`}>
                  {step === "organization" ? <CheckCircle2 className="h-5 w-5" /> : "1"}
                </div>
                <span className="text-sm font-medium hidden sm:inline">Account</span>
              </div>
              <div className="w-8 h-0.5 bg-border" />
              <div className={`flex items-center gap-2 ${step === "organization" ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === "organization"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  2
                </div>
                <span className="text-sm font-medium hidden sm:inline">Organization</span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === "account" ? (
              <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="John Smith"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Acme Inc."
                      value={companyName}
                      onChange={(e) => handleCompanyNameChange(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companySlug">Company URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">app.onit.hr/</span>
                    <Input
                      id="companySlug"
                      type="text"
                      placeholder="acme-inc"
                      value={companySlug}
                      onChange={(e) => setCompanySlug(generateSlug(e.target.value))}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will be your unique organization identifier
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("account")}
                    className="flex-1"
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1 gap-2" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-0">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Already have an account?
                </span>
              </div>
            </div>

            <Button variant="outline" asChild className="w-full">
              <Link to="/auth/login">Sign In</Link>
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </p>
          </CardFooter>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">Free</div>
            <div className="text-xs text-muted-foreground">14-day trial</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">5</div>
            <div className="text-xs text-muted-foreground">Employees</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">All</div>
            <div className="text-xs text-muted-foreground">Features</div>
          </div>
        </div>
      </div>
    </div>
  );
}
