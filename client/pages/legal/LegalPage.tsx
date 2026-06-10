/**
 * Public legal pages: /privacy and /terms.
 * Plain-language content lives in i18n under legal.privacy / legal.terms
 * (sections s1..sN; the component stops at the first missing section key).
 */
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { useI18n } from "@/i18n/I18nProvider";

const MAX_SECTIONS = 10;

export default function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const { t } = useI18n();
  const base = `legal.${kind}`;

  const sections: { title: string; body: string }[] = [];
  for (let i = 1; i <= MAX_SECTIONS; i++) {
    const title = t(`${base}.s${i}Title`);
    const body = t(`${base}.s${i}Body`);
    // t() echoes the key back when a translation is missing
    if (!title || title === `${base}.s${i}Title`) break;
    sections.push({ title, body });
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title={t(`${base}.title`)} description={t(`${base}.intro`)} />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/images/illustrations/primos-books-logo-dark.webp"
              alt="Primos Books"
              className="h-8 w-auto dark:hidden"
            />
            <img
              src="/images/illustrations/primos-books-logo-light.webp"
              alt="Primos Books"
              className="h-8 w-auto hidden dark:block"
            />
          </Link>
          <LocaleSwitcher />
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-1">{t(`${base}.title`)}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t(`${base}.updated`)}</p>
        <p className="text-base leading-relaxed mb-8">{t(`${base}.intro`)}</p>

        <div className="space-y-6">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold mb-1.5">{s.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("legal.backHome")}
            </Link>
          </Button>
          <Link
            to={kind === "privacy" ? "/terms" : "/privacy"}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {kind === "privacy" ? t("legal.terms.title") : t("legal.privacy.title")}
          </Link>
        </div>
      </div>
    </div>
  );
}
