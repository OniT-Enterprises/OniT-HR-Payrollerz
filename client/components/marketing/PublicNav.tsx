/**
 * Shared top navigation for the public marketing pages (/, /how-it-works,
 * /pricing, /accountants). Every menu item is a real page — never a
 * scroll-to-section link — and the bar is identical on every page with the
 * current page highlighted, so moving around the site never disorients.
 * In-page sections belong in PublicSectionNav, not here.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";

const NAV_LINKS = [
  { to: "/", labelKey: "landing.nav.home" },
  { to: "/how-it-works", labelKey: "landing.simple.nav.howItWorks" },
  { to: "/pricing", labelKey: "landing.nav.pricing" },
  { to: "/accountants", labelKey: "landing.nav.forAccountants" },
] as const;

export function PublicNav() {
  const { t } = useI18n();
  const location = useLocation();
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

  // "/landing" renders the same Landing page as "/", so Home stays lit there.
  const isActive = (to: string) =>
    to === "/"
      ? location.pathname === "/" || location.pathname === "/landing"
      : location.pathname === to;

  return (
    <nav
      aria-label={t("common.mainNavigation")}
      className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0b]/95 md:bg-[#0a0a0b]/85 md:backdrop-blur-lg"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="Xefe" className="shrink-0">
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
              to={link.to}
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
              to={link.to}
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
