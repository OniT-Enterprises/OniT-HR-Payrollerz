/**
 * Locale parity gate.
 *
 * Reads the LOCALE FILES, not the generated master.
 *
 * `client/i18n/I18nProvider.tsx` loads `client/i18n/locales/{en,tet,pt,id}.ts` at
 * runtime; `client/i18n/translations.ts` is a generated artifact nothing loads.
 * Checking the master therefore validated something no user ever sees, and the
 * two drift the moment somebody edits a locale without running
 * `pnpm i18n:rebuild-master` — which `scripts/rebuild-i18n-master.ts` already
 * records as having happened before.
 *
 * On 2026-08-07 that gap shipped `money.ai.foreignCurrency` to main: present in
 * en and pt, absent from tet, and absent from the master in ALL THREE. The old
 * check read the master, saw nothing missing, and passed the deploy — while a
 * Tetun reader got a raw key on screen.
 *
 * So this now does two things:
 *   1. compares the locale files against each other (what actually ships), and
 *   2. fails when the generated master has drifted from them, so the artifact
 *      cannot rot silently again.
 */
import en from "../client/i18n/locales/en";
import tet from "../client/i18n/locales/tet";
import pt from "../client/i18n/locales/pt";
import id from "../client/i18n/locales/id";
import { translations } from "../client/i18n/translations";

type Obj = Record<string, unknown>;

const flatten = (obj: Obj, prefix = ""): string[] => {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatten(v as Obj, next));
    } else {
      keys.push(next);
    }
  }
  return keys;
};

/**
 * The locale files carry a `locale` label map the splitter adds; the master
 * appends those separately. Strip it so the two are comparable — exactly as
 * scripts/rebuild-i18n-master.ts does.
 */
const strip = (o: Obj): Obj => {
  const clone = structuredClone(o) as Obj;
  delete clone.locale;
  return clone;
};

const locales: Record<string, Obj> = {
  en: strip(en as Obj),
  tet: strip(tet as Obj),
  pt: strip(pt as Obj),
  id: strip(id as Obj),
};

let hasIssues = false;

// ── 1. Every locale must carry every English key ───────────────────
const enKeys = new Set(flatten(locales.en));

for (const locale of Object.keys(locales)) {
  if (locale === "en") continue;
  const locKeys = new Set(flatten(locales[locale]));
  const missing = [...enKeys].filter((k) => !locKeys.has(k));
  const extra = [...locKeys].filter((k) => !enKeys.has(k));

  if (missing.length || extra.length) hasIssues = true;

  console.log(
    `Locale ${locale}: missing ${missing.length}, extra ${extra.length}`,
  );
  if (missing.length) {
    console.log("Missing keys:");
    console.log(missing.join("\n"));
  }
  if (extra.length) {
    console.log("Extra keys:");
    console.log(extra.join("\n"));
  }
  console.log("---");
}

// ── 2. The generated master must match the locales it is generated from ──
// Without this, a locale edit without a rebuild leaves the master stale and
// every downstream tool reasoning about a bundle that is not what ships.
for (const locale of Object.keys(locales)) {
  const fromLocale = new Set(flatten(locales[locale]));
  const master = (translations as Obj)[locale];
  if (!master) {
    hasIssues = true;
    console.log(`Master is missing locale "${locale}" entirely.`);
    continue;
  }
  // The master appends its own `locale` label map (see the rebuild script), so
  // strip it on this side too or every locale reads as 3 keys out of sync.
  const fromMaster = new Set(flatten(strip(master as Obj)));
  const staleMissing = [...fromLocale].filter((k) => !fromMaster.has(k));
  const staleExtra = [...fromMaster].filter((k) => !fromLocale.has(k));

  if (staleMissing.length || staleExtra.length) {
    hasIssues = true;
    console.log(
      `translations.ts is STALE for ${locale}: ${staleMissing.length} key(s) in the locale file are absent from the master, ${staleExtra.length} the other way. Run: pnpm i18n:rebuild-master`,
    );
    if (staleMissing.length) console.log(staleMissing.slice(0, 20).join("\n"));
    if (staleExtra.length) console.log(staleExtra.slice(0, 20).join("\n"));
    console.log("---");
  }
}

if (hasIssues) {
  process.exit(1);
}
