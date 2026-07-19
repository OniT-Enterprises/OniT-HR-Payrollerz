/**
 * Shared footer for all public marketing pages — the same links everywhere,
 * matching the PublicNav pages plus legal and support, so the site reads as
 * one place regardless of which page the visitor is on.
 */
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n/I18nProvider";
import { localeFromPath, withLocalePrefix } from "@/lib/publicLocale";

export function PublicFooter() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const localized = (to: string) => withLocalePrefix(to, localeFromPath(pathname));

  return (
    <footer className="border-t border-white/[0.06] bg-black/40 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 sm:px-6 md:flex-row lg:px-8">
        <div className="flex items-center gap-3">
          <img
            src="/images/illustrations/xefe-logo-light.webp"
            alt="Xefe"
            width="85"
            height="42"
            className="h-7 w-auto"
            loading="lazy"
          />
          <span className="text-sm text-zinc-500">
            {t("landing.footer.location")}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-zinc-400">
          <Link to={localized("/how-it-works")} className="transition-colors hover:text-white">
            {t("landing.footer.links.howItWorks")}
          </Link>
          <Link to={localized("/engine")} className="transition-colors hover:text-white">
            {t("landing.nav.engine")}
          </Link>
          <Link to={localized("/pricing")} className="transition-colors hover:text-white">
            {t("landing.nav.pricing")}
          </Link>
          <Link to={localized("/accountants")} className="transition-colors hover:text-white">
            {t("landing.footer.links.accountants")}
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-white">
            {t("landing.footer.links.privacy")}
          </Link>
          <Link to="/terms" className="transition-colors hover:text-white">
            {t("landing.footer.links.terms")}
          </Link>
          <a
            href="https://wa.me/67073371307"
            className="transition-colors hover:text-white"
          >
            {t("landing.footer.links.support")}
          </a>
          <a
            href="mailto:suporte@onit.tl"
            className="transition-colors hover:text-white"
          >
            {t("landing.footer.links.contact")}
          </a>
        </div>
        <div className="text-sm text-zinc-500">
          {t("landing.footer.copyright")}
        </div>
      </div>
    </footer>
  );
}
