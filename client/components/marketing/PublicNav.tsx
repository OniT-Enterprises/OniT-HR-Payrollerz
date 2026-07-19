/**
 * Shared top navigation for the public marketing pages (/, /how-it-works,
 * /pricing, /accountants, /engine). Every menu item is a real page — never a
 * scroll-to-section link — and the bar is identical on every page with the
 * current page highlighted, so moving around the site never disorients.
 * In-page sections belong in PublicSectionNav, not here.
 *
 * This bar also owns the URL↔locale contract for the marketing site: Tetun
 * and Portuguese live under /tet and /pt prefixes (crawlable per-language
 * URLs, see client/lib/publicLocale.ts). Landing on a prefixed URL switches
 * the i18n locale; switching locale rewrites the URL to the matching prefix.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import {
  isLocalizedPublicPath,
  localeFromPath,
  stripLocalePrefix,
  withLocalePrefix,
} from "@/lib/publicLocale";

const NAV_LINKS = [
  { to: "/", labelKey: "landing.nav.home" },
  { to: "/how-it-works", labelKey: "landing.simple.nav.howItWorks" },
  { to: "/engine", labelKey: "landing.nav.engine" },
  { to: "/pricing", labelKey: "landing.nav.pricing" },
  { to: "/accountants", labelKey: "landing.nav.forAccountants" },
] as const;

export function PublicNav() {
  const { t, locale, setLocale } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Public pages scroll the window (the app shell's scroll reset only covers
  // the authenticated <main>), and pushState navigation never scrolls to a
  // hash on its own — handle both here since this bar is on every public page.
  useEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  // URL↔locale sync. Which side wins depends on what changed:
  // the user navigating to a prefixed URL switches the locale; the user
  // switching locale (with the URL unchanged) rewrites the URL prefix.
  // On first mount a prefixed URL wins; a bare URL leaves the stored
  // preference alone so shared English links don't force a language.
  const prev = useRef({ pathname: location.pathname, locale });
  useEffect(() => {
    const pathChanged = prev.current.pathname !== location.pathname;
    const localeChanged = prev.current.locale !== locale;
    prev.current = { pathname: location.pathname, locale };

    const urlLocale = localeFromPath(location.pathname);
    if (localeChanged && !pathChanged) {
      if (isLocalizedPublicPath(location.pathname) && urlLocale !== locale) {
        navigate(
          withLocalePrefix(location.pathname, locale) + location.hash,
          { replace: true },
        );
      }
    } else if (urlLocale !== "en" && locale !== urlLocale) {
      setLocale(urlLocale);
    }
  }, [location.pathname, location.hash, locale, navigate, setLocale]);

  // Links keep the visitor inside the language they are browsing in.
  const urlLocale = localeFromPath(location.pathname);
  const localized = (to: string) => withLocalePrefix(to, urlLocale);

  // "/landing" renders the same Landing page as "/", so Home stays lit there.
  const isActive = (to: string) => {
    const bare = stripLocalePrefix(location.pathname);
    return to === "/" ? bare === "/" || bare === "/landing" : bare === to;
  };

  return (
    <nav
      aria-label={t("common.mainNavigation")}
      className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0b]/95 md:bg-[#0a0a0b]/85 md:backdrop-blur-lg"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to={localized("/")} aria-label="Xefe" className="shrink-0">
          <img
            src="/images/illustrations/xefe-logo-light.webp"
            alt="Xefe"
            width="109"
            height="54"
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={localized(link.to)}
              aria-current={isActive(link.to) ? "page" : undefined}
              className={cn(
                "text-sm transition-colors hover:text-white",
                isActive(link.to)
                  ? "font-semibold text-amber-300"
                  : "text-zinc-400",
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher className="h-11 w-11 gap-0 border-white/10 bg-white/5 px-0 text-zinc-200 hover:bg-white/10 hover:text-white [&>span]:hidden [&>svg:last-child]:hidden sm:h-9 sm:w-auto sm:gap-2 sm:px-3 sm:[&>span]:inline sm:[&>svg:last-child]:block" />
          <Button
            variant="ghost"
            asChild
            className="hidden text-zinc-300 hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            <Link to="/auth/login">{t("auth.signIn")}</Link>
          </Button>
          <Button
            asChild
            className="h-10 bg-amber-400 px-3 font-bold text-zinc-950 shadow-lg shadow-amber-500/15 hover:bg-amber-300 sm:px-4"
          >
            <Link to="/auth/signup">
              {t("landing.nav.getStarted")}
              <ArrowRight className="hidden h-4 w-4 sm:block" />
            </Link>
          </Button>
          <button
            type="button"
            aria-label={t("landing.nav.menu")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-white/[0.06] bg-[#0a0a0b] px-4 pb-4 pt-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={localized(link.to)}
              onClick={() => setMenuOpen(false)}
              aria-current={isActive(link.to) ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-3 text-base",
                isActive(link.to)
                  ? "bg-white/5 font-semibold text-amber-300"
                  : "text-zinc-300 hover:bg-white/5 hover:text-white",
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
          <div className="mt-2 border-t border-white/[0.06] pt-3">
            <Link
              to="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-3 text-base text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              {t("auth.signIn")}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
