import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { SEO, seoConfig } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SEO {...seoConfig.notFound} />
      <div className="text-center px-6 max-w-md">
        <img
          src="/images/illustrations/meza-404.webp"
          alt="Lost desk character at a crossroads"
          className="w-64 h-64 mx-auto mb-8 drop-shadow-2xl"
        />
        <h1 className="text-5xl font-bold tracking-tight text-foreground mb-3">
          {t("notFound.title")}
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          {t("notFound.message")}
        </p>
        <Button asChild size="lg">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("notFound.returnHome")}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
