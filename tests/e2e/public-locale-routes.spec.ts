/**
 * Every locale-prefixed marketing URL must mount a real page.
 *
 * This exists because of a specific defect on 2026-08-18. Indonesian was added
 * to PREFIXED_PUBLIC_LOCALES, which correctly produced a per-locale static
 * <head>, a sitemap entry and an hreflang link for /id/* — while
 * client/routes.tsx still carried its own hardcoded ["tet", "pt"], so the SPA
 * had no route for the prefix and every /id/* URL rendered NotFound.
 *
 * It shipped because the obvious check does not detect it: curl returns 200 and
 * the correct localized <title> for /id, because BOTH come from the pre-rendered
 * head that scripts/generate-static-heads.ts writes per route. Those are true
 * whether or not React has a route. Only mounting the page tells you.
 *
 * So this walks the real matrix — every LOCALIZED_PUBLIC_PATH in every prefixed
 * locale — and asserts the page is not the 404. It needs no auth, no tenant and
 * no emulator data; it is the cheapest spec in the suite and the one that fails
 * closed the next time a locale is added to only one of the two lists.
 */
import { expect, test } from "@playwright/test";
import {
  LOCALIZED_PUBLIC_PATHS,
  PREFIXED_PUBLIC_LOCALES,
  withLocalePrefix,
} from "../../client/lib/publicLocale";
import { DOCS_MANIFEST } from "../../client/lib/docs/manifest";

// The NotFound page across all four locales. Matching the copy rather than a
// test id keeps this honest: it fails if the user would see "not found", which
// is the thing that actually went wrong.
const NOT_FOUND = /page not found|halaman tidak ditemukan|página não encontrada|pájina la hetan/i;

// Every docs ARTICLE too, not just the /docs hub. publicLocale deliberately
// treats /docs/* as one wildcard (importing the manifest would blow the entry
// bundle), so an article is reachable without anything asserting it renders —
// and each one carries four hand-written locale bodies in its own content file.
// A stray comma in one of those is a blank page in one language only, which is
// exactly the failure nobody notices. Tests have no bundle budget.
const ARTICLE_PATHS = DOCS_MANIFEST.map((entry) => `/docs/${entry.slug}`);

const paths = ["en", ...PREFIXED_PUBLIC_LOCALES].flatMap((locale) =>
  [...LOCALIZED_PUBLIC_PATHS, ...ARTICLE_PATHS].map((path) =>
    withLocalePrefix(path, locale as "en" | "tet" | "pt" | "id"),
  ),
);

test("every locale-prefixed marketing page mounts a real page", async ({ page }) => {
  const broken: string[] = [];

  for (const path of paths) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should serve the SPA`).toBeLessThan(400);
    // Read from #root, never document.body, and wait for React to actually
    // paint into it.
    //
    // index.html ships a pre-React #splash overlay that cycles marketing
    // phrases and the word "Loading...". Two earlier versions of this spec were
    // silently measuring THAT instead of the app — first by waiting on "#root
    // is non-empty" (satisfied in milliseconds by I18nProvider's loading
    // state), then by grepping document.body (which contains the splash). Both
    // passed against a build where every /id/* URL rendered a 404.
    await page.waitForFunction(
      () => {
        const root = document.getElementById("root");
        const text = root?.innerText ?? "";
        return text.trim().length > 40 && !/Loading Xefe/i.test(text);
      },
      undefined,
      { timeout: 20_000 },
    );

    // Search all of the rendered app, not a prefix — the 404 renders inside the
    // normal shell, so chrome pushes "Page not found" past any short slice.
    const rendered = await page.locator("#root").innerText();
    if (NOT_FOUND.test(rendered)) broken.push(path);
  }

  expect(
    broken,
    `these URLs render the 404 page — a locale is probably in ` +
      `PREFIXED_PUBLIC_LOCALES but missing from the routes it drives:\n  ` +
      broken.join("\n  "),
  ).toEqual([]);
});
