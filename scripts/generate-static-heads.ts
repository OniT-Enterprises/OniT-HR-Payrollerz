/**
 * Post-build: write per-route copies of dist/spa/index.html with the correct
 * <title>, description, canonical, og:url and social tags baked in for each
 * public marketing route (dist/spa/how-it-works/index.html, ...).
 *
 * Marketing routes with `alternates` in seo-config also get Tetun and
 * Portuguese copies under /tet/... and /pt/... with translated title and
 * description, a matching <html lang>, and an hreflang cluster
 * (en + tet + pt + x-default) baked into all three variants — this is what
 * lets Google index each language as its own URL.
 *
 * Why: the SPA serves one index.html for every route, so crawlers that don't
 * execute JS see the homepage's metadata everywhere. nginx's
 * `try_files $uri $uri/ /index.html` picks these files up automatically.
 * react-helmet still owns the tags at runtime; these are the no-JS fallback.
 *
 * Run via the build script: `vite build && ... && tsx scripts/generate-static-heads.ts`
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DOCS_MANIFEST } from "../client/lib/docs/manifest";
import { seoConfig } from "../client/lib/seo-config";

const BASE_URL = "https://xefe.tl";
const SITE_NAME = "Xefe";
const DIST = join(process.cwd(), "dist", "spa");

interface LocalizedMeta {
  title: string;
  description: string;
}

interface RouteMeta {
  title: string;
  description: string;
  keywords?: string;
  url: string;
  alternates?: Partial<Record<"tet" | "pt", LocalizedMeta>>;
}

const ROUTES: RouteMeta[] = [
  seoConfig.landing,
  seoConfig.howItWorks,
  seoConfig.pricing,
  seoConfig.accountantPartners,
  seoConfig.engine,
  seoConfig.security,
  seoConfig.docsIndex,
  ...DOCS_MANIFEST.map((entry) => entry.seo),
  seoConfig.signup,
  {
    title: "Privacy Policy",
    description:
      "How Xefe stores and uses account and payroll information for businesses in Timor-Leste.",
    url: "/privacy",
  },
  {
    title: "Terms of Service",
    description:
      "The terms that apply when you create an account or use Xefe's HR, payroll and accounting tools.",
    url: "/terms",
  },
];

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function prefixedUrl(bareUrl: string, locale: "en" | "tet" | "pt"): string {
  if (locale === "en") return bareUrl;
  return bareUrl === "/" ? `/${locale}` : `/${locale}${bareUrl}`;
}

function buildHtml(
  template: string,
  route: RouteMeta,
  locale: "en" | "tet" | "pt",
): string {
  const localized = locale !== "en" ? route.alternates?.[locale] : undefined;
  const fullTitle = `${localized?.title ?? route.title} | ${SITE_NAME}`;
  const path = prefixedUrl(route.url, locale);
  const canonical = `${BASE_URL}${path === "/" ? "/" : path}`;
  const title = escapeAttr(fullTitle);
  const description = escapeAttr(localized?.description ?? route.description);

  let html = template
    .replace(/(<html[^>]*\blang=")[^"]*(")/, `$1${locale}$2`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /(<meta name="title" content=")[^"]*(")/,
      `$1${title}$2`,
    )
    .replace(
      /(<meta name="description" content=")[^"]*(")/,
      `$1${description}$2`,
    )
    .replace(
      /(<meta property="og:title" content=")[^"]*(")/,
      `$1${title}$2`,
    )
    .replace(
      /(<meta property="og:description" content=")[^"]*(")/,
      `$1${description}$2`,
    )
    .replace(
      /(<meta name="twitter:title" content=")[^"]*(")/,
      `$1${title}$2`,
    )
    .replace(
      /(<meta name="twitter:description" content=")[^"]*(")/,
      `$1${description}$2`,
    );

  if (route.keywords) {
    html = html.replace(
      /(<meta name="keywords" content=")[^"]*(")/,
      `$1${escapeAttr(route.keywords)}$2`,
    );
  }

  const routeTags = [
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta name="twitter:url" content="${canonical}" />`,
  ];

  if (route.alternates) {
    routeTags.push(
      `<link rel="alternate" hreflang="en" href="${BASE_URL}${route.url}" />`,
    );
    for (const loc of Object.keys(route.alternates) as Array<"tet" | "pt">) {
      routeTags.push(
        `<link rel="alternate" hreflang="${loc}" href="${BASE_URL}${prefixedUrl(route.url, loc)}" />`,
      );
    }
    routeTags.push(
      `<link rel="alternate" hreflang="x-default" href="${BASE_URL}${route.url}" />`,
    );
  }

  return html.replace("</head>", `    ${routeTags.join("\n    ")}\n  </head>`);
}

function writeRoute(html: string, path: string) {
  if (path === "/") {
    // The root index.html doubles as the SPA fallback; homepage tags are the
    // right default for it.
    writeFileSync(join(DIST, "index.html"), html);
    console.log("static-heads: / (root index.html)");
  } else {
    const dir = join(DIST, ...path.split("/").filter(Boolean));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    console.log(`static-heads: ${path}`);
  }
}

const template = readFileSync(join(DIST, "index.html"), "utf8");

for (const route of ROUTES) {
  writeRoute(buildHtml(template, route, "en"), route.url);
  if (route.alternates) {
    for (const loc of Object.keys(route.alternates) as Array<"tet" | "pt">) {
      writeRoute(buildHtml(template, route, loc), prefixedUrl(route.url, loc));
    }
  }
}
