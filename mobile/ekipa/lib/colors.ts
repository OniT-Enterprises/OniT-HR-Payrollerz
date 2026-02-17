/**
 * Ekipa Light Theme
 * Clean, professional light palette — teal primary, navy accents.
 * Designed for employee self-service: approachable and readable.
 */

export const colors = {
  // ── Backgrounds ──────────────────────────────────
  bg: '#F8FAFC',           // slate-50
  bgCard: '#FFFFFF',       // white cards
  bgElevated: '#FFFFFF',   // modals, elevated
  bgSubtle: '#F1F5F9',    // slate-100 — slight differentiation
  bgFloat: '#FFFFFF',      // floating elements

  // ── Borders ──────────────────────────────────────
  border: '#E2E8F0',       // slate-200
  borderMedium: '#CBD5E1', // slate-300
  borderAccent: '#0D9488', // teal-600

  // ── Text ─────────────────────────────────────────
  text: '#0F172A',         // slate-900
  textSecondary: '#475569', // slate-600
  textTertiary: '#94A3B8', // slate-400
  textInverse: '#FFFFFF',  // for text on teal buttons

  // ── Brand — Teal ─────────────────────────────────
  primary: '#0D9488',      // teal-600
  primaryLight: '#14B8A6', // teal-500
  primaryDark: '#0F766E',  // teal-700
  primaryBg: '#F0FDFA',   // teal-50 — subtle teal wash

  // ── Secondary — Navy ─────────────────────────────
  secondary: '#1E3A5F',    // navy
  secondaryLight: '#2D5286',

  // ── Semantic ─────────────────────────────────────
  success: '#16A34A',      // green-600
  successBg: '#F0FDF4',   // green-50
  warning: '#D97706',      // amber-600
  warningBg: '#FFFBEB',   // amber-50
  error: '#DC2626',        // red-600
  errorBg: '#FEF2F2',     // red-50
  info: '#2563EB',         // blue-600
  infoBg: '#EFF6FF',      // blue-50

  // ── Leave status ─────────────────────────────────
  pending: '#D97706',      // amber
  pendingBg: '#FFFBEB',
  approved: '#16A34A',     // green
  approvedBg: '#F0FDF4',
  rejected: '#DC2626',     // red
  rejectedBg: '#FEF2F2',
  cancelled: '#6B7280',    // gray
  cancelledBg: '#F9FAFB',

  // ── Raw values ───────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;
