import React, { useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Mail, Lock, User, ArrowRight, CheckCircle2 } from "lucide-react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase-core";
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
import { AccountantChoice } from "@/components/accountants/AccountantChoice";
import {
  forgetAccountantPartner,
  getAccountantPartner,
  readRememberedAccountantPartner,
  rememberAccountantPartner,
  type AccountantPartnerId,
} from "@/lib/accountantPartners";

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { refreshUserProfile, signInWithGoogle } = useAuth();
  const { switchTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const actionInFlight = useRef(false);
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
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [accountantPartnerId, setAccountantPartnerId] =
    useState<AccountantPartnerId | null>(() => {
      const fromUrl = getAccountantPartner(searchParams.get("accountant"));
      return fromUrl?.id ?? readRememberedAccountantPartner()?.id ?? null;
    });

  const handleAccountantChoice = (partnerId: AccountantPartnerId | null) => {
    setAccountantPartnerId(partnerId);
    if (partnerId) rememberAccountantPartner(partnerId);
    else forgetAccountantPartner();
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 30);
  };

  const handleCompanyNameChange = (name: string) => {
    setCompanyName(name);
    if (!slugManuallyEdited) {
      setCompanySlug(generateSlug(name));
    }
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actionInFlight.current) return;
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
    if (actionInFlight.current) return;

    actionInFlight.current = true;
    setError(null);
    setLoading(true);

    if (!companyName.trim()) {
      setError(t("auth.errors.companyNameRequired"));
      setLoading(false);
      actionInFlight.current = false;
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
        accountantPartnerId,
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
      navigate("/", { replace: true });
    } catch (err: unknown) {
      console.error("Signup error:", err);
      const errCode = err instanceof Error ? (err as { code?: string }).code : undefined;
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
        setError(t("auth.errors.signupFailed"));
      }
    } finally {
      actionInFlight.current = false;
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (actionInFlight.current) return;

    actionInFlight.current = true;
    setError(null);
    setGoogleLoading(true);
    try {
      if (accountantPartnerId) rememberAccountantPartner(accountantPartnerId);
      else forgetAccountantPartner();
      await signInWithGoogle();
      // New Google users have no tenant yet → HomeRoute sends them to
      // onboarding to create their company. Returning users go to the app.
      navigate("/", { replace: true });
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
      actionInFlight.current = false;
      setGoogleLoading(false);
    }
  };

  return (
    <div className="dark relative flex min-h-screen items-start justify-center overflow-hidden bg-[#0a0a0b] p-4 py-8 sm:items-center">
      <SEO {...seoConfig.signup} />

      {/* Background effects (matches Login) */}
      <div className="absolute inset-0">
        <div className="absolute left-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <LocaleSwitcher variant="buttons" className="justify-center" />
        </div>

        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <Link to="/landing">
            <img
              src="/images/illustrations/xefe-logo-light.webp"
              alt="Xefe"
              className="h-12 w-auto"
            />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {step === "account" ? t("auth.signup.titleAccount") : t("auth.signup.titleOrganization")}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              {step === "account"
                ? `${t("landing.hero.trust.trial")} · ${t("admin.createTenant.planFreeDesc")}`
                : t("auth.signup.subtitleOrganization")}
            </p>
          </div>

          <div>
            {/* Progress indicator */}
            <div className="mb-6 flex items-center justify-center gap-2">
              <div className={`flex items-center gap-2 ${step === "account" ? "text-primary" : "text-zinc-500"}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === "account"
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary"
                }`}>
                  {step === "organization" ? <CheckCircle2 className="h-5 w-5" /> : "1"}
                </div>
                <span className="hidden text-sm font-medium sm:inline">{t("auth.signup.stepAccount")}</span>
              </div>
              <div className="h-0.5 w-8 bg-white/10" />
              <div className={`flex items-center gap-2 ${step === "organization" ? "text-primary" : "text-zinc-500"}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === "organization"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 text-zinc-500"
                }`}>
                  2
                </div>
                <span className="hidden text-sm font-medium sm:inline">{t("auth.signup.stepOrganization")}</span>
              </div>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
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
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#0a0a0b] px-3 text-xs uppercase tracking-wide text-zinc-500">
                      {t("auth.orDivider")}
                    </span>
                  </div>
                </div>
                <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="displayName" className="text-sm font-medium text-zinc-300">{t("auth.signup.fullName")}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      id="displayName"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder={t("auth.signup.fullNamePlaceholder")}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-base text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-zinc-300">{t("auth.signup.workEmail")}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder={t("auth.signup.workEmailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-base text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-zinc-300">{t("auth.password")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder={t("auth.signup.passwordHint")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-base text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-300">{t("auth.signup.confirmPassword")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder={t("auth.signup.confirmPasswordPlaceholder")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-base text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full gap-2" disabled={googleLoading}>
                  {t("auth.signup.continue")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                </form>
              </>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="companyName" className="text-sm font-medium text-zinc-300">{t("auth.signup.companyName")}</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      id="companyName"
                      name="organization"
                      type="text"
                      autoComplete="organization"
                      placeholder={t("auth.signup.companyNamePlaceholder")}
                      value={companyName}
                      onChange={(e) => handleCompanyNameChange(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-base text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="companySlug" className="text-sm font-medium text-zinc-300">{t("auth.signup.companyUrl")}</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="companySlug"
                      name="companySlug"
                      type="text"
                      autoComplete="off"
                      placeholder={t("auth.signup.companySlugPlaceholder")}
                      value={companySlug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        setCompanySlug(generateSlug(e.target.value));
                      }}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-base text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    {t("auth.signup.companyUrlHint")}
                  </p>
                </div>

                <AccountantChoice
                  value={accountantPartnerId}
                  onChange={handleAccountantChoice}
                  disabled={loading}
                />

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
          </div>

          <div className="mt-6 flex flex-col gap-4">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0a0a0b] px-2 text-zinc-500">
                  {t("auth.signup.alreadyHaveAccount")}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              asChild
              className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/auth/login">{t("auth.signIn")}</Link>
            </Button>

            <p className="text-center text-xs text-zinc-500">
              {t("legal.signupAgreePre")}{" "}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-300">
                {t("legal.terms.title")}
              </Link>{" "}
              {t("legal.signupAgreeAnd")}{" "}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-300">
                {t("legal.privacy.title")}
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
