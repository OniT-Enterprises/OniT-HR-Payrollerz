/**
 * Ekipa Dark Theme — Meza-inspired
 * Premium dark palette with module-specific accent colors.
 * Matches the Meza web dashboard design language.
 */

export const colors = {
  // ── Backgrounds ──────────────────────────────────
  bg: '#09090B',            // near-black base (zinc-950)
  bgCard: '#18181B',        // zinc-900 — card surfaces
  bgElevated: '#27272A',    // zinc-800 — raised surfaces
  bgSubtle: '#131316',      // subtle differentiation
  bgFloat: '#27272A',       // floating elements

  // ── Borders ──────────────────────────────────────
  border: 'rgba(63, 63, 70, 0.5)',    // zinc-700 at 50% — subtle
  borderMedium: '#3F3F46',             // zinc-700 — medium emphasis
  borderAccent: '#22C55E',             // green accent border

  // ── Text ─────────────────────────────────────────
  text: '#F1F5F9',          // slate-100 — primary text
  textSecondary: '#94A3B8', // slate-400 — secondary
  textTertiary: '#64748B',  // slate-500 — muted
  textInverse: '#09090B',   // text on colored buttons

  // ── Brand — Green (Meza) ─────────────────────────
  primary: '#22C55E',        // green-500
  primaryLight: '#4ADE80',   // green-400
  primaryDark: '#16A34A',    // green-600
  primaryBg: 'rgba(34, 197, 94, 0.10)',

  // ── Module Accents ─────────────────────────────
  // Each tab/section uses its own accent color (like Meza)
  blue: '#3B82F6',
  blueBg: 'rgba(59, 130, 246, 0.10)',
  violet: '#8B5CF6',
  violetBg: 'rgba(139, 92, 246, 0.10)',
  orange: '#F97316',
  orangeBg: 'rgba(249, 115, 22, 0.10)',
  emerald: '#10B981',
  emeraldBg: 'rgba(16, 185, 129, 0.10)',
  cyan: '#06B6D4',
  cyanBg: 'rgba(6, 182, 212, 0.10)',

  // ── Secondary ────────────────────────────────────
  secondary: '#27272A',      // zinc-800
  secondaryLight: '#3F3F46', // zinc-700

  // ── Semantic ─────────────────────────────────────
  success: '#10B981',        // emerald-500
  successBg: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',        // amber-500
  warningBg: 'rgba(245, 158, 11, 0.12)',
  error: '#EF4444',          // red-500
  errorBg: 'rgba(239, 68, 68, 0.12)',
  info: '#3B82F6',           // blue-500
  infoBg: 'rgba(59, 130, 246, 0.12)',

  // ── Leave status ─────────────────────────────────
  pending: '#F59E0B',
  pendingBg: 'rgba(245, 158, 11, 0.12)',
  approved: '#10B981',
  approvedBg: 'rgba(16, 185, 129, 0.12)',
  rejected: '#EF4444',
  rejectedBg: 'rgba(239, 68, 68, 0.12)',
  cancelled: '#64748B',
  cancelledBg: 'rgba(100, 116, 139, 0.12)',

  // ── New module accents ────────────────────────────
  amber: '#F59E0B',
  amberBg: 'rgba(245, 158, 11, 0.10)',
  teal: '#0D9488',
  tealBg: 'rgba(13, 148, 136, 0.10)',
  red: '#EF4444',
  redBg: 'rgba(239, 68, 68, 0.10)',

  // ── Raw values ───────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;
