/**
 * The gold crescent — the mark above the "x" in the Xefe logo, and the only
 * decorative shape permitted on public pages (docs/DESIGN_MARKETING.md §4).
 * It curves UPWARD like a "U" (a moon on its back), matching the logo.
 * Single source of truth: pages must import this, never redefine the path.
 */
export function Crescent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d="M12 38 A46 46 0 0 0 88 60 A60 60 0 0 1 12 38 Z"
        fill="currentColor"
      />
    </svg>
  );
}
