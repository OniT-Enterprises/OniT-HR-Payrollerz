/**
 * ⚠️ DESTRUCTIVE — regenerates client/i18n/locales/{en,tet,pt}.ts wholesale from
 * the master, and **deletes every comment in them**.
 *
 * Measured 2026-08-07: running this took en.ts from 11 comments to 0. Those
 * comments are load-bearing — they sit next to the legal strings and record WHY
 * a citation reads the way it does (e.g. that sick leave prints Art. 33.4 after
 * the repo was found carrying two wrong articles, and that paternity's Art. 60
 * replaced a wrong Art. 59). Losing them loses the reasoning at exactly the spot
 * a future editor would change the wording.
 *
 * Keys and values DO survive, so `i18n:check` stays green afterwards and will
 * not warn you.
 *
 * The locale files are the source of truth at runtime (I18nProvider loads them).
 * The normal direction is the opposite one: edit a locale, then run
 * `pnpm i18n:rebuild-master`. Reach for this script only to bootstrap a locale
 * file that does not exist yet.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translations } from "../client/i18n/translations";

type Locale = "en" | "tet" | "pt" | "id";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, "../client/i18n/locales");

const localeLabels: Record<Locale, string> = {
  en: "English",
  tet: "Tetun",
  pt: "Português",
};

function serializeLocale(locale: Locale) {
  const payload = structuredClone(translations[locale]) as Record<string, unknown>;
  payload.locale = localeLabels;
  return `const messages = ${JSON.stringify(payload, null, 2)} as const;\n\nexport default messages;\n`;
}

mkdirSync(outDir, { recursive: true });

for (const locale of ["en", "tet", "pt", "id"] as const satisfies readonly Locale[]) {
  writeFileSync(path.join(outDir, `${locale}.ts`), serializeLocale(locale));
}
