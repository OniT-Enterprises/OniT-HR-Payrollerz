import { promises as fs } from "node:fs";
import path from "node:path";
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

const walk = async (dir: string, collected: string[] = []) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      await walk(fullPath, collected);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    collected.push(fullPath);
  }
  return collected;
};

const extractKeys = (content: string) => {
  const keys: string[] = [];
  const dynamic: string[] = [];
  const regex = /\bt\(\s*(['"`])((?:\\.|(?!\1).)*?)\1/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content))) {
    const key = match[2];
    if (match[1] === "`" && key.includes("${")) {
      dynamic.push(key);
      continue;
    }
    keys.push(key);
  }
  return { keys, dynamic };
};

const run = async () => {
  const root = path.resolve(process.cwd(), "client");
  const files = await walk(root);

  const usedKeys = new Set<string>();
  const dynamicKeys: string[] = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const { keys, dynamic } = extractKeys(content);
    for (const key of keys) {
      usedKeys.add(key);
    }
    for (const key of dynamic) {
      dynamicKeys.push(`${file}: ${key}`);
    }
  }

  const enKeys = new Set(flatten(translations.en as Obj));
  const missingInEn = [...usedKeys].filter((key) => !enKeys.has(key));
  const unusedInEn = [...enKeys].filter((key) => !usedKeys.has(key));

  if (missingInEn.length) {
    console.log(`Missing in translations.en: ${missingInEn.length}`);
    console.log(missingInEn.sort().join("\n"));
  } else {
    console.log("Missing in translations.en: 0");
  }

  console.log(`Unused in translations.en: ${unusedInEn.length}`);

  if (dynamicKeys.length) {
    console.log(`Dynamic keys skipped: ${dynamicKeys.length}`);
    console.log(dynamicKeys.join("\n"));
  }

  if (missingInEn.length) {
    process.exit(1);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
