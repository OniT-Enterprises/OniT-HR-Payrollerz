import { Link } from "react-router-dom";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

export default function Unauthorized() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <SEO {...seoConfig.unauthorized} />

      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/4 w-[420px] h-[420px] bg-red-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[360px] h-[360px] bg-amber-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 sm:p-10 backdrop-blur-xl">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 border border-red-400/20 mb-6">
          <ShieldOff className="h-7 w-7 text-red-300" />
        </div>

        <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-300/80 mb-3">
          {t("unauthorized.eyebrow")}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          {t("unauthorized.title")}
        </h1>
        <p className="text-zinc-400 text-base leading-relaxed mb-8">
          {t("unauthorized.message")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white">
            <Link to={user ? "/" : "/auth/login"}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {user ? t("unauthorized.backHome") : t("unauthorized.goToLogin")}
            </Link>
          </Button>
          {user && (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/15 bg-transparent text-white hover:bg-white/5 hover:text-white"
            >
              <Link to="/sitemap">{t("unauthorized.browsePages")}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
