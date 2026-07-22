import { cn } from "@/lib/utils";
import { getCardIconSvg } from "@/components/ui/card-icon-registry";

/**
 * Theme-adaptive hub-card icon. The SVGs are inlined (not <img>) so their
 * `currentColor` strokes inherit the surrounding text color — light on dark,
 * dark on light — while the gold accent stays fixed. Set
 * `--card-icon-accent:currentColor` (via a class) to render an icon fully
 * monochrome. (Note: don't reuse the app's global `--accent` token here — it's a
 * shadcn HSL triplet, not a color, so it won't work as a `fill` value.)
 *
 * Add a new icon by dropping `client/assets/card-icons/<name>.svg` (strokes
 * `currentColor`, accent `var(--card-icon-accent,#f5be32)`); it's picked up automatically.
 */
export function CardIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const svg = getCardIconSvg(name);
  if (!svg) return null;
  return (
    <span
      aria-hidden
      className={cn("inline-flex items-center justify-center", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
