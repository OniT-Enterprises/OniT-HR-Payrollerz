import React from "react";
import { useSettings } from "@/hooks/useSettings";

interface CompanyBrandProps {
  isDark: boolean;
  variant: "sidebar" | "topbar";
  collapsed?: boolean;
}

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "CO";
}

export function CompanyBrand({ isDark, variant, collapsed = false }: CompanyBrandProps) {
  const { data: settings } = useSettings();
  const legalName = settings?.companyDetails?.legalName?.trim() ?? "";
  const logoUrl = settings?.companyDetails?.logoUrl?.trim() ?? "";
  const fallbackName = legalName || "Primos Books";
  const defaultLogo = isDark
    ? "/images/illustrations/primos-books-logo-light.webp"
    : "/images/illustrations/primos-books-logo-dark.webp";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={fallbackName}
        className={
          variant === "sidebar"
            ? collapsed
              ? "h-8 w-8 rounded-md object-contain"
              : "max-h-10 max-w-[176px] w-auto object-contain"
            : "max-h-8 max-w-[180px] w-auto object-contain"
        }
      />
    );
  }

  if (legalName) {
    if (variant === "sidebar" && collapsed) {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
          {getInitials(legalName)}
        </div>
      );
    }

    return (
      <span
        className={
          variant === "sidebar"
            ? "max-w-[176px] truncate text-sm font-semibold text-sidebar-foreground"
            : "max-w-[220px] truncate text-sm font-semibold text-foreground"
        }
      >
        {legalName}
      </span>
    );
  }

  return (
    <img
      src={defaultLogo}
      alt="Primos Books"
      className={
        variant === "sidebar"
          ? collapsed
            ? "h-8 w-auto"
            : "h-10 w-auto"
          : "h-8 w-auto"
      }
    />
  );
}
