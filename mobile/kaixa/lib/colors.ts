/**
 * Kaixa Dark Theme v2
 * Sharp, editorial fintech palette.
 * Near-black backgrounds, terracotta-to-gold accents, warm stone neutrals.
 */

export const colors = {
  // ── Backgrounds ──────────────────────────────────
  bg: '#0B0A08',           // deeper true dark
  bgCard: '#161412',       // card surfaces — warmer, darker
  bgElevated: '#1E1B18',   // modals, elevated cards
  bgSubtle: '#131110',     // warm tinted dark — for slight differentiation
  bgFloat: '#242120',      // floating elements (tooltips, menus)

  // ── Borders ──────────────────────────────────────
  border: '#2A2725',       // subtle border — barely visible
  borderMedium: '#3D3935', // medium emphasis borders
  borderAccent: '#C2714F', // terracotta border for focused elements

  // ── Text ─────────────────────────────────────────
  text: '#F5F5F4',         // stone-100 — primary text
  textSecondary: '#A8A29E', // stone-400 — secondary/muted
  textTertiary: '#6B6560', // stone-500 — hints, timestamps, dimmer
  textInverse: '#0B0A08',  // for text on bright buttons

  // ── Brand — Terracotta ───────────────────────────
  primary: '#E08D6B',      // terracotta-400 — bumped for dark bg contrast
  primaryMuted: '#C2714F', // terracotta-500 — the OG brand color
  primaryDark: '#8A452E',  // terracotta-700 — subtle tints
  primaryGlow: 'rgba(224, 141, 107, 0.08)', // very subtle brand wash

  // ── Gradient (terracotta → amber/gold) ───────────
  gradientStart: '#C2714F', // terracotta
  gradientMid: '#D4944A',   // warm amber bridge
  gradientEnd: '#EAB308',   // amber/gold

  // ── Secondary — Teal ─────────────────────────────
  secondary: '#4DB3A3',    // teal-400 — brighter on dark
  secondaryMuted: '#2D8F82',

  // ── Semantic ─────────────────────────────────────
  success: '#4ADE80',      // green-400
  successMuted: '#16A34A', // green-600
  warning: '#FACC15',      // yellow-400
  error: '#F87171',        // red-400
  errorMuted: '#DC2626',   // red-600
  info: '#60A5FA',         // blue-400

  // ── Money ────────────────────────────────────────
  moneyIn: '#34D399',      // emerald-400 — slightly shifted for premium feel
  moneyInBg: 'rgba(52, 211, 153, 0.08)',
  moneyOut: '#FB7185',     // rose-400 — warmer red
  moneyOutBg: 'rgba(251, 113, 133, 0.08)',

  // ── Surfaces with opacity ────────────────────────
  glass: 'rgba(255, 255, 255, 0.03)',
  glassStrong: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  shadow: 'rgba(0, 0, 0, 0.6)',

  // ── Raw values ───────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;
