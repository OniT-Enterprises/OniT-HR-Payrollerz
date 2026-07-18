/* Generate mobile/ekipa/lib/phosphor-icons.tsx from the web Phosphor shim +
   unpkg fetches for icons the web shim doesn't carry. */
import { readFileSync, writeFileSync } from "node:fs";

const WEB_SHIM = "/Users/tonyfranklin/Sites/xefe/client/lib/lucide-react-shim.tsx";
const OUT = "/Users/tonyfranklin/Sites/xefe/mobile/ekipa/lib/phosphor-icons.tsx";

const NEEDED = `AlertCircle AlertTriangle ArrowLeft ArrowRight ArrowUpRight Bell Briefcase Calendar CalendarCheck CalendarClock CalendarDays Camera Car Check CheckCircle2 ChevronDown ChevronLeft ChevronRight ChevronUp ClipboardCheck Clock CloudOff Copy CreditCard Crown DollarSign Edit3 Eye FileText Fingerprint Heart History Home Inbox Info Landmark Lightbulb LogOut Mail MapPin Megaphone MessageSquare Moon MoreHorizontal Palmtree Phone Pin Plane Plus QrCode Receipt RefreshCw RotateCcw Save Search Send Share2 Shield ShieldAlert ShieldCheck ShoppingBag Sparkles Star Sun Sunset Ticket Trash2 TrendingDown TrendingUp User Users Utensils Wrench X XCircle Zap`.split(" ");

// Lucide name -> Phosphor core asset (regular weight) for icons missing from the web shim
const FETCH_MAP = {
  CloudOff: "cloud-slash",
  Edit3: "pencil-simple-line",
  Fingerprint: "fingerprint",
  Inbox: "tray",
  Lightbulb: "lightbulb",
  Palmtree: "tree-palm",
  Plane: "airplane-tilt",
  QrCode: "qr-code",
  ShoppingBag: "bag",
  Sunset: "sun-horizon",
  Ticket: "ticket",
};

// The web shim's inlined paths are aggressively minified and a few are not
// strictly valid SVG (browsers forgive; Android's react-native-svg parser
// throws). So we only take the Lucide->Phosphor NAME mapping from the web
// shim and fetch every path fresh from the canonical @phosphor-icons/core
// regular-weight assets.
const src = readFileSync(WEB_SHIM, "utf8");
const exportMap = {};
for (const m of src.matchAll(/export const (\w+) = make\(P_(\w+)\);/g)) exportMap[m[1]] = m[2];

const kebab = (s) =>
  s
    .replace(/([A-Za-z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

const entries = [];
for (const name of NEEDED) {
  const asset = FETCH_MAP[name] ?? (exportMap[name] && kebab(exportMap[name]));
  if (!asset) throw new Error(`no source for ${name}`);
  const url = `https://unpkg.com/@phosphor-icons/core/assets/regular/${asset}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${name} (${url})`);
  const svg = await res.text();
  const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  if (!ds.length) throw new Error(`no path for ${name} (${url}) -> ${svg.slice(0, 120)}`);
  entries.push([name, ds]);
  console.log("fetched", name, "<-", asset);
}

const body = entries
  .map(([name, ds]) => `export const ${name} = make(${JSON.stringify(ds)});`)
  .join("\n");

writeFileSync(
  OUT,
  `/**
 * Phosphor icon shim for Ekipa — GENERATED, do not hand-edit.
 *
 * metro.config.js aliases 'lucide-react-native' to this file, so every icon
 * import in the app renders the same Phosphor (regular weight) glyphs as the
 * Xefe web dashboard (client/lib/lucide-react-shim.tsx) — one brand-wide icon
 * family, no per-file edits. Regenerate: scripts note in that web shim +
 * scratchpad gen-rn-phosphor.mjs (fetches non-web icons from
 * @phosphor-icons/core regular assets).
 *
 * Phosphor is fill-based, so the Lucide 'strokeWidth' prop is accepted and
 * ignored.
 */
import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface IconProps {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  style?: object;
}

export type LucideIcon = React.ComponentType<IconProps>;

const make = (ds: string[]): LucideIcon => {
  const Icon = ({ size = 24, color = '#F1F5F9', style }: IconProps) => (
    <Svg viewBox="0 0 256 256" width={Number(size)} height={Number(size)} style={style}>
      {ds.map((d, i) => (
        <Path key={i} d={d} fill={color} />
      ))}
    </Svg>
  );
  return Icon;
};

${body}
`,
);
console.log(`wrote ${OUT} with ${entries.length} icons`);
