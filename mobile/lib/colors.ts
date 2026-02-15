/**
 * Kaixa Dark Theme
 * Warm dark palette inspired by Meza landing page:
 * near-black backgrounds, terracotta-to-gold accents, warm stone neutrals
 */

export const colors = {
  // ── Backgrounds ──────────────────────────────────
  bg: '#0C0A09',           // stone-950 — deepest background
  bgCard: '#1C1917',       // stone-900 — card surfaces
  bgElevated: '#292524',   // stone-800 — modals, elevated cards
  bgSubtle: '#1A1412',     // warm tinted dark — for slight differentiation

  // ── Borders ──────────────────────────────────────
  border: '#44403C',       // stone-700
  borderSubtle: '#292524', // stone-800 — very subtle dividers
  borderAccent: '#C2714F', // terracotta border for focused elements

  // ── Text ─────────────────────────────────────────
  text: '#FAFAF9',         // stone-50 — primary text
  textSecondary: '#A8A29E', // stone-400 — secondary/muted
  textTertiary: '#78716C', // stone-500 — hints, timestamps
  textInverse: '#0C0A09',  // for text on bright buttons

  // ── Brand — Terracotta ───────────────────────────
  primary: '#E08D6B',      // terracotta-400 — bumped for dark bg contrast
  primaryMuted: '#C2714F', // terracotta-500 — the OG brand color
  primaryDark: '#8A452E',  // terracotta-700 — subtle tints

  // ── Gradient (terracotta → amber/gold) ───────────
  gradientStart: '#C2714F', // terracotta
  gradientEnd: '#EAB308',   // amber/gold

  // ── Secondary — Teal ─────────────────────────────
  secondary: '#4DB3A3',    // teal-400 — brighter on dark
  secondaryMuted: '#2D8F82',

  // ── Semantic ─────────────────────────────────────
  success: '#4ADE80',      // green-400 — brighter on dark
  successMuted: '#16A34A', // green-600 — for backgrounds
  warning: '#FACC15',      // yellow-400
  error: '#F87171',        // red-400 — softer on dark
  errorMuted: '#DC2626',   // red-600 — for backgrounds
  info: '#60A5FA',         // blue-400

  // ── Money ────────────────────────────────────────
  moneyIn: '#4ADE80',      // bright green on dark
  moneyInBg: 'rgba(74, 222, 128, 0.1)',  // subtle green tint
  moneyOut: '#F87171',     // soft red on dark
  moneyOutBg: 'rgba(248, 113, 113, 0.1)', // subtle red tint

  // ── Surfaces with opacity ────────────────────────
  glass: 'rgba(255, 255, 255, 0.05)',     // glassmorphic overlay
  glassStrong: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  shadow: 'rgba(0, 0, 0, 0.5)',

  // ── Raw values ───────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;
