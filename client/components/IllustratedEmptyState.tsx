import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface IllustratedEmptyStateProps {
  imageSrc: string;
  title?: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
  imageClassName?: string;
}

/**
 * A calm first-run state for the few places where an illustration makes the
 * next step easier to scan. The image is decorative because the visible copy
 * carries the meaning and remains available to assistive technology.
 */
export function IllustratedEmptyState({
  imageSrc,
  title,
  description,
  action,
  className,
  imageClassName,
}: IllustratedEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-4 py-10 text-center",
        className,
      )}
    >
      <img
        src={imageSrc}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(
          "mb-3 h-24 w-auto max-w-full select-none object-contain sm:h-28",
          imageClassName,
        )}
      />
      {title && <h3 className="text-base font-semibold">{title}</h3>}
      <div className={cn("max-w-md text-sm text-muted-foreground", title && "mt-1")}>
        {description}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
