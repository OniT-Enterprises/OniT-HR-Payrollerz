/**
 * Generate the theme-adaptive hub-card icon set from Phosphor's duotone weight.
 *
 *   node scripts/gen-card-icons.mjs            # regenerate all
 *   node scripts/gen-card-icons.mjs payroll    # just one
 *
 * Fetches each icon's duotone SVG, then recolors it so it works on light AND dark:
 *   - the detail layer stays `currentColor`  (flips with the theme)
 *   - the fill layer (Phosphor's opacity="0.2" path) becomes brand gold via
 *     `var(--card-icon-accent,#f5be32)`  (set that var to recolor; default = gold)
 *
 * Output: client/assets/card-icons/<id>.svg — picked up automatically by
 * client/components/ui/CardIcon.tsx (see it for how these are consumed).
 *
 * NOTE: don't use `var(--accent,…)` here — the app's global `--accent` is a
 * shadcn HSL triplet, not a color, and would break the fill. Hence the namespaced var.
 */
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../client/assets/card-icons");
const BASE = "https://unpkg.com/@phosphor-icons/core@2/assets/duotone";

// hub-card id -> Phosphor duotone icon name
const MAP = {
  people: "users-three",
  hiring: "briefcase",
  timeleave: "calendar-check",       // was calendar-blank (too plain, no fill)
  performance: "target",
  "tl-attendance": "user-check",
  "tl-leave": "umbrella-simple",     // was airplane-tilt (read as travel)
  "tl-timetracking": "timer",
  "tl-shifts": "calendar-dots",
  payroll: "money",
  "pr-history": "clock-counter-clockwise",
  "pr-bank": "bank",
  "pr-tax": "file-text",             // was percent (too abstract for a filing)
  money: "currency-circle-dollar",
  "mn-bills": "receipt",
  "mn-expenses": "wallet",
  accounting: "calculator",
  "ac-chart": "book-open",
  "ac-journal": "note-pencil",
  "ac-balance": "scales",
  reports: "chart-line-up",
};

function recolor(svg) {
  return svg
    .replace("<svg", '<svg width="100%" height="100%"')
    .replace(/opacity="0?\.2"/g, 'fill="var(--card-icon-accent,#f5be32)" opacity="0.9"');
}

const which = process.argv.slice(2);
const ids = which.length ? which.filter((n) => MAP[n]) : Object.keys(MAP);
mkdirSync(OUT, { recursive: true });

for (const id of ids) {
  const res = await fetch(`${BASE}/${MAP[id]}-duotone.svg`);
  if (!res.ok) {
    console.error(`✗ ${id} (${MAP[id]}): HTTP ${res.status}`);
    continue;
  }
  const svg = await res.text();
  if (!svg.includes("opacity")) {
    console.error(`✗ ${id} (${MAP[id]}): no duotone fill layer found`);
    continue;
  }
  writeFileSync(`${OUT}/${id}.svg`, recolor(svg));
  console.log(`✓ ${id} <- ${MAP[id]}`);
}
