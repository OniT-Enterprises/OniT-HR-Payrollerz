/**
 * Utility to ensure window.fetch is restored and not overridden
 * Fixes "Failed to fetch" errors caused by fetch overrides
 */

export const restoreFetch = () => {
  if (typeof window === "undefined") return;

  // Check if fetch is overridden
  if ((window as any).__originalFetch) {
    console.log("🔄 Restoring original fetch function...");
    window.fetch = (window as any).__originalFetch;
    delete (window as any).__originalFetch;
    console.log("✅ Original fetch function restored");
  } else {
    console.log("✅ Fetch function is already clean (not overridden)");
  }
};

export const checkFetchStatus = () => {
  if (typeof window === "undefined")
    return { isOverridden: false, hasOriginal: false };

  const isOverridden = !!(window as any).__originalFetch;
  const fetchString = window.fetch.toString();
  const isCustom =
    fetchString.includes("Firebase") || fetchString.includes("blocked");

  return {
    isOverridden,
    hasOriginal: !!(window as any).__originalFetch,
    isCustom,
    fetchInfo: {
      length: fetchString.length,
      isNative: fetchString.includes("[native code]"),
    },
  };
};

// Auto-restore fetch on module load
if (typeof window !== "undefined") {
  // Small delay to let other modules load
  setTimeout(() => {
    const status = checkFetchStatus();
    console.log("🔍 Fetch status check:", status);

    if (status.isOverridden || status.isCustom) {
      console.log("⚠️ Fetch appears to be overridden, restoring...");
      restoreFetch();
    }
  }, 100);
}
