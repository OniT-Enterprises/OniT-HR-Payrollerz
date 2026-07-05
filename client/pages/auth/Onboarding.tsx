import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Building2, User as UserIcon, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { provisionOrganization, SlugTakenError } from "@/services/provisionOrg";
import { useI18n } from "@/i18n/I18nProvider";
import LocaleSwitcher from "@/components/LocaleSwitcher";

/**
 * Onboarding step for an authenticated user who has no organization yet —
 * primarily a brand-new Google sign-in, but also any signed-in user with no
 * tenant. Creates their company + owner membership, then sends them to the app.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, userProfile, authResolved, refreshUserProfile } = useAuth();
  const { switchTenant } = useTenant();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 30);

  // Prefill the owner name from the Google/auth profile.
  useEffect(() => {
    if (user?.displayName && !displayName) {
      setDisplayName(user.displayName);
    }
  }, [user?.displayName, displayName]);

  // Not signed in → login. Already has a tenant → straight to the app.
  useEffect(() => {
    if (!authResolved) return;
    if (!user) {
      navigate("/auth/login", { replace: true });
      return;
    }
    if (userProfile?.tenantIds && userProfile.tenantIds.length > 0) {
      navigate("/", { replace: true });
    }
  }, [authResolved, user, userProfile, navigate]);

  const handleCompanyNameChange = (name: string) => {
    setCompanyName(name);
    setCompanySlug(generateSlug(name));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      navigate("/auth/login", { replace: true });
      return;
    }
    if (!displayName.trim()) {
      setError(t("auth.errors.nameRequired"));
      return;
    }
    if (!companyName.trim()) {
      setError(t("auth.errors.companyNameRequired"));
      return;
    }

    setLoading(true);
    try {
      const tenantId = await provisionOrganization({
        user,
        displayName: displayName.trim(),
        companyName,
        companySlug,
      });
      await refreshUserProfile();
      // Load the new tenant session before navigating — HomeRoute decides
      // from context state, and the tenant init effect may still hold the
      // pre-provisioning "no tenants" resolution at that point.
      try {
        await switchTenant(tenantId);
      } catch (switchErr) {
        console.warn("Post-onboarding tenant load failed, deferring to re-init:", switchErr);
      }
      navigate("/", { replace: true });
    } catch (err: unknown) {
      console.error("Onboarding error:", err);
      if (err instanceof SlugTakenError) {
        setError(t("auth.errors.companySlugTaken"));
      } else {
        setError(err instanceof Error ? err.message : t("auth.errors.signupFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!authResolved || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LocaleSwitcher variant="buttons" className="justify-end" />
        </div>

        <div className="flex justify-center mb-8">
          <img
            src="/images/illustrations/xefe-logo-dark.webp"
            alt="Xefe"
            className="h-10 w-auto"
          />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">
              {t("auth.onboarding.title")}
            </CardTitle>
            <CardDescription className="text-center">
              {t("auth.onboarding.subtitle")}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">{t("auth.signup.fullName")}</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("auth.signup.creating")}
                  </>
                ) : (
                  <>
                    {t("auth.onboarding.createButton")}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
