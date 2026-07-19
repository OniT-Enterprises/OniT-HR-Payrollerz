import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const BUILD_DIR = join(process.cwd(), "dist", "spa");
const INDEX_PATH = join(BUILD_DIR, "index.html");
// Raised 300 -> 308 on the app-wide Lucide->Phosphor icon migration: Phosphor's
// paths are richer than Lucide's, adding ~4 KiB gzip to the initial page across
// the ~166 shimmed icons (already minified: integer coords, dead nodes stripped).
// Deliberate trade for one consistent icon family app-wide. Keep this tight.
// Raised 308 -> 310 (2026-07-18): marketing grain tile + sanctioned motion
// utilities in the entry CSS, plus the publicPaths/boot-splash refactor,
// added ~0.3 KiB gzip. Deliberate features, not creep. Keep this tight.
// Raised 310 -> 312 (2026-07-19): locale-prefixed marketing routes (/tet, /pt)
// + hreflang SEO plumbing live in the entry (routes.tsx, publicLocale,
// publicPaths); ~0.8 KiB gzip, and CI's Node gzips ~0.8 KiB larger than local.
// Deliberate feature, not creep. Keep this tight.
const MAX_INITIAL_GZIP_KIB = 312;
const FORBIDDEN_INITIAL_CHUNKS = [
  "firebase-firestore",
  "react-pdf",
  "pdfkit",
  "exceljs",
];

const html = readFileSync(INDEX_PATH, "utf8");
const referencedAssets = [
  ...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="\/([^"]+)"[^>]*>/g),
]
  .map((match) => match[1])
  .filter((asset) => /\.(?:js|css)$/.test(asset));
const uniqueAssets = [...new Set(referencedAssets)];

const forbidden = uniqueAssets.filter((asset) =>
  FORBIDDEN_INITIAL_CHUNKS.some((chunk) => asset.includes(chunk)),
);
if (forbidden.length > 0) {
  throw new Error(
    `Heavy feature chunk leaked into the initial page: ${forbidden.join(", ")}`,
  );
}

const compressedBytes = uniqueAssets.reduce(
  (total, asset) => total + gzipSync(readFileSync(join(BUILD_DIR, asset))).byteLength,
  gzipSync(Buffer.from(html)).byteLength,
);
const compressedKib = compressedBytes / 1024;

console.log(
  `Initial page: ${compressedKib.toFixed(1)} KiB gzip / ${MAX_INITIAL_GZIP_KIB} KiB budget`,
);

if (compressedKib > MAX_INITIAL_GZIP_KIB) {
  throw new Error(
    `Initial page exceeds its gzip budget by ${(compressedKib - MAX_INITIAL_GZIP_KIB).toFixed(1)} KiB`,
  );
}
