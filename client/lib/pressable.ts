/**
 * Shared press/focus treatment for tappable surfaces (cards, rows, chips).
 *
 * Tactile feedback for tappable surfaces: quick press scale + visible focus
 * ring. Hover feedback stays border + fill (no shadows, no translation) per
 * the style guide's motion rules.
 */
export const PRESSABLE =
  "transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
