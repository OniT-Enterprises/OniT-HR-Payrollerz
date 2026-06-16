import React from "react";
import { Loader2 } from "lucide-react";

interface GoogleSignInButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label: string;
  className?: string;
}

/**
 * Standard "Continue with Google" button. White surface + multicolour Google
 * mark so it reads correctly on both the dark login screen and the light
 * signup screen.
 */
export function GoogleSignInButton({
  onClick,
  loading = false,
  disabled = false,
  label,
  className = "",
}: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.642h6.458a5.52 5.52 0 0 1-2.394 3.622v3.01h3.878c2.269-2.09 3.578-5.166 3.578-8.819z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.956-1.075 7.942-2.908l-3.878-3.01c-1.075.72-2.45 1.145-4.064 1.145-3.125 0-5.77-2.11-6.714-4.946H1.276v3.106A11.997 11.997 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.286 14.281A7.213 7.213 0 0 1 4.91 12c0-.79.137-1.558.376-2.281V6.613H1.276A11.997 11.997 0 0 0 0 12c0 1.937.464 3.769 1.276 5.387l4.01-3.106z"
          />
          <path
            fill="#EA4335"
            d="M12 4.773c1.762 0 3.343.606 4.587 1.795l3.44-3.44C17.951 1.19 15.235 0 12 0A11.997 11.997 0 0 0 1.276 6.613l4.01 3.106C6.23 6.883 8.875 4.773 12 4.773z"
          />
        </svg>
      )}
      {label}
    </button>
  );
}
