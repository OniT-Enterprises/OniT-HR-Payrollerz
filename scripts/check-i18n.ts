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

const enKeys = new Set(flatten(translations.en as Obj));
let hasIssues = false;

for (const locale of Object.keys(translations)) {
  if (locale === "en") continue;
  const locKeys = new Set(flatten((translations as Obj)[locale] as Obj));
  const missing = [...enKeys].filter((k) => !locKeys.has(k));
  const extra = [...locKeys].filter((k) => !enKeys.has(k));

  if (missing.length || extra.length) {
    hasIssues = true;
  }

  console.log(`Locale ${locale}: missing ${missing.length}, extra ${extra.length}`);
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

if (hasIssues) {
  process.exit(1);
}
