/**
 * Rebuild client/i18n/translations.ts (the master bundle used by the i18n
 * check/split tooling) from the per-locale runtime files.
 *
 * The app loads client/i18n/locales/{en,tet,pt}.ts at runtime, and those files
 * had drifted ahead of the master (new keys added directly). This regenerates
 * the master so master === locales, keeping `i18n:check` accurate and the
 * `split-i18n-locales` direction safe (idempotent).
 *
 * Run with: pnpm i18n:rebuild-master
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import en from "../client/i18n/locales/en";
import tet from "../client/i18n/locales/tet";
import pt from "../client/i18n/locales/pt";

type Obj = Record<string, unknown>;

// The runtime locale files carry a `locale` label map (added by the splitter).
// The master appends those labels separately at the end, so strip them here.
const strip = (o: Obj): Obj => {
  const clone = structuredClone(o) as Obj;
  delete clone.locale;
  return clone;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../client/i18n/translations.ts");

const body = {
  en: strip(en as Obj),
  tet: strip(tet as Obj),
  pt: strip(pt as Obj),
};

const content =
  `// Auto-generated translations file\n` +
  `// Rebuilt from client/i18n/locales/{en,tet,pt}.ts via scripts/rebuild-i18n-master.ts\n\n` +
  `export const translations = ${JSON.stringify(body, null, 2)} as const;\n\n\n` +
  `// Add locale labels to each translation set dynamically\n` +
  `// These are referenced by I18nProvider for the language switcher\n` +
  `(translations.en as Record<string, unknown>).locale = { en: 'English', tet: 'Tetun', pt: 'Português' };\n` +
  `(translations.tet as Record<string, unknown>).locale = { en: 'English', tet: 'Tetun', pt: 'Português' };\n` +
  `(translations.pt as Record<string, unknown>).locale = { en: 'English', tet: 'Tetun', pt: 'Português' };\n`;

writeFileSync(outPath, content);
console.log(`Rebuilt ${path.relative(process.cwd(), outPath)} from locale files`);
