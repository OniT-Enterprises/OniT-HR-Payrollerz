import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translations } from "../client/i18n/translations";

type Locale = "en" | "tet" | "pt";

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

for (const locale of ["en", "tet", "pt"] as const satisfies readonly Locale[]) {
  writeFileSync(path.join(outDir, `${locale}.ts`), serializeLocale(locale));
}
