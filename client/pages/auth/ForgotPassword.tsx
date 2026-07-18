import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { ArrowLeft, CheckCircle, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [error, setError] = useState("");
  const { t } = useI18n();
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim();
    setError("");
    setSubmittedEmail(normalizedEmail);
    setLoading(true);

    try {
      await resetPassword(normalizedEmail);
      setSent(true);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      // Don't reveal whether an account exists for this email
      if (code === "auth/user-not-found") {
        setSent(true);
      } else if (code === "auth/invalid-email") {
        setError(t("auth.errors.invalidEmail"));
      } else {
        setError(t("auth.errors.resetFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
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
        <div className="flex justify-center mb-10">
          <Link to="/landing">
            <img
              src="/images/illustrations/xefe-logo-light.webp"
              alt="Xefe"
              className="h-12 w-auto"
            />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {t("auth.resetEmailSentTitle")}
              </h1>
              <p className="text-sm text-zinc-400">
                {t("auth.resetEmailSentDetail", { email: submittedEmail })}
              </p>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("auth.backToLogin")}
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {t("auth.forgotPasswordTitle")}
                </h1>
                <p className="text-sm text-zinc-500 mt-2">
                  {t("auth.forgotPasswordSubtitle")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-zinc-300">
                    {t("auth.email")}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder={t("auth.emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-base text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
                      required
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full font-semibold"
                >
                  {loading ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
                </Button>

                <div className="text-center pt-1">
                  <Link
                    to="/auth/login"
                    className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-primary"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t("auth.backToLogin")}
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
