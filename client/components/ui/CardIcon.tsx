import * as React from "react";
import { cn } from "@/lib/utils";

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
const raw = import.meta.glob("../../assets/card-icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const ICONS: Record<string, string> = {};
for (const [path, svg] of Object.entries(raw)) {
  const name = path.split("/").pop()!.replace(/\.svg$/, "");
  ICONS[name] = svg;
}

export function hasCardIcon(name?: string | null): boolean {
  return !!name && name in ICONS;
}

/** Derive an icon key from an old `art` path, e.g. ".../xefe-card-mn-bills.webp" -> "mn-bills". */
export function cardIconNameFromArt(art?: string | null): string | undefined {
  return art?.match(/xefe-card-(.+)\.(?:webp|png|svg)$/)?.[1];
}

export function CardIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const svg = ICONS[name];
  if (!svg) return null;
  return (
    <span
      aria-hidden
      className={cn("inline-flex items-center justify-center", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
