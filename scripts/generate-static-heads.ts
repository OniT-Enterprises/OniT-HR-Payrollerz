/**
 * Post-build: write per-route copies of dist/spa/index.html with the correct
 * <title>, description, canonical, og:url and social tags baked in for each
 * public marketing route (dist/spa/how-it-works/index.html, ...).
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
import { seoConfig } from "../client/lib/seo-config";

const BASE_URL = "https://xefe.tl";
const SITE_NAME = "Xefe";
const DIST = join(process.cwd(), "dist", "spa");

interface RouteMeta {
  title: string;
  description: string;
  keywords?: string;
  url: string;
}

const ROUTES: RouteMeta[] = [
  seoConfig.landing,
  seoConfig.howItWorks,
  seoConfig.pricing,
  seoConfig.accountantPartners,
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

function buildHtml(template: string, route: RouteMeta): string {
  const fullTitle = `${route.title} | ${SITE_NAME}`;
  const canonical = `${BASE_URL}${route.url === "/" ? "/" : route.url}`;
  const title = escapeAttr(fullTitle);
  const description = escapeAttr(route.description);

  let html = template
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
  ].join("\n    ");

  return html.replace("</head>", `    ${routeTags}\n  </head>`);
}

const template = readFileSync(join(DIST, "index.html"), "utf8");

for (const route of ROUTES) {
  const html = buildHtml(template, route);
  if (route.url === "/") {
    // The root index.html doubles as the SPA fallback; homepage tags are the
    // right default for it.
    writeFileSync(join(DIST, "index.html"), html);
    console.log("static-heads: / (root index.html)");
  } else {
    const dir = join(DIST, ...route.url.split("/").filter(Boolean));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    console.log(`static-heads: ${route.url}`);
  }
}
