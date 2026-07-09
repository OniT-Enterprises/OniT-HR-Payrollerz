import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Building2, Mail, Lock, User, ArrowRight, CheckCircle2 } from "lucide-react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  provisionOrganization,
  ProvisioningTimeoutError,
  SlugTakenError,
} from "@/services/provisionOrg";
import { SEO, seoConfig } from "@/components/SEO";
import { useI18n } from "@/i18n/I18nProvider";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function Signup() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { refreshUserProfile, signInWithGoogle } = useAuth();
  const { switchTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
      setError(t("auth.errors.passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.errors.passwordsDoNotMatch"));
      return;
    }

    if (!displayName.trim()) {
      setError(t("auth.errors.nameRequired"));
      return;
    }

    setStep("organization");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!companyName.trim()) {
      setError(t("auth.errors.companyNameRequired"));
      setLoading(false);
      return;
    }

    try {
      // 1. Create Firebase Auth account — unless a previous attempt already
      // created it and only the org provisioning failed (e.g. slug taken):
      // the user is still signed in, so reuse that account for the retry.
      let user = auth.currentUser;
      if (!user || user.email?.toLowerCase() !== email.toLowerCase()) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      }

      // 2. Update user profile with display name
      await updateProfile(user, { displayName: displayName.trim() });

      // 3. Provision tenant + owner membership + user profile
      const tenantId = await provisionOrganization({
        user,
        displayName: displayName.trim(),
        companyName,
        companySlug,
      });

      await refreshUserProfile();

      // 4. Load the new tenant session before navigating — HomeRoute decides
      // from context state, and the tenant init effect may still hold the
      // pre-provisioning "no tenants" resolution at that point.
      try {
        await switchTenant(tenantId);
      } catch (switchErr) {
        console.warn("Post-signup tenant load failed, deferring to re-init:", switchErr);
      }

      // 5. Everyone starts free; they subscribe later when they run payroll.
      navigate("/");
    } catch (err: unknown) {
      console.error("Signup error:", err);
      const errCode = err instanceof Error ? (err as { code?: string }).code : undefined;
      const errMessage = err instanceof Error ? err.message : t("auth.errors.signupFailed");
      if (err instanceof SlugTakenError) {
        setError(t("auth.errors.companySlugTaken"));
      } else if (err instanceof ProvisioningTimeoutError) {
        setError(t("auth.errors.networkTimeout"));
      } else if (errCode === "auth/email-already-in-use") {
        setError(t("auth.errors.accountExists"));
      } else if (errCode === "auth/weak-password") {
        setError(t("auth.errors.weakPassword"));
      } else if (errCode === "auth/invalid-email") {
        setError(t("auth.errors.invalidEmail"));
      } else {
        setError(errMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // New Google users have no tenant yet → HomeRoute sends them to
      // onboarding to create their company. Returning users go to the app.
      navigate("/");
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        return;
      }
      setError(t("auth.errors.googleSignInFailed"));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <SEO {...seoConfig.signup} />
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LocaleSwitcher variant="buttons" className="justify-end" />
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/images/illustrations/xefe-logo-dark.webp"
              alt="Xefe"
              className="h-10 w-auto"
            />
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">
              {step === "account" ? t("auth.signup.titleAccount") : t("auth.signup.titleOrganization")}
            </CardTitle>
            <CardDescription className="text-center">
              {step === "account"
                ? t("auth.signup.subtitleAccount")
                : t("auth.signup.subtitleOrganization")}
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
                <span className="text-sm font-medium hidden sm:inline">{t("auth.signup.stepAccount")}</span>
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
                <span className="text-sm font-medium hidden sm:inline">{t("auth.signup.stepOrganization")}</span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === "account" ? (
              <>
                <GoogleSignInButton
                  onClick={handleGoogle}
                  loading={googleLoading}
                  disabled={loading}
                  label={t("auth.continueWithGoogle")}
                />
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">
                      {t("auth.orDivider")}
                    </span>
                  </div>
                </div>
                <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t("auth.signup.fullName")}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="displayName"
                      type="text"
                      placeholder={t("auth.signup.fullNamePlaceholder")}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.signup.workEmail")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("auth.signup.workEmailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder={t("auth.signup.passwordHint")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("auth.signup.confirmPassword")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder={t("auth.signup.confirmPasswordPlaceholder")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2">
                  {t("auth.signup.continue")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                </form>
              </>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">{t("auth.signup.companyName")}</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyName"
                      type="text"
                      placeholder={t("auth.signup.companyNamePlaceholder")}
                      value={companyName}
                      onChange={(e) => handleCompanyNameChange(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companySlug">{t("auth.signup.companyUrl")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="companySlug"
                      type="text"
                      placeholder={t("auth.signup.companySlugPlaceholder")}
                      value={companySlug}
                      onChange={(e) => setCompanySlug(generateSlug(e.target.value))}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("auth.signup.companyUrlHint")}
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
                    {t("common.back")}
                  </Button>
                  <Button type="submit" className="flex-1 gap-2" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("auth.signup.creating")}
                      </>
                    ) : (
                      <>
                        {t("auth.signup.createAccount")}
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
                  {t("auth.signup.alreadyHaveAccount")}
                </span>
              </div>
            </div>

            <Button variant="outline" asChild className="w-full">
              <Link to="/auth/login">{t("auth.signIn")}</Link>
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {t("legal.signupAgreePre")}{" "}
              <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
                {t("legal.terms.title")}
              </Link>{" "}
              {t("legal.signupAgreeAnd")}{" "}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
                {t("legal.privacy.title")}
              </Link>
              .
            </p>
          </CardFooter>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">{t("auth.signup.trialLabel")}</div>
            <div className="text-xs text-muted-foreground">{t("auth.signup.trialValue")}</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">5</div>
            <div className="text-xs text-muted-foreground">{t("auth.signup.employeesLabel")}</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">{t("auth.signup.allValue")}</div>
            <div className="text-xs text-muted-foreground">{t("auth.signup.featuresLabel")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
