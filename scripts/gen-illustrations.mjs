/**
 * Generate themed hub-card illustrations via the OpenAI image API, then
 * trim/resize/webp them into public/images/illustrations/.
 *
 *   OPENAI_API_KEY=... node scripts/gen-illustrations.mjs [name ...]
 *
 * With no args, generates all. Pass names (e.g. "people money") to generate a subset.
 * Model + quality are configurable at the top.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const MODEL = process.env.IMG_MODEL || 'gpt-image-2';
const QUALITY = process.env.IMG_QUALITY || 'medium';
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

const STYLE =
  'Flat modern kawaii sticker-style illustration. Thick clean dark outlines, ' +
  'smooth cel shading. The subject is ONLY the object described — no robot, no ' +
  'mascot, no character, no faces unless explicitly part of the object, no text ' +
  'or letters. Centered, with a clear margin of empty space around it. Place it ' +
  'on a COMPLETELY FLAT solid pure-white (#FFFFFF) background — absolutely no ' +
  'drop shadow, no glow, no gradient, no scenery. Vibrant, friendly, professional.';

const SUBJECTS = {
  people:      'Three small friendly diverse human avatar circles grouped together (a little team). Dominant color: fresh blue.',
  hiring:      'A résumé / CV document with a magnifying glass over it. Dominant color: fresh blue.',
  timeleave:   'A wall calendar with a small clock beside it. Dominant color: cyan.',
  performance: 'A shining gold star sitting on a small upward arrow / pedestal. Accent color: blue.',
  payroll:     'A neat stack of cash banknotes with a gold coin. Dominant color: leaf green (#6A9C29).',
  money:       'A single invoice document with a round dollar-sign badge. Dominant color: indigo.',
  accounting:  'A balance scale in perfect balance next to a closed ledger book. Dominant color: orange.',
  reports:     'A bar chart with bars rising and an upward trend arrow. Dominant color: violet.',
};

const which = process.argv.slice(2);
const names = which.length ? which : Object.keys(SUBJECTS);
mkdirSync('/tmp/gen', { recursive: true });
const DEST = new URL('../public/images/illustrations/', import.meta.url).pathname;

async function gen(name) {
  const prompt = `${STYLE}\n\nSubject: ${SUBJECTS[name]}`;
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: QUALITY,
      output_format: 'png',
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`[${name}] HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`[${name}] no image in response: ${JSON.stringify(json).slice(0,200)}`);
  const raw = `/tmp/gen/${name}.png`;
  writeFileSync(raw, Buffer.from(b64, 'base64'));
  // Key out the flat white background: floodfill transparent from all 4 corners
  // (interior whites stay — they're disconnected by the dark outlines), then
  // trim, resize, webp.
  const keyed = `/tmp/gen/${name}-keyed.png`;
  execSync(
    `magick "${raw}" -alpha set -bordercolor white -border 1 ` +
    `-fuzz 12% -fill none ` +
    `-draw "alpha 0,0 floodfill" ` +
    `-shave 1x1 ` +
    `-trim +repage -resize 512x512 "${keyed}"`,
    { stdio: 'pipe' },
  );
  const out = `${DEST}xefe-card-${name}.webp`;
  execSync(`cwebp -q 88 -exact "${keyed}" -o "${out}"`, { stdio: 'pipe' });
  const dims = execSync(`magick identify -format '%wx%h' "${out}"`).toString();
  console.log(`✓ ${name} -> xefe-card-${name}.webp (${dims})`);
}

for (const name of names) {
  if (!SUBJECTS[name]) { console.error(`unknown: ${name}`); continue; }
  try { await gen(name); }
  catch (e) { console.error('✗', e.message); }
}
