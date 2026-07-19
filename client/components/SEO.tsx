import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import {
  localeFromPath,
  withLocalePrefix,
  type PublicLocale,
} from '@/lib/publicLocale';

interface LocalizedMeta {
  title: string;
  description: string;
}

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
  /**
   * Tetun/Portuguese title+description for marketing pages that exist at
   * /tet/... and /pt/... URLs. When set, the rendered tags follow the URL's
   * locale prefix (not the visitor's stored preference — crawlers have none),
   * the canonical is self-referencing per language, and an hreflang cluster
   * is emitted. `url` must be the bare English path.
   */
  alternates?: Partial<Record<Exclude<PublicLocale, 'en'>, LocalizedMeta>>;
}

const BASE_URL = 'https://xefe.tl';
const DEFAULT_IMAGE = `${BASE_URL}/images/illustrations/hero-dashboard.webp`;
const SITE_NAME = 'Xefe';

const OG_LOCALES: Record<PublicLocale, string> = {
  en: 'en_US',
  tet: 'tet_TL',
  pt: 'pt_TL',
};

const DEFAULT_DESCRIPTION = 'Streamline your HR operations with Xefe. Comprehensive HR management including hiring, employee management, time tracking, performance reviews, payroll processing, and reporting.';

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noIndex = false,
  alternates,
}: SEOProps) {
  const { pathname } = useLocation();
  const urlLocale = alternates ? localeFromPath(pathname) : 'en';
  const localized = urlLocale !== 'en' ? alternates?.[urlLocale] : undefined;

  const effectiveTitle = localized?.title ?? title;
  const effectiveDescription = localized?.description ?? description;
  const fullTitle = effectiveTitle
    ? `${effectiveTitle} | ${SITE_NAME}`
    : `${SITE_NAME} - Modern HR Management System`;
  const canonicalUrl = url
    ? `${BASE_URL}${withLocalePrefix(url, urlLocale)}`
    : BASE_URL;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={effectiveDescription} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Robots */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Language alternates for localized marketing pages */}
      {alternates && url && (
        <link rel="alternate" hrefLang="en" href={`${BASE_URL}${url}`} />
      )}
      {alternates && url &&
        (Object.keys(alternates) as Array<Exclude<PublicLocale, 'en'>>).map(
          (loc) => (
            <link
              key={loc}
              rel="alternate"
              hrefLang={loc}
              href={`${BASE_URL}${withLocalePrefix(url, loc)}`}
            />
          ),
        )}
      {alternates && url && (
        <link rel="alternate" hrefLang="x-default" href={`${BASE_URL}${url}`} />
      )}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={effectiveDescription} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={OG_LOCALES[urlLocale]} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={effectiveDescription} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { seoConfig } from "@/lib/seo-config";
